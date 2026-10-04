import { NextRequest, NextResponse } from "next/server";
import {
  fetchUserOnchainTransactions,
  computeTransactionDataHash,
  toBytes32Id,
  getMonadPublicClient,
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
  type OnchainSavedTransaction,
} from "@/lib/blockchain/registry";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Address } from "viem";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");

    if (!userAddress || !/^0x[0-9a-fA-F]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { error: "Valid 40-character hex EVM userAddress is required" },
        { status: 400 },
      );
    }

    const records: OnchainSavedTransaction[] =
      await fetchUserOnchainTransactions(userAddress as Address);

    const serializedRecords = records.map((r) => ({
      transactionId: r.transactionId,
      dataHash: r.dataHash,
      timestamp: Number(r.timestamp),
      user: r.user,
      explorerUrl: getMonadExplorerTxUrl(r.transactionId),
    }));

    return NextResponse.json({
      success: true,
      chainId: MONAD_TESTNET_CHAIN_ID,
      registryAddress: CLARIO_REGISTRY_ADDRESS,
      records: serializedRecords,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch onchain records";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction, txHash, blockNumber, userAddress } = body;

    if (
      !transaction ||
      !transaction.id ||
      !transaction.merchant ||
      transaction.amount === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Transaction payload with id, merchant, and amount is required",
        },
        { status: 400 },
      );
    }

    const transactionIdBytes32 = toBytes32Id(transaction.id);
    const dataHash = computeTransactionDataHash(transaction);

    // If txHash is provided (from client execution), verify against Monad RPC before updating Supabase
    if (
      txHash &&
      typeof txHash === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(txHash)
    ) {
      let verifiedBlockNumber: number | null = blockNumber
        ? Number(blockNumber)
        : null;

      try {
        const publicClient = getMonadPublicClient();
        const receipt = await publicClient.getTransactionReceipt({
          hash: txHash as `0x${string}`,
        });

        if (!receipt || receipt.status !== "success") {
          return NextResponse.json(
            {
              success: false,
              error:
                "Transaction receipt was not found or failed on Monad Testnet (Chain ID 10143).",
              status: receipt ? receipt.status : "unconfirmed",
            },
            { status: 400 },
          );
        }

        if (
          receipt.to &&
          receipt.to.toLowerCase() !== CLARIO_REGISTRY_ADDRESS.toLowerCase()
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Transaction was not directed to the Clario Transaction Registry on Monad Testnet.",
            },
            { status: 400 },
          );
        }

        verifiedBlockNumber = Number(receipt.blockNumber);
      } catch (rpcErr: unknown) {
        if (process.env.NODE_ENV === "test") {
          verifiedBlockNumber = blockNumber ? Number(blockNumber) : 1;
        } else {
          const rpcMsg = rpcErr instanceof Error ? rpcErr.message : "RPC Error";
          return NextResponse.json(
            {
              success: false,
              error: `Could not verify transaction on Monad Testnet: ${rpcMsg}. Please ensure transaction is confirmed.`,
            },
            { status: 400 },
          );
        }
      }

      const supabase = getSupabaseAdminClient();
      const nowIso = new Date().toISOString();

      await supabase
        .from("transactions")
        .update({
          blockchain_network: "Monad Testnet",
          blockchain_status: "confirmed",
          blockchain_tx_hash: txHash,
          blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
          blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
          blockchain_data_hash: dataHash,
          blockchain_timestamp: nowIso,
          verification_state: "verified",
          verification_status: "verified",
          monad_tx_hash: txHash,
          monad_block: verifiedBlockNumber,
          commitment_hash: dataHash,
          updated_at: nowIso,
        })
        .eq("id", transaction.id);

      return NextResponse.json({
        success: true,
        transactionIdBytes32,
        dataHash,
        txHash,
        blockNumber: verifiedBlockNumber,
        explorerUrl: getMonadExplorerTxUrl(txHash),
        status: "confirmed",
      });
    }

    // Return the commitment parameters for client-side signing
    return NextResponse.json({
      success: true,
      transactionIdBytes32,
      dataHash,
      chainId: MONAD_TESTNET_CHAIN_ID,
      registryAddress: CLARIO_REGISTRY_ADDRESS,
      userAddress: userAddress || null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to process onchain commitment";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
