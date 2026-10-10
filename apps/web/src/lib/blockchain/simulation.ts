import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
import { monadTestnet, MONAD_TESTNET_RPC, IS_ALCHEMY_MONAD_RPC_ACTIVE } from "./registry";

export interface SimulationResult {
  readonly success: boolean;
  readonly gasEstimate: bigint;
  readonly gasCostGwei?: string;
  readonly errorReason?: string;
  readonly provider: "alchemy" | "monad-public";
  readonly simulatedAt: string;
}

/**
 * Simulates a Monad transaction execution using Alchemy Monad RPC.
 * Predicts gas consumption, tests for reverts, and prevents failed onchain transactions.
 */
export async function simulateMonadTransaction(params: {
  from?: Address;
  to: Address;
  data: Hex;
  value?: bigint;
}): Promise<SimulationResult> {
  const simulatedAt = new Date().toISOString();
  try {
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http(MONAD_TESTNET_RPC),
    });

    // 1. Pre-flight eth_call to check for logical reverts
    await client.call({
      account: params.from,
      to: params.to,
      data: params.data,
      value: params.value ?? 0n,
    });

    // 2. Pre-flight eth_estimateGas to measure execution cost
    const gasEstimate = await client.estimateGas({
      account: params.from,
      to: params.to,
      data: params.data,
      value: params.value ?? 0n,
    });

    // 3. Query current gas price to calculate estimated cost
    const gasPrice = await client.getGasPrice().catch(() => 50_000_000_000n);
    const gasCostGwei = (
      Number((gasEstimate * gasPrice) / 1_000_000_000n) / 1e9
    ).toFixed(6);

    const provider: "alchemy" | "monad-public" = IS_ALCHEMY_MONAD_RPC_ACTIVE
      ? "alchemy"
      : "monad-public";

    return {
      success: true,
      gasEstimate,
      gasCostGwei,
      provider,
      simulatedAt,
    };
  } catch (err: unknown) {
    let errorReason = "Transaction simulation failed or would revert.";

    if (err instanceof BaseError) {
      const revertError = err.walk(
        (e) => e instanceof ContractFunctionRevertedError,
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        errorReason = revertError.reason || revertError.message;
      } else {
        errorReason = err.shortMessage || err.message;
      }
    } else if (err instanceof Error) {
      errorReason = err.message;
    }

    const provider: "alchemy" | "monad-public" = IS_ALCHEMY_MONAD_RPC_ACTIVE
      ? "alchemy"
      : "monad-public";

    return {
      success: false,
      gasEstimate: 0n,
      errorReason,
      provider,
      simulatedAt,
    };
  }
}
