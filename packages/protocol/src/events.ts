import {
  parseBytes32,
  parseCommitmentHash,
  parseEvmAddress,
  parseExpenseId,
  parseExpenseVersion,
  parsePaymentReference,
  parsePolicyCommitment,
  parsePolicyVersion,
  parseWorkspaceId,
  type Bytes32,
  type CommitmentHash,
  type EvmAddress,
  type ExpenseId,
  type ExpenseVersion,
  type PaymentReference,
  type PolicyCommitment,
  type PolicyVersion,
  type WorkspaceId,
} from "./identifiers.js";
import { OnchainDecision, parseOnchainDecision } from "./lifecycle.js";

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

export type ClarioPublicEvent =
  | WorkspaceCreatedEvent
  | RoleGrantedEvent
  | RoleRevokedEvent
  | PolicyUpdatedEvent
  | ExpenseVersionSubmittedEvent
  | ExpenseVersionSupersededEvent
  | DecisionRecordedEvent
  | SettlementRecordedEvent;

export function parseLogProvenance(raw: unknown): EventLogProvenance {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("raw log provenance must be an object.");
  }
  const obj = raw as Record<string, unknown>;
  const blockNumber = BigInt(obj.blockNumber as string | number | bigint);
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

export function parseWorkspaceCreatedEvent(
  raw: Record<string, unknown>,
): WorkspaceCreatedEvent {
  const prov = parseLogProvenance(raw);
  return {
    ...prov,
    eventName: "WorkspaceCreated",
    workspaceId: parseWorkspaceId(raw.workspaceId),
    owner: parseEvmAddress(raw.owner),
    policyCommitment: parsePolicyCommitment(raw.policyCommitment),
  };
}

export function parseRoleGrantedEvent(
  raw: Record<string, unknown>,
): RoleGrantedEvent {
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

export function parseRoleRevokedEvent(
  raw: Record<string, unknown>,
): RoleRevokedEvent {
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

export function parsePolicyUpdatedEvent(
  raw: Record<string, unknown>,
): PolicyUpdatedEvent {
  const prov = parseLogProvenance(raw);
  return {
    ...prov,
    eventName: "PolicyUpdated",
    workspaceId: parseWorkspaceId(raw.workspaceId),
    policyVersion: parsePolicyVersion(raw.policyVersion),
    policyCommitment: parsePolicyCommitment(raw.policyCommitment),
  };
}

export function parseExpenseVersionSubmittedEvent(
  raw: Record<string, unknown>,
): ExpenseVersionSubmittedEvent {
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

export function parseExpenseVersionSupersededEvent(
  raw: Record<string, unknown>,
): ExpenseVersionSupersededEvent {
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

export function parseDecisionRecordedEvent(
  raw: Record<string, unknown>,
): DecisionRecordedEvent {
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

export function parseSettlementRecordedEvent(
  raw: Record<string, unknown>,
): SettlementRecordedEvent {
  const prov = parseLogProvenance(raw);
  const amount = BigInt(raw.amount as string | number | bigint);
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
