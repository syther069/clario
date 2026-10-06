import type { Bytes32 } from "./identifiers.js";
/**
 * Expense version lifecycle states.
 * DRAFT -> PREPARED -> SUBMITTED -> CURRENT / SUPERSEDED
 */
export declare const EXPENSE_LIFECYCLE_STATES: readonly ["DRAFT", "PREPARED", "SUBMITTED", "CURRENT", "SUPERSEDED"];
export type ExpenseLifecycleState = (typeof EXPENSE_LIFECYCLE_STATES)[number];
/**
 * Decision lifecycle states.
 * NONE -> APPROVED | REJECTED | CHANGES_REQUESTED
 * APPROVED + material edit -> HISTORICAL_APPROVAL + REAPPROVAL_REQUIRED
 */
export declare const DECISION_LIFECYCLE_STATES: readonly ["NONE", "APPROVED", "REJECTED", "CHANGES_REQUESTED", "HISTORICAL_APPROVAL", "REAPPROVAL_REQUIRED"];
export type DecisionLifecycleState = (typeof DECISION_LIFECYCLE_STATES)[number];
/**
 * Settlement lifecycle states.
 */
export declare const SETTLEMENT_LIFECYCLE_STATES: readonly ["UNSETTLED", "PREPARING", "AWAITING_SIGNATURE", "SETTLEMENT_SUBMITTED", "SETTLED", "SETTLEMENT_FAILED"];
export type SettlementLifecycleState = (typeof SETTLEMENT_LIFECYCLE_STATES)[number];
/**
 * Transaction submission and confirmation lifecycle states.
 * INVARIANT: Submitted, confirming, confirmed, and indexed states must remain distinct.
 * Never collapse them into a single generic success state.
 */
export declare const TRANSACTION_LIFECYCLE_STATES: readonly ["PREPARING", "AWAITING_SIGNATURE", "CANCELLED", "SUBMITTED", "CONFIRMING", "CONFIRMED", "INDEXED", "FAILED", "REPLACED", "REORGED"];
export type TransactionLifecycleState = (typeof TRANSACTION_LIFECYCLE_STATES)[number];
/**
 * Independent verification result states.
 */
export declare const VERIFICATION_RESULTS: readonly ["VERIFIED", "VERIFIED_WITH_WARNINGS", "FAILED", "UNVERIFIABLE"];
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];
/**
 * Supported workspace roles.
 * Governed by RULES.md section 8.
 */
export declare const WORKSPACE_ROLES: readonly ["OWNER_ROLE", "ADMIN_ROLE", "APPROVER_ROLE", "TREASURY_ROLE", "AUDITOR_ROLE"];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
/**
 * Standard 32-byte role identifiers computed as keccak256(roleString).
 */
export declare const ROLE_IDENTIFIERS: Record<WorkspaceRole, Bytes32>;
/**
 * Onchain decision enum matching Solidity IClarioRegistry.Decision.
 */
export declare enum OnchainDecision {
    None = 0,
    Approve = 1,
    Reject = 2,
    RequestChanges = 3
}
/**
 * Compile-time exhaustiveness assertion.
 * If a switch or if-else does not handle every union member, TypeScript will error at build time.
 */
export declare function assertNever(value: never, message?: string): never;
export declare function parseExpenseLifecycleState(val: unknown): ExpenseLifecycleState;
export declare function parseDecisionLifecycleState(val: unknown): DecisionLifecycleState;
export declare function parseSettlementLifecycleState(val: unknown): SettlementLifecycleState;
export declare function parseTransactionLifecycleState(val: unknown): TransactionLifecycleState;
export declare function parseVerificationResult(val: unknown): VerificationResult;
export declare function parseWorkspaceRole(val: unknown): WorkspaceRole;
export declare function parseOnchainDecision(val: unknown): OnchainDecision;
//# sourceMappingURL=lifecycle.d.ts.map