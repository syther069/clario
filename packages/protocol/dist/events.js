import { parseBytes32, parseCommitmentHash, parseEvmAddress, parseExpenseId, parseExpenseVersion, parsePaymentReference, parsePolicyCommitment, parsePolicyVersion, parseWorkspaceId, } from "./identifiers.js";
import { parseOnchainDecision } from "./lifecycle.js";
export function parseLogProvenance(raw) {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("raw log provenance must be an object.");
    }
    const obj = raw;
    const blockNumber = BigInt(obj.blockNumber);
    if (blockNumber < 0n) {
        throw new Error("blockNumber must be non-negative.");
    }
    const transactionHash = parseBytes32(obj.transactionHash);
    const logIndex = Number(obj.logIndex);
    if (!Number.isInteger(logIndex) || logIndex < 0) {
        throw new Error("logIndex must be a non-negative integer.");
    }
    return { blockNumber, transactionHash, logIndex };
}
export function parseWorkspaceCreatedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "WorkspaceCreated",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        owner: parseEvmAddress(raw.owner),
        policyCommitment: parsePolicyCommitment(raw.policyCommitment),
    };
}
export function parseRoleGrantedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "RoleGranted",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        account: parseEvmAddress(raw.account),
        role: parseBytes32(raw.role),
        scope: parseBytes32(raw.scope),
    };
}
export function parseRoleRevokedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "RoleRevoked",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        account: parseEvmAddress(raw.account),
        role: parseBytes32(raw.role),
        scope: parseBytes32(raw.scope),
    };
}
export function parsePolicyUpdatedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "PolicyUpdated",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        policyVersion: parsePolicyVersion(raw.policyVersion),
        policyCommitment: parsePolicyCommitment(raw.policyCommitment),
    };
}
export function parseExpenseVersionSubmittedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "ExpenseVersionSubmitted",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        expenseId: parseExpenseId(raw.expenseId),
        version: parseExpenseVersion(raw.version),
        commitment: parseCommitmentHash(raw.commitment),
        submitter: parseEvmAddress(raw.submitter),
    };
}
export function parseExpenseVersionSupersededEvent(raw) {
    const prov = parseLogProvenance(raw);
    const oldVersion = parseExpenseVersion(raw.oldVersion);
    const newVersion = parseExpenseVersion(raw.newVersion);
    if (newVersion <= oldVersion) {
        throw new Error("newVersion must be greater than oldVersion.");
    }
    return {
        ...prov,
        eventName: "ExpenseVersionSuperseded",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        expenseId: parseExpenseId(raw.expenseId),
        oldVersion,
        newVersion,
    };
}
export function parseDecisionRecordedEvent(raw) {
    const prov = parseLogProvenance(raw);
    return {
        ...prov,
        eventName: "DecisionRecorded",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        expenseId: parseExpenseId(raw.expenseId),
        version: parseExpenseVersion(raw.version),
        commitment: parseCommitmentHash(raw.commitment),
        reviewer: parseEvmAddress(raw.reviewer),
        decision: parseOnchainDecision(raw.decision),
        reasonCommitment: parseBytes32(raw.reasonCommitment),
    };
}
export function parseSettlementRecordedEvent(raw) {
    const prov = parseLogProvenance(raw);
    const amount = BigInt(raw.amount);
    if (amount < 0n) {
        throw new Error("amount must be non-negative.");
    }
    return {
        ...prov,
        eventName: "SettlementRecorded",
        workspaceId: parseWorkspaceId(raw.workspaceId),
        expenseId: parseExpenseId(raw.expenseId),
        version: parseExpenseVersion(raw.version),
        commitment: parseCommitmentHash(raw.commitment),
        token: parseEvmAddress(raw.token),
        recipient: parseEvmAddress(raw.recipient),
        amount,
        paymentReference: parsePaymentReference(raw.paymentReference),
    };
}
//# sourceMappingURL=events.js.map