import type { VerificationPackageBundle } from "../package/types.js";
export type VerificationCheckStatus = "VERIFIED" | "VERIFIED_WITH_WARNINGS" | "FAILED" | "UNVERIFIABLE";
export interface VerificationCheckResult {
    readonly id: string;
    readonly label: string;
    readonly status: VerificationCheckStatus;
    readonly explanation: string;
    readonly expected?: string | undefined;
    readonly observed?: string | undefined;
}
export interface VerificationReport {
    readonly schemaVersion: 1;
    readonly overall: VerificationCheckStatus;
    readonly packageSchemaVersion: number | null;
    readonly disclosureLevel: "FULL" | "REDACTED" | null;
    readonly checks: readonly VerificationCheckResult[];
    readonly limitations: readonly string[];
}
export interface VerifierExpenseVersionState {
    readonly registryAddress: string;
    readonly commitment: string;
    readonly submitter: string;
    readonly submittedAtBlock: bigint;
    readonly isSuperseded: boolean;
}
export interface VerifierDecisionState {
    readonly decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
    readonly commitment: string;
    readonly reviewer: string;
    readonly policyVersion: number;
    readonly decidedAtBlock: bigint;
    readonly transactionHash: string | null;
    readonly reviewerWasAuthorized: boolean;
    readonly isCurrentApprovalValid: boolean;
}
export interface VerifierSettlementState {
    readonly commitment: string;
    readonly token: string;
    readonly recipient: string;
    readonly amount: bigint;
    readonly paymentReference: string;
    readonly executor: string;
    readonly settledAtBlock: bigint;
    readonly transactionHash: string | null;
    readonly hasMatchingTokenTransfer: boolean;
    readonly conflictingSettlementCount: number;
}
/**
 * Public-chain boundary used by the deterministic verifier core.
 * Implementations may read any compatible Monad RPC endpoint, a local EVM,
 * or deterministic fixtures. They must never read Clario's authenticated API.
 */
export interface VerifierChainSource {
    getChainId(): Promise<number>;
    isRegistry(registryAddress: string): Promise<boolean>;
    getCurrentVersion(registryAddress: string, workspaceId: string, expenseId: string): Promise<number>;
    getExpenseVersion(registryAddress: string, workspaceId: string, expenseId: string, version: number): Promise<VerifierExpenseVersionState | null>;
    getDecision(registryAddress: string, workspaceId: string, expenseId: string, version: number): Promise<VerifierDecisionState | null>;
    getSettlement(registryAddress: string, workspaceId: string, expenseId: string, version: number): Promise<VerifierSettlementState | null>;
}
export interface VerifyPackageOptions {
    readonly bundle: VerificationPackageBundle;
    readonly chainSource?: VerifierChainSource | undefined;
}
//# sourceMappingURL=types.d.ts.map