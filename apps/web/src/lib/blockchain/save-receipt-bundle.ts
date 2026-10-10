import { createWalletClient, custom, encodeFunctionData, type Address, type Hash } from "viem";
import { simulateMonadTransaction } from "./simulation";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type {
  Transaction,
  ReceiptBundle,
  CanonicalReceiptBundle,
} from "@/lib/supabase/types";
import {
  CLARIO_REGISTRY_ABI,
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
  getMonadPublicClient,
  monadTestnet,
  toBytes32Id,
  buildCanonicalReceiptBundle,
  computeReceiptHash,
  canonicalizeJson,
} from "./registry";
import { getSupabaseClient } from "@/lib/supabase/client";

export type ReceiptBundleStep =
  | "idle"
  | "preparing"
  | "generating"
  | "uploading"
  | "hashing"
  | "submitting_monad"
  | "confirming"
  | "verified"
  | "failed";

export interface SaveReceiptBundleResult {
  success: boolean;
  receiptBundle: ReceiptBundle;
  txHash?: Hash;
  receiptHash?: `0x${string}`;
  receiptIdBytes32?: `0x${string}`;
  explorerUrl?: string;
  error?: string;
  isBlockchainVerified: boolean;
}

export interface SaveReceiptBundleParams {
  transactions: Transaction[];
  userId: string;
  receiptName: string;
  userAddress?: string | null | undefined;
  connectedWallet?: ConnectedWallet | null | undefined;
  customReceiptId?: string | undefined;
  customReceiptNumber?: string | undefined;
  onStepChange?: ((step: ReceiptBundleStep, label: string) => void) | undefined;
}

/**
 * Computes a standardized receipt number format (e.g. CR-2026-0001).
 */
export function generateReceiptNumber(): string {
  const currentYear = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CR-${currentYear}-${randomSuffix}`;
}

/**
 * Executes the complete Multi-Transaction Receipt Bundling & Monad Testnet Anchor flow:
 * 1. Validates selected transactions and receipt name
 * 2. Builds deterministic canonical JSON receipt (RFC 8785 sorting) including receipt name
 * 3. Uploads receipt.json to Supabase Storage (receipts bucket)
 * 4. Generates cryptographic commitment (keccak256 receiptHash)
 * 5. Submits ONE Monad transaction (saveReceipt)
 * 6. Waits for Monad block confirmation
 * 7. Updates Supabase receipt_bundles and transaction associations
 * 8. Returns verified receipt bundle with Monad tx hash and explorer link
 */
export async function executeSaveReceiptBundle({
  transactions,
  userId,
  receiptName,
  userAddress,
  connectedWallet,
  customReceiptId,
  customReceiptNumber,
  onStepChange,
}: SaveReceiptBundleParams): Promise<SaveReceiptBundleResult> {
  const step = (s: ReceiptBundleStep, label: string) => {
    onStepChange?.(s, label);
  };

  // 1. Validation
  step("preparing", "Preparing receipt...");
  if (!transactions || transactions.length === 0) {
    throw new Error(
      "At least one transaction must be selected to create a receipt bundle.",
    );
  }

  const alreadyBundled = transactions.filter(
    (tx) => tx.receipt_bundle_id !== null && tx.receipt_bundle_id !== undefined,
  );
  if (alreadyBundled.length > 0) {
    throw new Error(
      `Cannot bundle transactions: ${alreadyBundled.length} transaction(s) already belong to an existing receipt bundle (${alreadyBundled.map((t) => t.id).slice(0, 3).join(", ")}).`,
    );
  }

  const trimmedName = (receiptName || "").trim();
  if (!trimmedName) {
    throw new Error("Receipt name is required.");
  }
  if (trimmedName.length > 80) {
    throw new Error("Receipt name cannot exceed 80 characters.");
  }

  const receiptId =
    customReceiptId || `receipt_${crypto.randomUUID().replace(/-/g, "")}`;
  const receiptNumber = customReceiptNumber || generateReceiptNumber();
  const nowIso = new Date().toISOString();
  const ownerAddress = userAddress || userId;

  // 2. Deterministic Canonical Representation
  step("generating", "Generating receipt...");
  const canonicalBundle: CanonicalReceiptBundle = buildCanonicalReceiptBundle({
    receiptId,
    receiptNumber,
    receiptName: trimmedName,
    owner: ownerAddress,
    transactions,
    createdAt: nowIso,
  });

  const canonicalJson = canonicalizeJson(canonicalBundle);

  // 3. Cryptographic Hashing
  step("hashing", "Creating cryptographic proof...");
  const receiptHash = computeReceiptHash(canonicalBundle);
  const receiptIdBytes32 = toBytes32Id(receiptId);

  // 4. Upload to Supabase Storage
  step("uploading", "Uploading receipt...");
  const storagePath = `${userId}/${receiptId}/receipt.json`;
  const supabase = getSupabaseClient();

  try {
    const fileBlob = new Blob([canonicalJson], { type: "application/json" });
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, fileBlob, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.warn(
        "Notice: Supabase storage upload warning (proceeding with db record):",
        uploadError.message,
      );
    }
  } catch (storageErr) {
    console.warn("Supabase storage error (non-fatal):", storageErr);
  }

  // 5. Initial Receipt Bundle Record (Pending)
  const initialBundle: ReceiptBundle = {
    id: receiptId,
    user_id: userId,
    wallet_address: userAddress || null,
    name: trimmedName,
    receipt_name: trimmedName,
    receipt_number: receiptNumber,
    storage_path: storagePath,
    file_hash: receiptHash,
    receipt_hash: receiptHash,
    transaction_count: canonicalBundle.transactionCount,
    total_amount: canonicalBundle.totalAmount,
    currency: canonicalBundle.currency,
    transaction_ids: canonicalBundle.transactionIds,
    receipt_data: canonicalBundle,
    blockchain_network: "Monad Testnet",
    blockchain_status: "pending",
    blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
    blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
    verification_status: "unverified",
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    await supabase.from("receipt_bundles").upsert(initialBundle);
  } catch (dbErr) {
    console.warn("Supabase receipt_bundles upsert notice:", dbErr);
  }

  // 6. Check wallet & submit ONE transaction to Monad Testnet
  const hasValidWallet =
    connectedWallet &&
    userAddress &&
    /^0x[0-9a-fA-F]{40}$/.test(userAddress) &&
    CLARIO_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000";

  if (!hasValidWallet) {
    const reason = !connectedWallet
      ? "No EVM wallet connected for Monad Testnet registration."
      : CLARIO_REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000"
        ? "ClarioTransactionRegistry address is not configured."
        : "Invalid wallet address.";

    step("failed", `Receipt saved off-chain (${reason})`);

    return {
      success: true,
      receiptBundle: initialBundle,
      receiptHash,
      receiptIdBytes32,
      isBlockchainVerified: false,
      error: reason,
    };
  }

  try {
    step("submitting_monad", "Saving proof on Monad...");

    try {
      await connectedWallet.switchChain(MONAD_TESTNET_CHAIN_ID);
    } catch (switchErr) {
      console.warn("Chain switch note:", switchErr);
    }

    const provider = await connectedWallet.getEthereumProvider();
    const walletClient = createWalletClient({
      account: userAddress as Address,
      chain: monadTestnet,
      transport: custom(provider),
    });

    // Pre-flight simulation via Alchemy Monad RPC to verify valid state transitions
    try {
      const simData = encodeFunctionData({
        abi: CLARIO_REGISTRY_ABI,
        functionName: "saveReceipt",
        args: [
          receiptIdBytes32,
          receiptHash,
          BigInt(canonicalBundle.transactionCount),
        ],
      });
      await simulateMonadTransaction({
        from: userAddress as Address,
        to: CLARIO_REGISTRY_ADDRESS,
        data: simData,
      });
    } catch (simErr) {
      console.warn("Alchemy simulation note:", simErr);
    }

    // Execute saveReceipt(bytes32 receiptId, bytes32 receiptHash, uint256 transactionCount)
    // Exactly ONE Monad transaction for all bundled transactions
    const txHash = await walletClient.writeContract({
      address: CLARIO_REGISTRY_ADDRESS,
      abi: CLARIO_REGISTRY_ABI,
      functionName: "saveReceipt",
      args: [
        receiptIdBytes32,
        receiptHash,
        BigInt(canonicalBundle.transactionCount),
      ],
    });

    step("confirming", "Waiting for confirmation...");

    const publicClient = getMonadPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    if (receipt.status !== "success") {
      try {
        await supabase
          .from("receipt_bundles")
          .update({
            blockchain_status: "failed",
            verification_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", receiptId);
      } catch {}
      throw new Error(
        `Monad transaction reverted with status: ${receipt.status}`,
      );
    }

    step("verified", "✓ Receipt verified on Monad");

    const confirmedBundle: ReceiptBundle = {
      ...initialBundle,
      wallet_address: userAddress || null,
      blockchain_status: "confirmed",
      blockchain_tx_hash: txHash,
      monad_block: Number(receipt.blockNumber),
      verification_status: "verified",
      updated_at: new Date().toISOString(),
    };

    // Sync verified bundle & associated transactions in Supabase
    try {
      await supabase.from("receipt_bundles").upsert(confirmedBundle);

      // Link each transaction to this receipt bundle and mark verified
      for (const txId of canonicalBundle.transactionIds) {
        await supabase
          .from("transactions")
          .update({
            receipt_bundle_id: receiptId,
            verification_state: "verified",
            verification_status: "verified",
            blockchain_status: "confirmed",
            blockchain_tx_hash: txHash,
            monad_tx_hash: txHash,
            monad_block: Number(receipt.blockNumber),
            blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
            blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
            updated_at: new Date().toISOString(),
          })
          .eq("id", txId);
      }

      // Also call server API if available
      await fetch("/api/receipts/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle: confirmedBundle,
          txHash,
          blockNumber: Number(receipt.blockNumber),
          userAddress,
        }),
      }).catch(() => {});
    } catch (syncErr) {
      console.warn("Supabase receipt bundle sync note:", syncErr);
    }

    return {
      success: true,
      receiptBundle: confirmedBundle,
      txHash,
      receiptHash,
      receiptIdBytes32,
      explorerUrl: getMonadExplorerTxUrl(txHash),
      isBlockchainVerified: true,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message.includes("User rejected")
          ? "Transaction signing was rejected in wallet."
          : err.message
        : "Failed to submit receipt bundle to Monad.";

    step("failed", `Verification failed: ${errorMsg}`);

    initialBundle.blockchain_status = "failed";
    initialBundle.verification_status = "failed";

    try {
      const supabase = getSupabaseClient();
      await supabase
        .from("receipt_bundles")
        .update({
          blockchain_status: "failed",
          verification_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);
    } catch {}

    return {
      success: true,
      receiptBundle: initialBundle,
      receiptHash,
      receiptIdBytes32,
      isBlockchainVerified: false,
      error: errorMsg,
    };
  }
}
