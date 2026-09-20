/**
 * Clario Settlement Receipt & Event Validation (SET-002)
 *
 * Validates onchain transaction receipts, decoding and verifying:
 * 1. Receipt status (success vs reverted).
 * 2. Destination contract (registry address).
 * 3. Authoritative SettlementRecorded event parameters (workspace, expense, version, commitment, token, recipient, amount).
 * 4. ERC-20 Transfer event parameters (token, recipient, amount).
 *
 * Enforces founder invariants (RULES §2, §14):
 * - Reverted transactions NEVER mark reimbursed.
 * - Any parameter mismatch blocks confirmation.
 * - Private evidence fields remain completely absent from event assertions.
 */

import {
  decodeEventLog,
  createPublicClient,
  http,
  getAddress,
  type Abi,
} from "viem";
import { SETTLEMENT_REGISTRY_ABI } from "./calldata";

export const ERC20_TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

export interface ExpectedSettlementParams {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly version: number;
  readonly commitment: string;
  readonly tokenAddress: string;
  readonly recipientAddress: string;
  readonly amountBaseUnits: bigint;
  readonly registryAddress: string;
  readonly chainId?: number | undefined;
}

export type SettlementValidationFailureCode =
  | "RECEIPT_NOT_FOUND"
  | "TRANSACTION_REVERTED"
  | "WRONG_DESTINATION_CONTRACT"
  | "SETTLEMENT_EVENT_NOT_FOUND"
  | "TRANSFER_EVENT_NOT_FOUND"
  | "WORKSPACE_ID_MISMATCH"
  | "EXPENSE_ID_MISMATCH"
  | "VERSION_MISMATCH"
  | "COMMITMENT_MISMATCH"
  | "TOKEN_MISMATCH"
  | "RECIPIENT_MISMATCH"
  | "AMOUNT_MISMATCH";

export interface SettlementValidationSuccess {
  readonly valid: true;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly transactionHash: string;
  readonly paymentReference: string;
  readonly tokenAddress: string;
  readonly recipientAddress: string;
  readonly amountBaseUnits: bigint;
  readonly confirmedAtBlock: bigint;
}

export interface SettlementValidationFailure {
  readonly valid: false;
  readonly code: SettlementValidationFailureCode;
  readonly reason: string;
  readonly isReverted?: boolean | undefined;
}

export type SettlementValidationResult =
  SettlementValidationSuccess | SettlementValidationFailure;

export interface MinimalReceiptLog {
  readonly address: string;
  readonly data: `0x${string}`;
  readonly topics: readonly `0x${string}`[];
  readonly logIndex?: number | undefined;
}

export interface MinimalTransactionReceipt {
  readonly status: "success" | "reverted" | string | number;
  readonly blockNumber: bigint | number | string;
  readonly blockHash: string;
  readonly transactionHash: string;
  readonly to: string | null;
  readonly from?: string | undefined;
  readonly logs: readonly MinimalReceiptLog[];
}

function normalizeHex32(value: string): string {
  if (value.startsWith("0x")) {
    const clean = value.toLowerCase().slice(2);
    return ("0x" + clean.padStart(64, "0")).slice(0, 66);
  }
  const hex = Buffer.from(value, "utf8").toString("hex");
  return ("0x" + hex.padEnd(64, "0")).slice(0, 66);
}

/**
 * Validates a transaction receipt and decodes expected SettlementRecorded and ERC-20 Transfer events.
 */
export function validateSettlementReceipt(
  receipt: MinimalTransactionReceipt,
  expected: ExpectedSettlementParams,
): SettlementValidationResult {
  // 1. Validate onchain execution status
  const rawStatus = receipt.status;
  const isReverted =
    rawStatus === "reverted" ||
    rawStatus === 0 ||
    rawStatus === "0" ||
    rawStatus === "0x0";
  const isSuccess =
    rawStatus === "success" ||
    rawStatus === 1 ||
    rawStatus === "1" ||
    rawStatus === "0x1";

  if (isReverted || !isSuccess) {
    return {
      valid: false,
      code: "TRANSACTION_REVERTED",
      reason: `Transaction execution reverted onchain (status: ${String(rawStatus)}).`,
      isReverted: true,
    };
  }

  // 2. Validate destination contract (if present in receipt)
  if (receipt.to) {
    const expectedReg = expected.registryAddress.toLowerCase();
    const actualTo = receipt.to.toLowerCase();
    if (actualTo !== expectedReg) {
      return {
        valid: false,
        code: "WRONG_DESTINATION_CONTRACT",
        reason: `Transaction destination '${receipt.to}' does not match expected settlement registry '${expected.registryAddress}'.`,
      };
    }
  }

  // Normalize expected identifiers
  const expWs = normalizeHex32(expected.workspaceId);
  const expExp = normalizeHex32(expected.expenseId);
  const expCommit = normalizeHex32(expected.commitment);
  const expToken = getAddress(expected.tokenAddress).toLowerCase();
  const expRecipient = getAddress(expected.recipientAddress).toLowerCase();

  let settlementEventFound = false;
  let paymentReference = "0x" + "0".repeat(64);
  let settlementMismatchError: SettlementValidationFailure | null = null;

  // 3. Scan logs for SettlementRecorded event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SETTLEMENT_REGISTRY_ABI,
        data: log.data,
        topics: log.topics as [
          signature: `0x${string}`,
          ...args: `0x${string}`[],
        ],
      });

      if (decoded.eventName === "SettlementRecorded") {
        const args = decoded.args as {
          workspaceId: string;
          expenseId: string;
          version: number;
          commitment: string;
          token: string;
          recipient: string;
          amount: bigint;
          paymentReference: string;
        };

        const actualWs = normalizeHex32(args.workspaceId);
        const actualExp = normalizeHex32(args.expenseId);
        const actualCommit = normalizeHex32(args.commitment);
        const actualToken = getAddress(args.token).toLowerCase();
        const actualRecipient = getAddress(args.recipient).toLowerCase();
        const actualVersion = Number(args.version);
        const actualAmount = BigInt(args.amount);

        if (actualWs !== expWs) {
          settlementMismatchError = {
            valid: false,
            code: "WORKSPACE_ID_MISMATCH",
            reason: `SettlementRecorded event workspaceId '${actualWs}' does not match expected '${expWs}'.`,
          };
          continue;
        }
        if (actualExp !== expExp) {
          settlementMismatchError = {
            valid: false,
            code: "EXPENSE_ID_MISMATCH",
            reason: `SettlementRecorded event expenseId '${actualExp}' does not match expected '${expExp}'.`,
          };
          continue;
        }
        if (actualVersion !== expected.version) {
          settlementMismatchError = {
            valid: false,
            code: "VERSION_MISMATCH",
            reason: `SettlementRecorded event version ${actualVersion} does not match expected version ${expected.version}.`,
          };
          continue;
        }
        if (actualCommit !== expCommit) {
          settlementMismatchError = {
            valid: false,
            code: "COMMITMENT_MISMATCH",
            reason: `SettlementRecorded event commitment '${actualCommit}' does not match expected '${expCommit}'.`,
          };
          continue;
        }
        if (actualToken !== expToken) {
          settlementMismatchError = {
            valid: false,
            code: "TOKEN_MISMATCH",
            reason: `SettlementRecorded event token '${actualToken}' does not match expected token '${expToken}'.`,
          };
          continue;
        }
        if (actualRecipient !== expRecipient) {
          settlementMismatchError = {
            valid: false,
            code: "RECIPIENT_MISMATCH",
            reason: `SettlementRecorded event recipient '${actualRecipient}' does not match expected recipient '${expRecipient}'.`,
          };
          continue;
        }
        if (actualAmount !== expected.amountBaseUnits) {
          settlementMismatchError = {
            valid: false,
            code: "AMOUNT_MISMATCH",
            reason: `SettlementRecorded event amount ${actualAmount.toString()} does not match expected amount ${expected.amountBaseUnits.toString()}.`,
          };
          continue;
        }

        settlementEventFound = true;
        paymentReference = args.paymentReference;
        break;
      }
    } catch {
      // Ignore logs not matching SettlementRegistry ABI
    }
  }

  if (!settlementEventFound) {
    if (settlementMismatchError) {
      return settlementMismatchError;
    }
    return {
      valid: false,
      code: "SETTLEMENT_EVENT_NOT_FOUND",
      reason: "SettlementRecorded event was not found in transaction logs.",
    };
  }

  // 4. Scan logs for ERC-20 Transfer event
  let transferEventFound = false;
  for (const log of receipt.logs) {
    const logAddress = log.address.toLowerCase();
    if (logAddress !== expToken) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: ERC20_TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics as [
          signature: `0x${string}`,
          ...args: `0x${string}`[],
        ],
      });

      if (decoded.eventName === "Transfer") {
        const args = decoded.args as {
          from: string;
          to: string;
          value: bigint;
        };

        const transferTo = getAddress(args.to).toLowerCase();
        const transferValue = BigInt(args.value);

        if (
          transferTo === expRecipient &&
          transferValue === expected.amountBaseUnits
        ) {
          transferEventFound = true;
          break;
        }
      }
    } catch {
      // Ignore logs not matching Transfer ABI
    }
  }

  if (!transferEventFound) {
    return {
      valid: false,
      code: "TRANSFER_EVENT_NOT_FOUND",
      reason: `ERC-20 Transfer event for token '${expected.tokenAddress}', recipient '${expected.recipientAddress}', and amount ${expected.amountBaseUnits.toString()} was not found in transaction logs.`,
    };
  }

  const blockNumber = BigInt(receipt.blockNumber);

  return {
    valid: true,
    blockNumber,
    blockHash: receipt.blockHash,
    transactionHash: receipt.transactionHash,
    paymentReference,
    tokenAddress: expected.tokenAddress,
    recipientAddress: expected.recipientAddress,
    amountBaseUnits: expected.amountBaseUnits,
    confirmedAtBlock: blockNumber,
  };
}

export interface FetchAndValidateReceiptOptions {
  rpcUrl: string;
  transactionHash: `0x${string}`;
  expected: ExpectedSettlementParams;
}

/**
 * Fetches transaction receipt via JSON-RPC and validates the settlement event.
 */
export async function fetchAndValidateSettlementReceipt(
  rpcUrlOrOptions: string | FetchAndValidateReceiptOptions,
  txHashArg?: `0x${string}`,
  expectedArg?: ExpectedSettlementParams,
): Promise<
  SettlementValidationResult & { receipt?: MinimalTransactionReceipt }
> {
  const options =
    typeof rpcUrlOrOptions === "object"
      ? rpcUrlOrOptions
      : {
          rpcUrl: rpcUrlOrOptions,
          transactionHash: txHashArg!,
          expected: expectedArg!,
        };

  const client = createPublicClient({
    transport: http(options.rpcUrl),
  });

  const receipt = await client
    .getTransactionReceipt({ hash: options.transactionHash })
    .catch(() => null);
  if (!receipt) {
    return {
      valid: false,
      code: "RECEIPT_NOT_FOUND",
      reason: `Transaction receipt for '${options.transactionHash}' is not yet available on the RPC node.`,
    };
  }

  const minimalReceipt: MinimalTransactionReceipt = {
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    transactionHash: receipt.transactionHash,
    to: receipt.to,
    from: receipt.from,
    logs: receipt.logs.map((l) => ({
      address: l.address,
      data: l.data,
      topics: l.topics,
      logIndex: l.logIndex,
    })),
  };

  const validation = validateSettlementReceipt(
    minimalReceipt,
    options.expected,
  );
  return {
    ...validation,
    receipt: minimalReceipt,
  };
}
