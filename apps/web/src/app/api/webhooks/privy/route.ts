import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  verifyPrivyWebhook,
  type PrivyWebhookEvent,
} from "@/lib/auth/privy-webhook";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDatabaseClient } from "@/lib/db";

/**
 * Privy Webhook Receiver (/api/webhooks/privy)
 *
 * Listens for critical identity, wallet lifecycle, and onchain transaction events from Privy:
 *
 * 1. Transactions (7 events):
 *    - "transaction.broadcasted" -> In-flight transaction tracking
 *    - "transaction.confirmed" -> Onchain confirmation & state finality (Monad / EVM)
 *    - "transaction.execution_reverted" -> Reverted transaction alert
 *    - "transaction.still_pending" -> Timeout warning
 *    - "transaction.failed" -> Failure audit log
 *    - "transaction.replaced" -> Sped up or cancelled hash replacement
 *    - "transaction.provider_error" -> RPC error logging
 *
 * 2. Wallet Lifecycle:
 *    - "user.wallet_created" -> Automated embedded wallet provisioning log
 *    - "wallet.restored" -> Restored wallet audit record
 *    - "wallet.private_key_export" / "private_key.exported" -> High-priority security audit alert
 *
 * Protected with Svix HMAC-SHA256 signature verification & 5-minute replay attack guard.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const headers = {
      svixId: req.headers.get("svix-id"),
      svixTimestamp: req.headers.get("svix-timestamp"),
      svixSignature: req.headers.get("svix-signature"),
    };

    const webhookSecret = process.env.PRIVY_WEBHOOK_SECRET;

    // Verify cryptographic signature
    const verification = verifyPrivyWebhook(rawBody, headers, webhookSecret);
    if (!verification.isValid) {
      console.warn("[Privy Webhook] Rejected invalid webhook:", verification.error);
      return NextResponse.json(
        {
          error: {
            code: "WEBHOOK_VERIFICATION_FAILED",
            message: verification.error || "Invalid webhook signature",
          },
        },
        { status: 401 },
      );
    }

    let event: PrivyWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PrivyWebhookEvent;
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Malformed webhook JSON payload" } },
        { status: 400 },
      );
    }

    console.log(`[Privy Webhook] Received verified event: ${event.type}`);

    // ==========================================
    // 1. WALLET CREATED (user.wallet_created)
    // ==========================================
    if (event.type === "user.wallet_created") {
      const data = event.data as {
        user?: { id?: string };
        wallet?: { address?: string; chain_type?: string; wallet_client_type?: string };
      };

      const walletAddress = data.wallet?.address?.toLowerCase() || "0x0000000000000000000000000000000000000000";
      const userId = data.user?.id || "unknown";
      const chainType = data.wallet?.chain_type || "ethereum";
      const walletClientType = data.wallet?.wallet_client_type || "privy";

      const auditEventId = randomUUID();
      const timestamp = new Date().toISOString();

      // Record in Supabase Audit Trail
      try {
        const supabase = createServerSupabaseClient();
        await supabase.from("business_audit_events").insert({
          id: auditEventId,
          org_id: "global",
          actor_name: userId,
          action: "PRIVY_WALLET_CREATED",
          entity_type: "USER_WALLET",
          entity_id: walletAddress,
          details: `Embedded EVM wallet provisioned (${walletClientType}) for Privy DID: ${userId}`,
          severity: "info",
          timestamp,
        });
      } catch (err) {
        console.warn("[Privy Webhook] Supabase audit insert non-fatal error:", err);
      }

      // Record in PostgreSQL Database audit_events if available
      try {
        const db = getDatabaseClient();
        const wsRes = await db.query<{ workspace_id: string }>(
          "SELECT workspace_id FROM workspaces LIMIT 1",
        );
        const workspaceId = wsRes.rows[0]?.workspace_id || "default";

        await db.query(
          `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
           VALUES ($1, $2, 'PRIVY_WALLET_CREATED', 'USER_WALLET', $3, $4, NOW())`,
          [
            workspaceId,
            walletAddress,
            walletAddress,
            JSON.stringify({ userId, chainType, walletClientType }),
          ],
        );
      } catch {
        // Fallback or dev without direct Postgres pool
      }

      return NextResponse.json({
        received: true,
        status: "processed",
        event: "user.wallet_created",
        address: walletAddress,
        auditId: auditEventId,
      });
    }

    // ==========================================
    // 2. WALLET RESTORED (wallet.restored)
    // ==========================================
    if (event.type === "wallet.restored") {
      const data = event.data as {
        user?: { id?: string };
        wallet?: { address?: string };
      };

      const walletAddress = (data.wallet?.address || "0x0000000000000000000000000000000000000000").toLowerCase();
      const userId = data.user?.id || "unknown";
      const auditEventId = randomUUID();
      const timestamp = new Date().toISOString();

      try {
        const supabase = createServerSupabaseClient();
        await supabase.from("business_audit_events").insert({
          id: auditEventId,
          org_id: "global",
          actor_name: userId,
          action: "PRIVY_WALLET_RESTORED",
          entity_type: "USER_WALLET",
          entity_id: walletAddress,
          details: `Wallet ${walletAddress} was restored from archive for Privy DID: ${userId}`,
          severity: "info",
          timestamp,
        });
      } catch (err) {
        console.warn("[Privy Webhook] Supabase wallet.restored audit error:", err);
      }

      return NextResponse.json({
        received: true,
        status: "processed",
        event: "wallet.restored",
        address: walletAddress,
        auditId: auditEventId,
      });
    }

    // ==========================================
    // 3. PRIVATE KEY EXPORTED (wallet.private_key_export)
    // ==========================================
    if (
      event.type === "private_key.exported" ||
      event.type === "wallet.private_key_export" ||
      event.type === "user.key_exported" ||
      event.type === "user.wallet_exported"
    ) {
      const data = event.data as {
        user?: { id?: string };
        wallet?: { address?: string };
        timestamp?: number | string;
      };

      const walletAddress = data.wallet?.address?.toLowerCase() || "0x0000000000000000000000000000000000000000";
      const userId = data.user?.id || "unknown";
      const auditEventId = randomUUID();
      const timestamp = new Date().toISOString();

      console.warn(
        `[SECURITY AUDIT] Raw private key exported for wallet: ${walletAddress} by user: ${userId}`,
      );

      // Record Critical Security Alert in Supabase Audit Trail
      try {
        const supabase = createServerSupabaseClient();
        await supabase.from("business_audit_events").insert({
          id: auditEventId,
          org_id: "global",
          actor_name: userId,
          action: "PRIVY_PRIVATE_KEY_EXPORTED",
          entity_type: "WALLET_SECURITY",
          entity_id: walletAddress,
          details: `CRITICAL: User initiated self-custody private key export for address ${walletAddress}. Verified by Privy Webhook.`,
          severity: "alert",
          timestamp,
        });
      } catch (err) {
        console.warn("[Privy Webhook] Supabase security audit log non-fatal error:", err);
      }

      // Record in PostgreSQL Database audit_events if available
      try {
        const db = getDatabaseClient();
        const wsRes = await db.query<{ workspace_id: string }>(
          "SELECT workspace_id FROM workspaces LIMIT 1",
        );
        const workspaceId = wsRes.rows[0]?.workspace_id || "default";

        await db.query(
          `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
           VALUES ($1, $2, 'PRIVY_PRIVATE_KEY_EXPORTED', 'WALLET_SECURITY', $3, $4, NOW())`,
          [
            workspaceId,
            walletAddress,
            walletAddress,
            JSON.stringify({ userId, address: walletAddress, exportTimestamp: data.timestamp }),
          ],
        );
      } catch {
        // Fallback or dev without direct Postgres pool
      }

      return NextResponse.json({
        received: true,
        status: "processed",
        event: "wallet.private_key_export",
        severity: "alert",
        address: walletAddress,
        auditId: auditEventId,
      });
    }

    // ==========================================
    // 4. TRANSACTIONS (broadcasted, confirmed, reverted, failed, etc.)
    // ==========================================
    if (event.type.startsWith("transaction.")) {
      const data = event.data as {
        transaction_hash?: string;
        hash?: string;
        chain_id?: number | string;
        chainId?: number | string;
        wallet_address?: string;
        from?: string;
        to?: string;
        value?: string;
        block_number?: number | string;
        blockNumber?: number | string;
        error?: string;
        replacement_transaction_hash?: string;
        user_id?: string;
        user?: { id?: string };
      };

      const txHash = data.transaction_hash || data.hash || "0xunknown";
      const chainId = String(data.chain_id || data.chainId || "10143");
      const walletAddress = (data.wallet_address || data.from || "0x0000000000000000000000000000000000000000").toLowerCase();
      const blockNumber = data.block_number || data.blockNumber;
      const timestamp = new Date().toISOString();
      const auditEventId = randomUUID();

      let action = "TX_UPDATE";
      let severity: "info" | "warning" | "alert" = "info";
      let details = `Transaction event: ${event.type}`;
      let dbStatus: "pending" | "confirmed" | "failed" | null = null;

      switch (event.type) {
        case "transaction.broadcasted":
          action = "TX_BROADCASTED";
          details = `Transaction ${txHash} broadcasted to chain ${chainId} for wallet ${walletAddress}`;
          dbStatus = "pending";
          break;
        case "transaction.confirmed":
          action = "TX_CONFIRMED";
          details = `Transaction ${txHash} confirmed on-chain at block ${blockNumber ?? "latest"}`;
          dbStatus = "confirmed";
          break;
        case "transaction.execution_reverted":
          action = "TX_REVERTED";
          severity = "warning";
          details = `Transaction ${txHash} execution reverted: ${data.error || "Execution reverted"}`;
          dbStatus = "failed";
          break;
        case "transaction.failed":
          action = "TX_FAILED";
          severity = "warning";
          details = `Transaction ${txHash} failed: ${data.error || "Transaction failed"}`;
          dbStatus = "failed";
          break;
        case "transaction.still_pending":
          action = "TX_STILL_PENDING";
          severity = "warning";
          details = `Transaction ${txHash} still pending timeout on chain ${chainId}`;
          dbStatus = "pending";
          break;
        case "transaction.replaced":
          action = "TX_REPLACED";
          details = `Transaction ${txHash} replaced by ${data.replacement_transaction_hash || "new transaction"}`;
          break;
        case "transaction.provider_error":
          action = "TX_PROVIDER_ERROR";
          severity = "warning";
          details = `RPC provider returned error for tx ${txHash}: ${data.error || "Provider error"}`;
          break;
      }

      // Record in Supabase Audit Events
      try {
        const supabase = createServerSupabaseClient();
        await supabase.from("business_audit_events").insert({
          id: auditEventId,
          org_id: "global",
          actor_name: walletAddress,
          action: `PRIVY_${action}`,
          entity_type: "ONCHAIN_TRANSACTION",
          entity_id: txHash,
          details,
          severity,
          timestamp,
        });

        // If transaction exists in Supabase transactions, update blockchain status
        if (dbStatus && txHash !== "0xunknown") {
          await supabase
            .from("transactions")
            .update({
              blockchain_status: dbStatus,
              status: dbStatus === "confirmed" ? "cleared" : undefined,
              monad_block: blockNumber ? Number(blockNumber) : undefined,
            })
            .or(`monad_tx_hash.eq.${txHash},blockchain_tx_hash.eq.${txHash}`);
        }
      } catch (err) {
        console.warn("[Privy Webhook] Supabase transaction audit non-fatal error:", err);
      }

      // Record in PostgreSQL Database audit_events if available
      try {
        const db = getDatabaseClient();
        const wsRes = await db.query<{ workspace_id: string }>(
          "SELECT workspace_id FROM workspaces LIMIT 1",
        );
        const workspaceId = wsRes.rows[0]?.workspace_id || "default";

        await db.query(
          `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
           VALUES ($1, $2, $3, 'TRANSACTION', $4, $5, NOW())`,
          [
            workspaceId,
            walletAddress,
            `PRIVY_${action}`,
            txHash,
            JSON.stringify({ chainId, blockNumber, error: data.error, eventType: event.type }),
          ],
        );
      } catch {
        // Fallback / dev mode
      }

      return NextResponse.json({
        received: true,
        status: "processed",
        event: event.type,
        txHash,
        auditId: auditEventId,
      });
    }

    // ==========================================
    // OTHER / UNHANDLED EVENTS
    // ==========================================
    return NextResponse.json({
      received: true,
      status: "ignored",
      event: event.type,
      message: `Event '${event.type}' is received but not subscribed for active tracking.`,
    });
  } catch (err) {
    console.error("[Privy Webhook] Unhandled exception:", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to process webhook" } },
      { status: 500 },
    );
  }
}

/**
 * Health check / Discovery for webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Clario Privy Webhook Ingestion Engine",
    supportedEvents: [
      // Transactions
      "transaction.broadcasted",
      "transaction.confirmed",
      "transaction.execution_reverted",
      "transaction.still_pending",
      "transaction.failed",
      "transaction.replaced",
      "transaction.provider_error",
      // Wallet Lifecycle
      "user.wallet_created",
      "wallet.restored",
      "wallet.private_key_export (private_key.exported)",
    ],
    signatureSpecification: "Svix HMAC-SHA256 (svix-id, svix-timestamp, svix-signature)",
  });
}
