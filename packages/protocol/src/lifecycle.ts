import type { Bytes32 } from "./identifiers.js";

/**
 * Expense version lifecycle states.
 * DRAFT -> PREPARED -> SUBMITTED -> CURRENT / SUPERSEDED
 */
export const EXPENSE_LIFECYCLE_STATES = [
  "DRAFT",
  "PREPARED",
  "SUBMITTED",
  "CURRENT",
  "SUPERSEDED",
] as const;
export type ExpenseLifecycleState = (typeof EXPENSE_LIFECYCLE_STATES)[number];

/**
 * Decision lifecycle states.
 * NONE -> APPROVED | REJECTED | CHANGES_REQUESTED
 * APPROVED + material edit -> HISTORICAL_APPROVAL + REAPPROVAL_REQUIRED
 */
export const DECISION_LIFECYCLE_STATES = [
  "NONE",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "HISTORICAL_APPROVAL",
  "REAPPROVAL_REQUIRED",
] as const;
export type DecisionLifecycleState = (typeof DECISION_LIFECYCLE_STATES)[number];

/**
 * Settlement lifecycle states.
 */
export const SETTLEMENT_LIFECYCLE_STATES = [
  "UNSETTLED",
  "PREPARING",
  "AWAITING_SIGNATURE",
  "SETTLEMENT_SUBMITTED",
  "SETTLED",
  "SETTLEMENT_FAILED",
] as const;
export type SettlementLifecycleState =
  (typeof SETTLEMENT_LIFECYCLE_STATES)[number];

/**
 * Transaction submission and confirmation lifecycle states.
 * INVARIANT: Submitted, confirming, confirmed, and indexed states must remain distinct.
 * Never collapse them into a single generic success state.
 */
export const TRANSACTION_LIFECYCLE_STATES = [
  "PREPARING",
  "AWAITING_SIGNATURE",
  "CANCELLED",
  "SUBMITTED",
  "CONFIRMING",
  "CONFIRMED",
  "INDEXED",
  "FAILED",
  "REPLACED",
  "REORGED",
] as const;
export type TransactionLifecycleState =
  (typeof TRANSACTION_LIFECYCLE_STATES)[number];

/**
 * Independent verification result states.
 */
export const VERIFICATION_RESULTS = [
  "VERIFIED",
  "VERIFIED_WITH_WARNINGS",
  "FAILED",
  "UNVERIFIABLE",
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/**
 * Supported workspace roles.
 * Governed by RULES.md section 8.
 */
export const WORKSPACE_ROLES = [
  "OWNER_ROLE",
  "ADMIN_ROLE",
  "APPROVER_ROLE",
  "TREASURY_ROLE",
  "AUDITOR_ROLE",
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * Standard 32-byte role identifiers computed as keccak256(roleString).
 */
export const ROLE_IDENTIFIERS: Record<WorkspaceRole, Bytes32> = {
  OWNER_ROLE:
    "0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e" as Bytes32,
  ADMIN_ROLE:
    "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as Bytes32,
  APPROVER_ROLE:
    "0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf" as Bytes32,
  TREASURY_ROLE:
    "0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9" as Bytes32,
  AUDITOR_ROLE:
    "0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5" as Bytes32,
};

/**
 * Onchain decision enum matching Solidity IClarioRegistry.Decision.
 */
export enum OnchainDecision {
  None = 0,
  Approve = 1,
  Reject = 2,
  RequestChanges = 3,
}

/**
 * Compile-time exhaustiveness assertion.
 * If a switch or if-else does not handle every union member, TypeScript will error at build time.
 */
export function assertNever(
  value: never,
  message = "Unexpected unreachable value encountered in exhaustive match",
): never {
  throw new Error(`${message}: ${String(value)}`);
}

function parseEnumMember<T extends string>(
  val: unknown,
  allowed: readonly T[],
  typeName: string,
): T {
  if (typeof val !== "string" || !allowed.includes(val as T)) {
    throw new Error(
      `Invalid ${typeName}: '${String(val)}' is not one of: ${allowed.join(", ")}.`,
    );
  }
  return val as T;
}

export function parseExpenseLifecycleState(
  val: unknown,
): ExpenseLifecycleState {
  return parseEnumMember(
    val,
    EXPENSE_LIFECYCLE_STATES,
    "ExpenseLifecycleState",
  );
}

export function parseDecisionLifecycleState(
  val: unknown,
): DecisionLifecycleState {
  return parseEnumMember(
    val,
    DECISION_LIFECYCLE_STATES,
    "DecisionLifecycleState",
  );
}

export function parseSettlementLifecycleState(
  val: unknown,
): SettlementLifecycleState {
  return parseEnumMember(
    val,
    SETTLEMENT_LIFECYCLE_STATES,
    "SettlementLifecycleState",
  );
}

export function parseTransactionLifecycleState(
  val: unknown,
): TransactionLifecycleState {
  return parseEnumMember(
    val,
    TRANSACTION_LIFECYCLE_STATES,
    "TransactionLifecycleState",
  );
}

export function parseVerificationResult(val: unknown): VerificationResult {
  return parseEnumMember(val, VERIFICATION_RESULTS, "VerificationResult");
}

export function parseWorkspaceRole(val: unknown): WorkspaceRole {
  return parseEnumMember(val, WORKSPACE_ROLES, "WorkspaceRole");
}

export function parseOnchainDecision(val: unknown): OnchainDecision {
  if (
    typeof val === "number" &&
    Number.isInteger(val) &&
    val >= 0 &&
    val <= 3
  ) {
    return val as OnchainDecision;
  }
  if (typeof val === "string") {
    switch (val) {
      case "None":
      case "0":
        return OnchainDecision.None;
      case "Approve":
      case "1":
        return OnchainDecision.Approve;
      case "Reject":
      case "2":
        return OnchainDecision.Reject;
      case "RequestChanges":
      case "3":
        return OnchainDecision.RequestChanges;
    }
  }
  throw new Error(
    `Invalid OnchainDecision: '${String(val)}' is not a valid decision value (0=None, 1=Approve, 2=Reject, 3=RequestChanges).`,
  );
}
