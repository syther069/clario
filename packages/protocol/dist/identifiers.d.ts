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
export declare function parseWorkspaceId(val: unknown): WorkspaceId;
export declare function parseExpenseId(val: unknown): ExpenseId;
export declare function parseExpenseVersion(val: unknown): ExpenseVersion;
export declare function parseCommitmentHash(val: unknown): CommitmentHash;
export declare function parseDecisionId(val: unknown): DecisionId;
export declare function parsePolicyVersion(val: unknown): PolicyVersion;
export declare function parsePolicyCommitment(val: unknown): PolicyCommitment;
export declare function parsePaymentReference(val: unknown): PaymentReference;
export declare function parseBytes32(val: unknown): Bytes32;
export declare function parseEvmAddress(val: unknown): EvmAddress;
export declare function parseChainId(val: unknown): ChainId;
export declare function parseRequestId(val: unknown): RequestId;
export {};
//# sourceMappingURL=identifiers.d.ts.map