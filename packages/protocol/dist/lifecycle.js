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
];
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
];
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
];
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
];
/**
 * Independent verification result states.
 */
export const VERIFICATION_RESULTS = [
    "VERIFIED",
    "VERIFIED_WITH_WARNINGS",
    "FAILED",
    "UNVERIFIABLE",
];
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
];
/**
 * Standard 32-byte role identifiers computed as keccak256(roleString).
 */
export const ROLE_IDENTIFIERS = {
    OWNER_ROLE: "0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e",
    ADMIN_ROLE: "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775",
    APPROVER_ROLE: "0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf",
    TREASURY_ROLE: "0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9",
    AUDITOR_ROLE: "0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5",
};
/**
 * Onchain decision enum matching Solidity IClarioRegistry.Decision.
 */
export var OnchainDecision;
(function (OnchainDecision) {
    OnchainDecision[OnchainDecision["None"] = 0] = "None";
    OnchainDecision[OnchainDecision["Approve"] = 1] = "Approve";
    OnchainDecision[OnchainDecision["Reject"] = 2] = "Reject";
    OnchainDecision[OnchainDecision["RequestChanges"] = 3] = "RequestChanges";
})(OnchainDecision || (OnchainDecision = {}));
/**
 * Compile-time exhaustiveness assertion.
 * If a switch or if-else does not handle every union member, TypeScript will error at build time.
 */
export function assertNever(value, message = "Unexpected unreachable value encountered in exhaustive match") {
    throw new Error(`${message}: ${String(value)}`);
}
function parseEnumMember(val, allowed, typeName) {
    if (typeof val !== "string" || !allowed.includes(val)) {
        throw new Error(`Invalid ${typeName}: '${String(val)}' is not one of: ${allowed.join(", ")}.`);
    }
    return val;
}
export function parseExpenseLifecycleState(val) {
    return parseEnumMember(val, EXPENSE_LIFECYCLE_STATES, "ExpenseLifecycleState");
}
export function parseDecisionLifecycleState(val) {
    return parseEnumMember(val, DECISION_LIFECYCLE_STATES, "DecisionLifecycleState");
}
export function parseSettlementLifecycleState(val) {
    return parseEnumMember(val, SETTLEMENT_LIFECYCLE_STATES, "SettlementLifecycleState");
}
export function parseTransactionLifecycleState(val) {
    return parseEnumMember(val, TRANSACTION_LIFECYCLE_STATES, "TransactionLifecycleState");
}
export function parseVerificationResult(val) {
    return parseEnumMember(val, VERIFICATION_RESULTS, "VerificationResult");
}
export function parseWorkspaceRole(val) {
    return parseEnumMember(val, WORKSPACE_ROLES, "WorkspaceRole");
}
export function parseOnchainDecision(val) {
    if (typeof val === "number" &&
        Number.isInteger(val) &&
        val >= 0 &&
        val <= 3) {
        return val;
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
    throw new Error(`Invalid OnchainDecision: '${String(val)}' is not a valid decision value (0=None, 1=Approve, 2=Reject, 3=RequestChanges).`);
}
//# sourceMappingURL=lifecycle.js.map