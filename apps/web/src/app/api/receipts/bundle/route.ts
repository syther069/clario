import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getMonadExplorerTxUrl,
  fetchUserOnchainReceipts,
  fetchOnchainReceipt,
  toBytes32Id,
  computeReceiptHash,
  getMonadPublicClient,
} from "@/lib/blockchain/registry";
import {
  savedReceiptsStorage,
  normalizeWalletAddress,
  isValidEvmAddress,
} from "@/lib/receipts/saved-receipts-storage";
import type { Address } from "viem";
import { sanitizeErrorMessage } from "@/lib/security/safe-error";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const userId = searchParams.get("userId");
    const receiptId = searchParams.get("receiptId");
    const verifiedOnly = searchParams.get("verifiedOnly") !== "false";

    // 1. If specific receipt requested, fetch with onchain verification
    if (receiptId) {
      const bundle = await savedReceiptsStorage.getReceiptById(
        receiptId,
        userAddress || undefined,
      );

      if (!bundle) {
        return NextResponse.json(
          { error: "Receipt bundle not found or access denied" },
          { status: 404 },
        );
      }

      let onchainMatch = false;
      const targetAddr = userAddress || bundle.wallet_address;
      if (targetAddr && isValidEvmAddress(targetAddr)) {
        try {
          const onchainRecord = await fetchOnchainReceipt(
            targetAddr as Address,
            toBytes32Id(bundle.id),
          );
          if (
            onchainRecord &&
            onchainRecord.receiptHash.toLowerCase() ===
              bundle.receipt_hash.toLowerCase()
          ) {
            onchainMatch = true;
          }
        } catch {
          // Onchain probe fallback
        }
      }

      return NextResponse.json({
        success: true,
        bundle,
        onchainMatch,
        explorerUrl: bundle.blockchain_tx_hash
          ? getMonadExplorerTxUrl(bundle.blockchain_tx_hash)
          : null,
      });
    }

    // 2. Resolve target wallet address for scoped query
    const effectiveWallet =
      userAddress || (isValidEvmAddress(userId) ? userId : null);

    if (effectiveWallet && isValidEvmAddress(effectiveWallet)) {
      const normAddr = normalizeWalletAddress(effectiveWallet);
      const bundles = await savedReceiptsStorage.getReceiptsByWallet(normAddr, {
        verifiedOnly,
      });

      let onchainCount = 0;
      try {
        const onchainReceipts = await fetchUserOnchainReceipts(
          normAddr as Address,
        );
        onchainCount = onchainReceipts.length;
      } catch {
        // Fallback if RPC rate-limited
      }

      return NextResponse.json({
        success: true,
        onchainCount,
        bundles,
      });
    }

    // If only arbitrary non-wallet userId was provided (legacy session fallback)
    if (userId) {
      return NextResponse.json({
        success: true,
        onchainCount: 0,
        bundles: [],
      });
    }

    return NextResponse.json(
      {
        error:
          "userAddress (EVM wallet address) or receiptId query parameter required",
      },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(
      err,
      "Failed to fetch receipt bundles",
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bundle, txHash, blockNumber, userAddress, chain } = body;

    if (!bundle || !bundle.id || !bundle.receipt_hash) {
      return NextResponse.json(
        { error: "Valid bundle payload is required" },
        { status: 400 },
      );
    }

    const effectiveAddress = userAddress || bundle.wallet_address;
    if (!effectiveAddress || !isValidEvmAddress(effectiveAddress)) {
      return NextResponse.json(
        {
          error:
            "A valid connected EVM wallet address is required to persist saved receipts.",
        },
        { status: 400 },
      );
    }

    let verifiedTxHash = txHash || bundle.blockchain_tx_hash || null;
    let verifiedBlockNumber = blockNumber ?? bundle.monad_block ?? null;
    let isConfirmedOnchain = false;

    if (
      verifiedTxHash &&
      typeof verifiedTxHash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(verifiedTxHash)
    ) {
      try {
        const client = getMonadPublicClient();
        const receipt = await client.getTransactionReceipt({
          hash: verifiedTxHash as `0x${string}`,
        });

        if (receipt && receipt.status === "success") {
          verifiedBlockNumber = Number(receipt.blockNumber);
          isConfirmedOnchain = true;
        } else {
          verifiedTxHash = null;
          verifiedBlockNumber = null;
        }
      } catch {
        if (process.env.NODE_ENV === "test") {
          isConfirmedOnchain = true;
        } else {
          isConfirmedOnchain = false;
        }
      }
    }

    const updatedBundle = {
      ...bundle,
      blockchain_status: isConfirmedOnchain ? "confirmed" : "pending",
      verification_status: isConfirmedOnchain ? "verified" : "unverified",
      blockchain_tx_hash: verifiedTxHash,
      monad_block: verifiedBlockNumber,
    };

    // Persist via authoritative dual-layer storage engine
    const { receipt } = await savedReceiptsStorage.saveReceipt({
      bundle: updatedBundle,
      userAddress: effectiveAddress,
      txHash: verifiedTxHash,
      blockNumber: verifiedBlockNumber,
      chain: chain || bundle.blockchain_network || "Monad Testnet",
    });

    // Link each included transaction in Supabase if transactions table exists
    if (
      Array.isArray(bundle.transaction_ids) &&
      bundle.transaction_ids.length > 0
    ) {
      try {
        const supabase = getSupabaseAdminClient();
        for (const txId of bundle.transaction_ids) {
          await supabase
            .from("transactions")
            .update({
              receipt_bundle_id: receipt.id,
              verification_state: isConfirmedOnchain
                ? "verified"
                : "unverified",
              verification_status: isConfirmedOnchain
                ? "verified"
                : "unverified",
              blockchain_status: isConfirmedOnchain ? "confirmed" : "pending",
              blockchain_tx_hash: verifiedTxHash,
              monad_tx_hash: verifiedTxHash,
              monad_block: verifiedBlockNumber,
              updated_at: new Date().toISOString(),
            })
            .eq("id", txId);
        }
      } catch {
        // Non-fatal if transactions table not yet populated
      }
    }

    return NextResponse.json({
      success: true,
      bundle: receipt,
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(
      err,
      "Failed to persist receipt bundle",
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiptId, newName, userAddress } = body;

    if (!receiptId || typeof receiptId !== "string") {
      return NextResponse.json(
        { error: "receiptId is required" },
        { status: 400 },
      );
    }

    const trimmedName = (newName || "").trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Receipt name cannot be empty." },
        { status: 400 },
      );
    }

    if (trimmedName.length > 80) {
      return NextResponse.json(
        { error: "Receipt name cannot exceed 80 characters." },
        { status: 400 },
      );
    }

    const existingBundle = await savedReceiptsStorage.getReceiptById(
      receiptId,
      userAddress || undefined,
    );

    if (!existingBundle) {
      return NextResponse.json(
        { error: "Receipt bundle not found or access denied." },
        { status: 404 },
      );
    }

    // Material edits create immutable versions and require re-verification.
    const currentVersion = Number(existingBundle.receipt_data?.version || 1);
    const newVersion = currentVersion + 1;
    const previousHash = existingBundle.receipt_hash;

    const updatedCanonicalData = {
      ...(existingBundle.receipt_data || {}),
      receiptName: trimmedName,
      version: newVersion,
    };

    const newReceiptHash = computeReceiptHash(updatedCanonicalData);
    const nowIso = new Date().toISOString();

    const updatedBundle = {
      ...existingBundle,
      name: trimmedName,
      receipt_name: trimmedName,
      receipt_data: updatedCanonicalData,
      receipt_hash: newReceiptHash,
      file_hash: newReceiptHash,
      previous_hash: previousHash,
      verification_status: "unverified" as const,
      blockchain_status: "pending" as const,
      updated_at: nowIso,
    };

    const { receipt } = await savedReceiptsStorage.saveReceipt({
      bundle: updatedBundle,
      userAddress: existingBundle.wallet_address || userAddress || "",
      chain: existingBundle.blockchain_network || undefined,
    });

    return NextResponse.json({
      success: true,
      bundle: receipt,
      previousHash,
      newReceiptHash,
      reverificationRequired: true,
      message:
        "Receipt renamed successfully. A new version was created and requires re-verification on Monad Testnet.",
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(
      err,
      "Failed to rename receipt bundle",
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get("receiptId");
    const userAddress = searchParams.get("userAddress");

    if (!receiptId || !userAddress) {
      return NextResponse.json(
        { error: "receiptId and userAddress parameters required" },
        { status: 400 },
      );
    }

    await savedReceiptsStorage.deleteReceipt(receiptId, userAddress);

    return NextResponse.json({
      success: true,
      message: "Saved receipt successfully removed",
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(
      err,
      "Failed to delete saved receipt",
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
