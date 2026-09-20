declare const BrandSymbol: unique symbol;

/**
 * Nominal branding helper to prevent structural type interchangeability.
 */
export type Branded<T, B extends string> = T & {
  readonly [BrandSymbol]: B;
};

/**
 * Opaque 32-byte workspace identifier.
 */
export type WorkspaceId = Branded<`0x${string}`, "WorkspaceId">;

/**
 * Opaque 32-byte expense identifier. Never derived from private fields.
 */
export type ExpenseId = Branded<`0x${string}`, "ExpenseId">;

/**
 * Monotonically increasing expense version number (starts at 1).
 */
export type ExpenseVersion = Branded<number, "ExpenseVersion">;

/**
 * 32-byte cryptographic commitment digest registered onchain.
 */
export type CommitmentHash = Branded<`0x${string}`, "CommitmentHash">;

/**
 * Domain-bound decision identifier.
 */
export type DecisionId = Branded<`0x${string}`, "DecisionId">;

/**
 * Monotonic policy version number (starts at 1).
 */
export type PolicyVersion = Branded<number, "PolicyVersion">;

/**
 * 32-byte cryptographic commitment to the applicable workspace policy.
 */
export type PolicyCommitment = Branded<`0x${string}`, "PolicyCommitment">;

/**
 * 32-byte settlement payment reference or transaction digest.
 */
export type PaymentReference = Branded<`0x${string}`, "PaymentReference">;

/**
 * Normalized 20-byte EVM address (lowercase 0x-prefixed 40 hex chars).
 */
export type EvmAddress = Branded<`0x${string}`, "EvmAddress">;

/**
 * Generic 32-byte hexadecimal value (lowercase 0x-prefixed 64 hex chars).
 */
export type Bytes32 = Branded<`0x${string}`, "Bytes32">;

/**
 * Network chain ID integer (positive integer >= 1).
 */
export type ChainId = Branded<number, "ChainId">;

/**
 * Safe opaque request identifier for tracing without leaking data.
 */
export type RequestId = Branded<string, "RequestId">;

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{1,64}$/;

function parseHex32(val: unknown, fieldName: string): `0x${string}` {
  if (typeof val !== "string" || !BYTES32_REGEX.test(val)) {
    throw new Error(
      `Invalid ${fieldName}: must be a 0x-prefixed 64-character hexadecimal string.`,
    );
  }
  return val.toLowerCase() as `0x${string}`;
}

function parsePositiveInt(val: unknown, fieldName: string): number {
  if (typeof val !== "number" || !Number.isInteger(val) || val < 1) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer >= 1.`);
  }
  return val;
}

export function parseWorkspaceId(val: unknown): WorkspaceId {
  return parseHex32(val, "workspaceId") as WorkspaceId;
}

export function parseExpenseId(val: unknown): ExpenseId {
  return parseHex32(val, "expenseId") as ExpenseId;
}

export function parseExpenseVersion(val: unknown): ExpenseVersion {
  return parsePositiveInt(val, "version") as ExpenseVersion;
}

export function parseCommitmentHash(val: unknown): CommitmentHash {
  return parseHex32(val, "commitment") as CommitmentHash;
}

export function parseDecisionId(val: unknown): DecisionId {
  return parseHex32(val, "decisionId") as DecisionId;
}

export function parsePolicyVersion(val: unknown): PolicyVersion {
  return parsePositiveInt(val, "policyVersion") as PolicyVersion;
}

export function parsePolicyCommitment(val: unknown): PolicyCommitment {
  return parseHex32(val, "policyCommitment") as PolicyCommitment;
}

export function parsePaymentReference(val: unknown): PaymentReference {
  return parseHex32(val, "paymentReference") as PaymentReference;
}

export function parseBytes32(val: unknown): Bytes32 {
  return parseHex32(val, "bytes32") as Bytes32;
}

export function parseEvmAddress(val: unknown): EvmAddress {
  if (typeof val !== "string" || !ADDRESS_REGEX.test(val)) {
    throw new Error(
      "Invalid address: must be a 0x-prefixed 40-character hexadecimal address.",
    );
  }
  return val.toLowerCase() as EvmAddress;
}

export function parseChainId(val: unknown): ChainId {
  return parsePositiveInt(val, "chainId") as ChainId;
}

export function parseRequestId(val: unknown): RequestId {
  if (typeof val !== "string" || !REQUEST_ID_REGEX.test(val)) {
    throw new Error(
      "Invalid requestId: must be an ASCII string between 1 and 64 characters.",
    );
  }
  return val as RequestId;
}
