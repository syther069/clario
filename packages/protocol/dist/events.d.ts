import { type Bytes32, type CommitmentHash, type EvmAddress, type ExpenseId, type ExpenseVersion, type PaymentReference, type PolicyCommitment, type PolicyVersion, type WorkspaceId } from "./identifiers.js";
import { OnchainDecision } from "./lifecycle.js";
/**
 * Base log provenance identifying a specific onchain event on Monad.
 */
export interface EventLogProvenance {
    readonly blockNumber: bigint;
    readonly transactionHash: Bytes32;
    readonly logIndex: number;
}
/**
 * Event: WorkspaceCreated(bytes32 indexed workspaceId, address indexed owner, bytes32 policyCommitment)
 */
export interface WorkspaceCreatedEvent extends EventLogProvenance {
    readonly eventName: "WorkspaceCreated";
    readonly workspaceId: WorkspaceId;
    readonly owner: EvmAddress;
    readonly policyCommitment: PolicyCommitment;
}
/**
 * Event: RoleGranted(bytes32 indexed workspaceId, address indexed account, bytes32 indexed role, bytes32 scope)
 */
export interface RoleGrantedEvent extends EventLogProvenance {
    readonly eventName: "RoleGranted";
    readonly workspaceId: WorkspaceId;
    readonly account: EvmAddress;
    readonly role: Bytes32;
    readonly scope: Bytes32;
}
/**
 * Event: RoleRevoked(bytes32 indexed workspaceId, address indexed account, bytes32 indexed role, bytes32 scope)
 */
export interface RoleRevokedEvent extends EventLogProvenance {
    readonly eventName: "RoleRevoked";
    readonly workspaceId: WorkspaceId;
    readonly account: EvmAddress;
    readonly role: Bytes32;
    readonly scope: Bytes32;
}
/**
 * Event: PolicyUpdated(bytes32 indexed workspaceId, uint32 policyVersion, bytes32 policyCommitment)
 */
export interface PolicyUpdatedEvent extends EventLogProvenance {
    readonly eventName: "PolicyUpdated";
    readonly workspaceId: WorkspaceId;
    readonly policyVersion: PolicyVersion;
    readonly policyCommitment: PolicyCommitment;
}
/**
 * Event: ExpenseVersionSubmitted(bytes32 indexed workspaceId, bytes32 indexed expenseId, uint32 indexed version, bytes32 commitment, address submitter)
 */
export interface ExpenseVersionSubmittedEvent extends EventLogProvenance {
    readonly eventName: "ExpenseVersionSubmitted";
    readonly workspaceId: WorkspaceId;
    readonly expenseId: ExpenseId;
    readonly version: ExpenseVersion;
    readonly commitment: CommitmentHash;
    readonly submitter: EvmAddress;
}
/**
 * Event: ExpenseVersionSuperseded(bytes32 indexed workspaceId, bytes32 indexed expenseId, uint32 oldVersion, uint32 newVersion)
 */
export interface ExpenseVersionSupersededEvent extends EventLogProvenance {
    readonly eventName: "ExpenseVersionSuperseded";
    readonly workspaceId: WorkspaceId;
    readonly expenseId: ExpenseId;
    readonly oldVersion: ExpenseVersion;
    readonly newVersion: ExpenseVersion;
}
/**
 * Event: DecisionRecorded(bytes32 indexed workspaceId, bytes32 indexed expenseId, uint32 indexed version, bytes32 commitment, address reviewer, uint8 decision, bytes32 reasonCommitment)
 */
export interface DecisionRecordedEvent extends EventLogProvenance {
    readonly eventName: "DecisionRecorded";
    readonly workspaceId: WorkspaceId;
    readonly expenseId: ExpenseId;
    readonly version: ExpenseVersion;
    readonly commitment: CommitmentHash;
    readonly reviewer: EvmAddress;
    readonly decision: OnchainDecision;
    readonly reasonCommitment: Bytes32;
}
/**
 * Event: SettlementRecorded(bytes32 indexed workspaceId, bytes32 indexed expenseId, uint32 indexed version, bytes32 commitment, address token, address recipient, uint256 amount, bytes32 paymentReference)
 */
export interface SettlementRecordedEvent extends EventLogProvenance {
    readonly eventName: "SettlementRecorded";
    readonly workspaceId: WorkspaceId;
    readonly expenseId: ExpenseId;
    readonly version: ExpenseVersion;
    readonly commitment: CommitmentHash;
    readonly token: EvmAddress;
    readonly recipient: EvmAddress;
    readonly amount: bigint;
    readonly paymentReference: PaymentReference;
}
export type ClarioPublicEvent = WorkspaceCreatedEvent | RoleGrantedEvent | RoleRevokedEvent | PolicyUpdatedEvent | ExpenseVersionSubmittedEvent | ExpenseVersionSupersededEvent | DecisionRecordedEvent | SettlementRecordedEvent;
export declare function parseLogProvenance(raw: unknown): EventLogProvenance;
export declare function parseWorkspaceCreatedEvent(raw: Record<string, unknown>): WorkspaceCreatedEvent;
export declare function parseRoleGrantedEvent(raw: Record<string, unknown>): RoleGrantedEvent;
export declare function parseRoleRevokedEvent(raw: Record<string, unknown>): RoleRevokedEvent;
export declare function parsePolicyUpdatedEvent(raw: Record<string, unknown>): PolicyUpdatedEvent;
export declare function parseExpenseVersionSubmittedEvent(raw: Record<string, unknown>): ExpenseVersionSubmittedEvent;
export declare function parseExpenseVersionSupersededEvent(raw: Record<string, unknown>): ExpenseVersionSupersededEvent;
export declare function parseDecisionRecordedEvent(raw: Record<string, unknown>): DecisionRecordedEvent;
export declare function parseSettlementRecordedEvent(raw: Record<string, unknown>): SettlementRecordedEvent;
//# sourceMappingURL=events.d.ts.map