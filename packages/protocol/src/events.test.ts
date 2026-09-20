import { describe, expect, it } from "vitest";
import {
  type DecisionRecordedEvent,
  type ExpenseVersionSubmittedEvent,
  type ExpenseVersionSupersededEvent,
  type PolicyUpdatedEvent,
  type RoleGrantedEvent,
  type RoleRevokedEvent,
  type SettlementRecordedEvent,
  type WorkspaceCreatedEvent,
  parseDecisionRecordedEvent,
  parseExpenseVersionSubmittedEvent,
  parseExpenseVersionSupersededEvent,
  parseLogProvenance,
  parsePolicyUpdatedEvent,
  parseRoleGrantedEvent,
  parseRoleRevokedEvent,
  parseSettlementRecordedEvent,
  parseWorkspaceCreatedEvent,
} from "./events.js";
import { OnchainDecision } from "./lifecycle.js";

describe("Public Event Payloads and Provenance", () => {
  const hex32A =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hex32B =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const addressA = "0x1111111111111111111111111111111111111111";
  const addressB = "0x2222222222222222222222222222222222222222";

  const baseProvenance = {
    blockNumber: 123456,
    transactionHash: hex32A,
    logIndex: 2,
  };

  it("parses valid LogProvenance", () => {
    const parsed = parseLogProvenance(baseProvenance);
    expect(parsed.transactionHash).toBe(hex32A);
    expect(parsed.blockNumber).toBe(123456n);
    expect(parsed.logIndex).toBe(2);
  });

  it("rejects invalid LogProvenance", () => {
    expect(() =>
      parseLogProvenance({
        transactionHash: "bad",
        blockNumber: 123,
        logIndex: 0,
      }),
    ).toThrow();

    expect(() =>
      parseLogProvenance({
        transactionHash: hex32A,
        blockNumber: -1,
        logIndex: 0,
      }),
    ).toThrow();
  });

  it("parses WorkspaceCreatedEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      owner: addressA,
      policyCommitment: hex32B,
    };
    const parsed: WorkspaceCreatedEvent = parseWorkspaceCreatedEvent(raw);
    expect(parsed.eventName).toBe("WorkspaceCreated");
    expect(parsed.workspaceId).toBe(hex32A);
    expect(parsed.owner).toBe(addressA);
    expect(parsed.policyCommitment).toBe(hex32B);
  });

  it("parses RoleGrantedEvent and RoleRevokedEvent", () => {
    const grantedRaw = {
      ...baseProvenance,
      workspaceId: hex32A,
      account: addressA,
      role: hex32B,
      scope: hex32A,
    };
    const granted: RoleGrantedEvent = parseRoleGrantedEvent(grantedRaw);
    expect(granted.eventName).toBe("RoleGranted");
    expect(granted.account).toBe(addressA);

    const revoked: RoleRevokedEvent = parseRoleRevokedEvent(grantedRaw);
    expect(revoked.eventName).toBe("RoleRevoked");
    expect(revoked.account).toBe(addressA);
  });

  it("parses PolicyUpdatedEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      policyVersion: 2,
      policyCommitment: hex32B,
    };
    const parsed: PolicyUpdatedEvent = parsePolicyUpdatedEvent(raw);
    expect(parsed.eventName).toBe("PolicyUpdated");
    expect(parsed.policyVersion).toBe(2);
  });

  it("parses ExpenseVersionSubmittedEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      expenseId: hex32B,
      version: 1,
      commitment: hex32A,
      submitter: addressA,
    };
    const parsed: ExpenseVersionSubmittedEvent =
      parseExpenseVersionSubmittedEvent(raw);
    expect(parsed.eventName).toBe("ExpenseVersionSubmitted");
    expect(parsed.version).toBe(1);
    expect(parsed.submitter).toBe(addressA);
  });

  it("parses ExpenseVersionSupersededEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      expenseId: hex32B,
      oldVersion: 1,
      newVersion: 2,
    };
    const parsed: ExpenseVersionSupersededEvent =
      parseExpenseVersionSupersededEvent(raw);
    expect(parsed.eventName).toBe("ExpenseVersionSuperseded");
    expect(parsed.oldVersion).toBe(1);
    expect(parsed.newVersion).toBe(2);
  });

  it("rejects ExpenseVersionSupersededEvent when newVersion <= oldVersion", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      expenseId: hex32B,
      oldVersion: 2,
      newVersion: 1,
    };
    expect(() => parseExpenseVersionSupersededEvent(raw)).toThrow(
      "newVersion must be greater than oldVersion",
    );
  });

  it("parses DecisionRecordedEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      expenseId: hex32B,
      version: 1,
      commitment: hex32A,
      reviewer: addressA,
      decision: OnchainDecision.Approve,
      reasonCommitment: hex32B,
    };
    const parsed: DecisionRecordedEvent = parseDecisionRecordedEvent(raw);
    expect(parsed.eventName).toBe("DecisionRecorded");
    expect(parsed.decision).toBe(OnchainDecision.Approve);
    expect(parsed.reviewer).toBe(addressA);
  });

  it("parses SettlementRecordedEvent", () => {
    const raw = {
      ...baseProvenance,
      workspaceId: hex32A,
      expenseId: hex32B,
      version: 1,
      commitment: hex32A,
      token: addressA,
      recipient: addressB,
      amount: "10000000",
      paymentReference: hex32B,
    };
    const parsed: SettlementRecordedEvent = parseSettlementRecordedEvent(raw);
    expect(parsed.eventName).toBe("SettlementRecorded");
    expect(parsed.amount).toBe(10000000n);
    expect(parsed.recipient).toBe(addressB);
  });

  it("ensures public event payloads contain no private fields", () => {
    const privateFieldKeys = [
      "merchant",
      "merchantName",
      "purpose",
      "receiptUrl",
      "email",
      "invoiceId",
      "filename",
      "notes",
      "salt",
      "evidenceBytes",
      "privateRecord",
    ];

    const payloads: object[] = [
      parseWorkspaceCreatedEvent({
        ...baseProvenance,
        workspaceId: hex32A,
        owner: addressA,
        policyCommitment: hex32B,
      }),
      parseExpenseVersionSubmittedEvent({
        ...baseProvenance,
        workspaceId: hex32A,
        expenseId: hex32B,
        version: 1,
        commitment: hex32A,
        submitter: addressA,
      }),
      parseDecisionRecordedEvent({
        ...baseProvenance,
        workspaceId: hex32A,
        expenseId: hex32B,
        version: 1,
        commitment: hex32A,
        reviewer: addressA,
        decision: OnchainDecision.Approve,
        reasonCommitment: hex32B,
      }),
      parseSettlementRecordedEvent({
        ...baseProvenance,
        workspaceId: hex32A,
        expenseId: hex32B,
        version: 1,
        commitment: hex32A,
        token: addressA,
        recipient: addressB,
        amount: 100n,
        paymentReference: hex32B,
      }),
    ];

    for (const p of payloads) {
      for (const field of privateFieldKeys) {
        expect(p).not.toHaveProperty(field);
      }
    }
  });
});
