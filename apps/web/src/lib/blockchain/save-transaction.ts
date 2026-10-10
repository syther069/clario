import { createWalletClient, custom, encodeFunctionData, type Address, type Hash } from "viem";
import { simulateMonadTransaction } from "./simulation";
import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Transaction } from "@/lib/supabase/types";
import {
  CLARIO_REGISTRY_ABI,
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
  getMonadPublicClient,
  monadTestnet,
  toBytes32Id,
  computeTransactionDataHash,
} from "./registry";
import { getSupabaseClient } from "@/lib/supabase/client";

export type SaveStep =
  | "idle"
  | "validating"
  | "saving_supabase"
  | "generating_commitment"
  | "submitting_monad"
  | "confirming"
  | "verified"
  | "failed";

export interface SaveTransactionResult {
  success: boolean;
  transaction: Transaction;
  txHash?: Hash;
  dataHash?: `0x${string}`;
  transactionIdBytes32?: `0x${string}`;
  explorerUrl?: string;
  error?: string;
  isBlockchainVerified: boolean;
}

export interface SaveTransactionParams {
  transactionData: Partial<Transaction> & {
    amount: number;
    merchant: string;
    type?: "expense" | "income" | "transfer";
  };
  userId: string;
  connectedWallet?: ConnectedWallet | null | undefined;
  userAddress?: string | null | undefined;
  onStepChange?: ((step: SaveStep, label: string) => void) | undefined;
}

/**
 * Executes the complete Clario Transaction Saving & Monad Testnet Verification flow:
 * 1. Validate transaction fields
 * 2. Save private transaction in Supabase
 * 3. Generate canonical representation & keccak256 commitment (dataHash)
 * 4. Submit onchain transaction to ClarioTransactionRegistry on Monad Testnet (if wallet available)
 * 5. Await onchain receipt
 * 6. Update Supabase with blockchain metadata
 * 7. Return verified state, real tx hash, and Monad Explorer link
 */
export async function executeSaveTransaction({
  transactionData,
  userId,
  connectedWallet,
  userAddress,
  onStepChange,
}: SaveTransactionParams): Promise<SaveTransactionResult> {
  const step = (s: SaveStep, label: string) => {
    onStepChange?.(s, label);
  };

  // Step 1: Validate
  step("validating", "Validating transaction data...");
  if (!transactionData.amount || transactionData.amount <= 0) {
    throw new Error("Transaction amount must be greater than 0");
  }
  if (!transactionData.merchant || !transactionData.merchant.trim()) {
    throw new Error("Merchant or description is required");
  }

  const transactionId = transactionData.id || crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const dateStr = transactionData.date || nowIso.split("T")[0]!;

  // Step 2: Persist private record in Supabase
  step("saving_supabase", "Persisting transaction in private database...");

  const baseTx: Transaction = {
    id: transactionId,
    user_id: userId,
    type: transactionData.type || "expense",
    amount: transactionData.amount,
    currency: transactionData.currency || "USD",
    merchant: transactionData.merchant.trim(),
    description: transactionData.description || transactionData.merchant.trim(),
    category: transactionData.category || "other",
    category_id:
      transactionData.category_id ||
      (typeof transactionData.category === "string"
        ? transactionData.category
        : transactionData.category?.slug) ||
      "other",
    timestamp: transactionData.timestamp || nowIso,
    date: dateStr,
    payment_method: transactionData.payment_method?.trim() || "Credit Card",
    status: "cleared",
    source: transactionData.source || "manual",
    receipt_id: transactionData.receipt_id || null,
    notes: transactionData.notes || null,
    version: 1,
    verification_state:
      transactionData.verification_state ||
      (transactionData.blockchain_tx_hash || transactionData.monad_tx_hash
        ? "verified"
        : "unverified"),
    verification_status:
      transactionData.verification_status ||
      (transactionData.blockchain_tx_hash || transactionData.monad_tx_hash
        ? "verified"
        : "unverified"),
    blockchain_network: transactionData.blockchain_network || "Monad Testnet",
    blockchain_status:
      transactionData.blockchain_status ||
      (transactionData.blockchain_tx_hash || transactionData.monad_tx_hash
        ? "confirmed"
        : "unverified"),
    blockchain_tx_hash:
      transactionData.blockchain_tx_hash ||
      transactionData.monad_tx_hash ||
      null,
    monad_tx_hash:
      transactionData.monad_tx_hash ||
      transactionData.blockchain_tx_hash ||
      null,
    monad_block: transactionData.monad_block || null,
    blockchain_chain_id:
      transactionData.blockchain_chain_id || MONAD_TESTNET_CHAIN_ID,
    blockchain_contract_address:
      transactionData.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS,
    created_at: transactionData.created_at || nowIso,
    updated_at: nowIso,
  };

  const supabase = getSupabaseClient();
  try {
    await supabase.from("transactions").upsert(baseTx);
  } catch (err) {
    console.warn("Supabase local persistence notice:", err);
  }

  // Step 3: Canonical data commitment
  step(
    "generating_commitment",
    "Generating canonical cryptographic commitment...",
  );
  const transactionIdBytes32 = toBytes32Id(transactionId);
  const dataHash = computeTransactionDataHash({
    ...baseTx,
    id: transactionId,
  });

  baseTx.commitment_hash = dataHash;
  baseTx.blockchain_data_hash = dataHash;

  // If transaction is already confirmed onchain with a hash, skip re-submitting to Monad
  if (
    baseTx.blockchain_tx_hash &&
    (baseTx.blockchain_status === "confirmed" ||
      baseTx.verification_status === "verified")
  ) {
    step("verified", "✓ Verified on Monad Testnet!");
    return {
      success: true,
      transaction: baseTx,
      txHash: baseTx.blockchain_tx_hash as Hash,
      dataHash,
      transactionIdBytes32,
      explorerUrl: getMonadExplorerTxUrl(baseTx.blockchain_tx_hash),
      isBlockchainVerified: true,
    };
  }

  // Step 4 & 5: Check wallet & submit to Monad Testnet
  const hasValidWallet =
    connectedWallet &&
    userAddress &&
    /^0x[0-9a-fA-F]{40}$/.test(userAddress) &&
    CLARIO_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000";

  if (!hasValidWallet) {
    // Cannot submit onchain without a connected EVM wallet or configured contract
    const reason = !connectedWallet
      ? "No EVM wallet connected for Monad Testnet verification."
      : CLARIO_REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000"
        ? "ClarioTransactionRegistry contract address is not yet configured."
        : "Invalid wallet address.";

    step("failed", `Saved in Clario (${reason})`);

    return {
      success: true,
      transaction: baseTx,
      dataHash,
      transactionIdBytes32,
      isBlockchainVerified: false,
      error: reason,
    };
  }

  try {
    step(
      "submitting_monad",
      "Submitting commitment to Monad Testnet (Chain ID 10143)...",
    );

    // Ensure wallet is on Monad Testnet
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
        functionName: "saveTransaction",
        args: [transactionIdBytes32, dataHash],
      });
      await simulateMonadTransaction({
        from: userAddress as Address,
        to: CLARIO_REGISTRY_ADDRESS,
        data: simData,
      });
    } catch (simErr) {
      console.warn("Alchemy simulation note:", simErr);
    }

    // Execute saveTransaction(bytes32 transactionId, bytes32 dataHash)
    const txHash = await walletClient.writeContract({
      address: CLARIO_REGISTRY_ADDRESS,
      abi: CLARIO_REGISTRY_ABI,
      functionName: "saveTransaction",
      args: [transactionIdBytes32, dataHash],
    });

    step("confirming", "Waiting for block confirmation on Monad...");

    const publicClient = getMonadPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    const isSuccess = receipt.status === "success";

    if (!isSuccess) {
      throw new Error(
        `Monad transaction reverted with status: ${receipt.status}`,
      );
    }

    // Step 6: Update Supabase metadata
    step("verified", "✓ Verified on Monad Testnet!");

    const confirmedTx: Transaction = {
      ...baseTx,
      verification_state: "verified",
      verification_status: "verified",
      blockchain_status: "confirmed",
      blockchain_tx_hash: txHash,
      blockchain_data_hash: dataHash,
      blockchain_timestamp: new Date().toISOString(),
      monad_tx_hash: txHash,
      monad_block: Number(receipt.blockNumber),
      updated_at: new Date().toISOString(),
    };

    // Sync to Supabase via server API or direct update
    try {
      await fetch("/api/transactions/onchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: confirmedTx,
          txHash,
          blockNumber: Number(receipt.blockNumber),
          userAddress,
        }),
      });
    } catch (syncErr) {
      console.warn("Supabase onchain sync note:", syncErr);
    }

    return {
      success: true,
      transaction: confirmedTx,
      txHash,
      dataHash,
      transactionIdBytes32,
      explorerUrl: getMonadExplorerTxUrl(txHash),
      isBlockchainVerified: true,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message.includes("User rejected")
          ? "Transaction signing was rejected in wallet."
          : err.message
        : "Failed to submit onchain transaction.";

    step("failed", `Verification failed: ${errorMsg}`);

    // Update base transaction status to failed without losing record
    baseTx.blockchain_status = "failed";
    baseTx.verification_state = "unverified";

    return {
      success: true,
      transaction: baseTx,
      dataHash,
      transactionIdBytes32,
      isBlockchainVerified: false,
      error: errorMsg,
    };
  }
}
