import { NextRequest, NextResponse } from "next/server";
import {
  getMonadPublicClient,
  CLARIO_REGISTRY_ADDRESS,
  CLARIO_REGISTRY_ABI,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
} from "@/lib/blockchain/registry";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseEventLogs } from "viem";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { parseSafeJson, isValidUuid } from "@/lib/security/input-validation";
import { sanitizeErrorMessage } from "@/lib/security/safe-error";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`proof:verify:${clientIp}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many verification requests. Please try again shortly.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
          },
        },
      );
    }

    const body = await parseSafeJson<{ hash?: unknown }>(request);
    const rawInput = typeof body.hash === "string" ? body.hash.trim() : "";

    if (!rawInput) {
      return NextResponse.json(
        {
          error:
            "A valid transaction hash, receipt hash, or commitment hash is required.",
        },
        { status: 400 },
      );
    }

    // Strict validation: Reject malformed or injected characters before query execution.
    // Allowed formats: 32-byte hex, UUID, or clean alphanumeric/receipt id (3 to 64 chars).
    const formattedHex = rawInput.startsWith("0x") ? rawInput : `0x${rawInput}`;
    const is32ByteHex = /^0x[0-9a-fA-F]{64}$/.test(formattedHex);
    const isUuid = isValidUuid(rawInput);
    const isAlphanumericId = !rawInput.startsWith("0x") && /^[a-zA-Z0-9_-]{3,64}$/.test(rawInput);

    if (!is32ByteHex && !isUuid && !isAlphanumericId) {
      return NextResponse.json(
        {
          error:
            "Invalid cryptographic fingerprint or identifier format. Must be a valid 32-byte hex, UUID, or alphanumeric identifier.",
        },
        { status: 400 },
      );
    }

    const publicClient = getMonadPublicClient();

    // 1. Direct Monad Testnet transaction receipt lookup for 32-byte hexes
    if (is32ByteHex) {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: formattedHex as `0x${string}`,
        });

        if (receipt) {
          const isSuccess = receipt.status === "success";

          // Parse any Clario registry events
          let parsedEvents: Array<Record<string, unknown>> = [];
          try {
            const logs = parseEventLogs({
              abi: CLARIO_REGISTRY_ABI,
              logs: receipt.logs,
            });
            parsedEvents = logs.map((log) => ({
              eventName: log.eventName,
              args: log.args,
            }));
          } catch {
            // Non-critical if no registry events found in log
          }

          const knownAddresses = [
            CLARIO_REGISTRY_ADDRESS.toLowerCase(),
            process.env.NEXT_PUBLIC_WORKSPACE_REGISTRY_ADDRESS?.toLowerCase(),
            process.env.NEXT_PUBLIC_EXPENSE_REGISTRY_ADDRESS?.toLowerCase(),
            process.env.NEXT_PUBLIC_DECISION_REGISTRY_ADDRESS?.toLowerCase(),
            process.env.NEXT_PUBLIC_SETTLEMENT_REGISTRY_ADDRESS?.toLowerCase(),
          ].filter(Boolean);

          const isClarioTarget = Boolean(
            receipt.to && knownAddresses.includes(receipt.to.toLowerCase()),
          );
          const hasClarioEvents = parsedEvents.length > 0;

          // Only verify directly if targeting a Clario contract or emitting Clario events
          if (isClarioTarget || hasClarioEvents) {
            const block = await publicClient.getBlock({
              blockNumber: receipt.blockNumber,
            });

            return NextResponse.json({
              success: true,
              verified: isSuccess,
              type: "transaction",
              hash: formattedHex,
              txHash: formattedHex,
              blockNumber: Number(receipt.blockNumber),
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              chain: "Monad Testnet",
              chainId: MONAD_TESTNET_CHAIN_ID,
              contractAddress: receipt.to,
              status: receipt.status,
              events: parsedEvents,
              explorerUrl: getMonadExplorerTxUrl(formattedHex),
            });
          }
        }
      } catch {
        // Transaction not found directly as txHash; proceed to search commitment database
      }
    }

    // 2. Search database for matching receipt bundle, transaction, or proof commitment
    let matchedTxHash: string | null = null;
    let recordMetadata: Record<string, unknown> = {};

    try {
      const supabase = getSupabaseAdminClient();

      // Query receipt_bundles safely using verified input shape
      const bundleConditions: string[] = [];
      if (is32ByteHex) {
        bundleConditions.push(`receipt_hash.eq.${formattedHex}`);
        bundleConditions.push(`blockchain_tx_hash.eq.${formattedHex}`);
      }
      if (isUuid) {
        bundleConditions.push(`id.eq.${rawInput}`);
      }
      if (isAlphanumericId) {
        bundleConditions.push(`receipt_number.eq.${rawInput}`);
        if (!isUuid) {
          bundleConditions.push(`id.eq.${rawInput}`);
        }
      }

      if (bundleConditions.length > 0) {
        const { data: bundleData } = await supabase
          .from("receipt_bundles")
          .select("*")
          .or(bundleConditions.join(","))
          .limit(1)
          .maybeSingle();

        if (bundleData) {
          matchedTxHash = bundleData.blockchain_tx_hash || null;
          recordMetadata = {
            receiptNumber: bundleData.receipt_number,
            receiptName: bundleData.receipt_name || bundleData.name,
            totalAmount: bundleData.total_amount,
            currency: bundleData.currency,
            transactionCount: bundleData.transaction_count,
            // Invariant: Do not leak internal user_id in public verification endpoints
            owner: bundleData.wallet_address || undefined,
          };
        }
      }

      // If no bundle matched, check transactions table
      if (!matchedTxHash) {
        const txConditions: string[] = [];
        if (is32ByteHex) {
          txConditions.push(`blockchain_data_hash.eq.${formattedHex}`);
          txConditions.push(`commitment_hash.eq.${formattedHex}`);
          txConditions.push(`blockchain_tx_hash.eq.${formattedHex}`);
        }
        if (isUuid) {
          txConditions.push(`id.eq.${rawInput}`);
        }

        if (txConditions.length > 0) {
          const { data: txData } = await supabase
            .from("transactions")
            .select("*")
            .or(txConditions.join(","))
            .limit(1)
            .maybeSingle();

          if (txData) {
            matchedTxHash =
              txData.blockchain_tx_hash || txData.monad_tx_hash || null;
            recordMetadata = {
              merchant: txData.merchant,
              amount: txData.amount,
              currency: txData.currency,
              category: txData.category_id || txData.category,
              source: txData.source,
            };
          }
        }
      }
    } catch (dbErr) {
      console.warn(
        "Notice: Database lookup error during proof verification:",
        dbErr,
      );
    }

    // 3. If a linked onchain transaction was found in the database, verify it on Monad Testnet
    if (matchedTxHash && /^0x[0-9a-fA-F]{64}$/.test(matchedTxHash)) {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: matchedTxHash as `0x${string}`,
        });

        if (receipt && receipt.status === "success") {
          const block = await publicClient.getBlock({
            blockNumber: receipt.blockNumber,
          });

          return NextResponse.json({
            success: true,
            verified: true,
            type: "commitment",
            hash: rawInput,
            txHash: matchedTxHash,
            blockNumber: Number(receipt.blockNumber),
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
            chain: "Monad Testnet",
            chainId: MONAD_TESTNET_CHAIN_ID,
            contractAddress: receipt.to || CLARIO_REGISTRY_ADDRESS,
            status: "success",
            metadata: recordMetadata,
            explorerUrl: getMonadExplorerTxUrl(matchedTxHash),
          });
        }
      } catch {
        // Fallthrough if tx query failed
      }
    }

    // 4. Honest unverified result when hash cannot be confirmed on Monad Testnet
    return NextResponse.json({
      success: true,
      verified: false,
      hash: rawInput,
      chain: "Monad Testnet",
      chainId: MONAD_TESTNET_CHAIN_ID,
      error:
        "The cryptographic fingerprint could not be found or verified on Monad Testnet (Chain ID 10143). Ensure the transaction has been signed and anchored onchain.",
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return NextResponse.json(
      { success: false, verified: false, error: message },
      { status: 500 },
    );
  }
}

