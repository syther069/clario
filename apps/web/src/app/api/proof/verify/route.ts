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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput = (body.hash || "").trim();

    if (!rawInput) {
      return NextResponse.json(
        {
          error:
            "A valid transaction hash, receipt hash, or commitment hash is required.",
        },
        { status: 400 },
      );
    }

    const publicClient = getMonadPublicClient();

    // 1. Check if input is a valid 32-byte hex (transaction hash or data hash)
    const formattedHex = rawInput.startsWith("0x") ? rawInput : `0x${rawInput}`;
    const is32ByteHex = /^0x[0-9a-fA-F]{64}$/.test(formattedHex);

    if (is32ByteHex) {
      // First attempt: direct Monad Testnet transaction receipt lookup
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: formattedHex as `0x${string}`,
        });

        if (receipt) {
          const isSuccess = receipt.status === "success";
          const block = await publicClient.getBlock({
            blockNumber: receipt.blockNumber,
          });

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
      } catch {
        // Transaction not found directly as txHash; proceed to search commitment database
      }
    }

    // 2. Search database for matching receipt bundle, transaction, or proof commitment
    let matchedTxHash: string | null = null;
    let recordMetadata: Record<string, unknown> = {};

    try {
      const supabase = getSupabaseAdminClient();

      // Check receipt_bundles
      const { data: bundleData } = await supabase
        .from("receipt_bundles")
        .select("*")
        .or(
          `receipt_hash.eq.${rawInput},receipt_hash.eq.${formattedHex},id.eq.${rawInput},blockchain_tx_hash.eq.${formattedHex}`,
        )
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
          owner: bundleData.wallet_address || bundleData.user_id,
        };
      } else {
        // Check transactions table
        const { data: txData } = await supabase
          .from("transactions")
          .select("*")
          .or(
            `blockchain_data_hash.eq.${formattedHex},commitment_hash.eq.${formattedHex},blockchain_tx_hash.eq.${formattedHex},id.eq.${rawInput}`,
          )
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
    const message = err instanceof Error ? err.message : "Verification error";
    return NextResponse.json(
      { success: false, verified: false, error: message },
      { status: 500 },
    );
  }
}
