import {
  createPublicClient,
  webSocket,
  type Address,
  type WatchContractEventReturnType,
} from "viem";
import {
  monadTestnet,
  CLARIO_REGISTRY_ADDRESS,
  CLARIO_REGISTRY_ABI,
  ALCHEMY_MONAD_TESTNET_WSS,
} from "./registry";

export interface MonadEventListenerOptions {
  userAddress?: Address;
  onReceiptSaved?: (event: {
    owner: Address;
    receiptId: `0x${string}`;
    receiptHash: `0x${string}`;
    transactionCount: bigint;
    timestamp: bigint;
  }) => void;
  onTransactionSaved?: (event: {
    user: Address;
    transactionId: `0x${string}`;
    dataHash: `0x${string}`;
    timestamp: bigint;
  }) => void;
  onError?: (error: Error) => void;
}

/**
 * Initializes a real-time event listener on Monad Testnet using Alchemy WebSockets.
 * Listens for ReceiptSaved and TransactionSaved events for sub-second UI updates.
 */
export function listenToMonadEvents(
  options: MonadEventListenerOptions,
): () => void {
  // If no WebSocket URL is configured or running on server, return noop unwatch
  if (
    typeof window === "undefined" ||
    !ALCHEMY_MONAD_TESTNET_WSS ||
    ALCHEMY_MONAD_TESTNET_WSS.trim().length === 0
  ) {
    return () => {};
  }

  try {
    const wsClient = createPublicClient({
      chain: monadTestnet,
      transport: webSocket(ALCHEMY_MONAD_TESTNET_WSS, {
        retryCount: 3,
        timeout: 10_000,
      }),
    });

    const unwatchReceipt: WatchContractEventReturnType =
      wsClient.watchContractEvent({
        address: CLARIO_REGISTRY_ADDRESS,
        abi: CLARIO_REGISTRY_ABI,
        eventName: "ReceiptSaved",
        args: options.userAddress ? { owner: options.userAddress } : undefined,
        onLogs: (logs) => {
          for (const log of logs) {
            if (options.onReceiptSaved && log.args) {
              options.onReceiptSaved({
                owner: log.args.owner as Address,
                receiptId: log.args.receiptId as `0x${string}`,
                receiptHash: log.args.receiptHash as `0x${string}`,
                transactionCount: log.args.transactionCount as bigint,
                timestamp: log.args.timestamp as bigint,
              });
            }
          }
        },
        onError: (err) => {
          if (options.onError) {
            options.onError(err);
          }
        },
      });

    const unwatchTx: WatchContractEventReturnType =
      wsClient.watchContractEvent({
        address: CLARIO_REGISTRY_ADDRESS,
        abi: CLARIO_REGISTRY_ABI,
        eventName: "TransactionSaved",
        args: options.userAddress ? { user: options.userAddress } : undefined,
        onLogs: (logs) => {
          for (const log of logs) {
            if (options.onTransactionSaved && log.args) {
              options.onTransactionSaved({
                user: log.args.user as Address,
                transactionId: log.args.transactionId as `0x${string}`,
                dataHash: log.args.dataHash as `0x${string}`,
                timestamp: log.args.timestamp as bigint,
              });
            }
          }
        },
        onError: (err) => {
          if (options.onError) {
            options.onError(err);
          }
        },
      });

    return () => {
      unwatchReceipt();
      unwatchTx();
    };
  } catch (err: unknown) {
    if (options.onError && err instanceof Error) {
      options.onError(err);
    }
    return () => {};
  }
}
