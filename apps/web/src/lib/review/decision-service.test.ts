import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { ReviewDecisionService } from "./decision-service";
import { GLOBAL_SCOPE, type AuthContext } from "../auth/policy";
import { createSessionPayload } from "../auth/session";
import {
  generateDataEncryptionKey,
  wrapKey,
  encryptEvidence,
} from "../evidence/crypto";
import { getEvidenceKek } from "../evidence/service";

function encryptTestPayload(
  workspaceId: string,
  expenseId: string,
  version: number,
  payload: Record<string, unknown>,
): { recordCiphertext: string; saltCiphertext: string } {
  const kek = getEvidenceKek();
  const dek = generateDataEncryptionKey();
  const wrapResult = wrapKey(dek, kek, "kek-v1");

  const recordContext = {
    workspaceId: workspaceId.toLowerCase(),
    expenseId: expenseId.toLowerCase(),
    version,
    evidenceId: "draft_record",
  };
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encRecord = encryptEvidence(plaintext, dek, recordContext);

  const recordEnvelope = {
    ciphertext: encRecord.ciphertext.toString("hex"),
    iv: encRecord.iv.toString("hex"),
    authTag: encRecord.authTag.toString("hex"),
    wrappedKey: wrapResult.wrappedKey.toString("hex"),
    keyId: wrapResult.keyId,
    kekIv: wrapResult.iv.toString("hex"),
    kekAuthTag: wrapResult.authTag.toString("hex"),
  };

  const saltContext = {
    workspaceId: workspaceId.toLowerCase(),
    expenseId: expenseId.toLowerCase(),
    version,
    evidenceId: "draft_salt",
  };
  const encSalt = encryptEvidence(Buffer.alloc(32), dek, saltContext);
  const saltEnvelope = {
    ciphertext: encSalt.ciphertext.toString("hex"),
    iv: encSalt.iv.toString("hex"),
    authTag: encSalt.authTag.toString("hex"),
  };

  return {
    recordCiphertext: JSON.stringify(recordEnvelope),
    saltCiphertext: JSON.stringify(saltEnvelope),
  };
}

class MockDecisionDatabase implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    created_by: string;
    name: string;
  }> = [];

  memberships: Array<{
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: "active" | "suspended" | "revoked";
  }> = [];

  roleGrants: Array<{
    grant_id: string;
    workspace_id: string;
    address: string;
    role: string;
    scope: string;
    revoked_at: Date | null;
  }> = [];

  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number;
    created_at: string;
    updated_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
    commitment: string;
    previous_commitment: string | null;
    record_ciphertext: string;
    salt_ciphertext: string;
    submitted_at: string | null;
    submitted_by: string | null;
    amount: string;
    currency: string;
    recipient: string;
  }> = [];

  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    storage_key: string;
    sha256_hash: string;
    byte_length: number;
    mime_type: string;
    encryption_metadata: string;
    created_at: string;
  }> = [];

  decisions: Array<{
    decision_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    decision_type: "approve" | "reject" | "request_changes";
    reviewer_address: string;
    reason_commitment: string | null;
    policy_version: number;
    nonce: number;
    signature: string | null;
    transaction_hash: string | null;
    recorded_at: string;
  }> = [];

  chainTransactions: Array<{
    workspace_id: string;
    chain_id: number;
    transaction_hash: string;
    action: string;
    status: string;
  }> = [];

  auditEvents: Array<{
    workspace_id: string;
    actor_address: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    // Workspaces
    if (sql.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Memberships
    if (sql.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.user_id === params[1] ||
            m.address.toLowerCase() === String(params[2] ?? "").toLowerCase()),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Role Grants
    if (sql.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Workspace policies
    if (sql.includes("FROM workspace_policies")) {
      return {
        rows: [{ policy_version: 1 }] as unknown as T[],
        rowCount: 1,
      };
    }

    // Nonce count
    if (
      sql.includes(
        "SELECT COUNT(*) as count FROM decisions WHERE reviewer_address = $1",
      )
    ) {
      const reviewer = String(params[0] ?? "").toLowerCase();
      const count = this.decisions.filter(
        (d) =>
          d.reviewer_address.toLowerCase() === reviewer && d.signature !== null,
      ).length;
      return {
        rows: [{ count: count.toString() }] as unknown as T[],
        rowCount: 1,
      };
    }

    // Decisions check for version
    if (sql.includes("FROM decisions") && sql.includes("version = $3")) {
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === params[0] &&
          d.expense_id === params[1] &&
          d.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses query
    if (sql.includes("SELECT created_by, current_version FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expense versions query (matches both prepare, reconcile, and createSuccessorDraft)
    if (sql.includes("FROM expense_versions") && sql.includes("version = $3")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // INSERT into decisions
    if (sql.includes("INSERT INTO decisions")) {
      this.decisions.push({
        decision_id: String(params[0]),
        workspace_id: String(params[1]),
        expense_id: String(params[2]),
        version: Number(params[3]),
        commitment: String(params[4]),
        decision_type: params[5] as "approve" | "reject" | "request_changes",
        reviewer_address: String(params[6]),
        reason_commitment: (params[7] as string) ?? null,
        policy_version: Number(params[8]),
        nonce: Number(params[9]),
        signature: (params[10] as string) ?? null,
        transaction_hash: (params[11] as string) ?? null,
        recorded_at: String(params[12]),
      });
      return { rows: [], rowCount: 1 };
    }

    // UPDATE expense_versions status = 'current'
    if (
      sql.includes("UPDATE expense_versions") &&
      sql.includes("status = 'current'")
    ) {
      const target = this.expenseVersions.find(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === Number(params[2]),
      );
      if (target) target.status = "current";
      return { rows: [], rowCount: 1 };
    }

    // UPDATE expense_versions status = 'superseded'
    if (
      sql.includes("UPDATE expense_versions") &&
      sql.includes("status = 'superseded'")
    ) {
      for (const v of this.expenseVersions) {
        if (
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version <= Number(params[2]) &&
          v.status !== "superseded"
        ) {
          v.status = "superseded";
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // INSERT into expense_versions
    if (sql.includes("INSERT INTO expense_versions")) {
      this.expenseVersions.push({
        workspace_id: String(params[0]),
        expense_id: String(params[1]),
        version: Number(params[2]),
        commitment: String(params[3]),
        previous_commitment: (params[4] as string) ?? null,
        salt_ciphertext: String(params[5]),
        record_ciphertext: String(params[6]),
        amount: String(params[7]),
        currency: String(params[8]),
        recipient: String(params[9]),
        status: "draft",
        submitted_at: null,
        submitted_by: null,
      });
      return { rows: [], rowCount: 1 };
    }

    // Copy evidence objects
    if (
      sql.includes("INSERT INTO evidence_objects") &&
      sql.includes("SELECT")
    ) {
      const nextVer = Number(params[0]);
      const prevObjs = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[1] &&
          eo.expense_id === params[2] &&
          eo.version === Number(params[3]),
      );
      for (const eo of prevObjs) {
        this.evidenceObjects.push({
          ...eo,
          evidence_id: `copy_${eo.evidence_id}`,
          version: nextVer,
        });
      }
      return { rows: [], rowCount: prevObjs.length };
    }

    // UPDATE expenses current_version
    if (
      sql.includes("UPDATE expenses") &&
      sql.includes("current_version = $1")
    ) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[1] && e.expense_id === params[2],
      );
      if (exp) exp.current_version = Number(params[0]);
      return { rows: [], rowCount: 1 };
    }

    // Fetch timestamp after version insert
    if (sql.includes("SELECT created_at FROM expense_versions")) {
      return {
        rows: [{ created_at: new Date().toISOString() }] as unknown as T[],
        rowCount: 1,
      };
    }

    // INSERT into chain_transactions
    if (sql.includes("INSERT INTO chain_transactions")) {
      this.chainTransactions.push({
        workspace_id: String(params[0]),
        chain_id: Number(params[1]),
        transaction_hash: String(params[2]),
        action: String(params[3]),
        status: "confirmed",
      });
      return { rows: [], rowCount: 1 };
    }

    // INSERT into audit_events
    if (sql.includes("INSERT INTO audit_events")) {
      this.auditEvents.push({
        workspace_id: String(params[0]),
        actor_address: String(params[1]),
        event_type: String(params[2]),
        entity_type: String(params[3]),
        entity_id: String(params[4]),
        metadata: String(params[5]),
      });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("ReviewDecisionService", () => {
  let mockDb: MockDecisionDatabase;
  let service: ReviewDecisionService;

  const workspaceId = "ws_reviews_v1";
  const expenseId =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const version1Commitment =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  const submitterAddress = "0x1111111111111111111111111111111111111111";
  const approverAddress = "0x2222222222222222222222222222222222222222";
  const unauthorizedAddress = "0x9999999999999999999999999999999999999999";

  const approverContext: AuthContext = {
    userId: "usr_approver",
    address: approverAddress,
    session: createSessionPayload({
      userId: "usr_approver",
      address: approverAddress,
    }),
  };

  const submitterContext: AuthContext = {
    userId: "usr_submitter",
    address: submitterAddress,
    session: createSessionPayload({
      userId: "usr_submitter",
      address: submitterAddress,
    }),
  };

  const unauthorizedContext: AuthContext = {
    userId: "usr_unauthorized",
    address: unauthorizedAddress,
    session: createSessionPayload({
      userId: "usr_unauthorized",
      address: unauthorizedAddress,
    }),
  };

  const validPayload = {
    title: "AWS Cloud Services",
    businessPurpose: "Infrastructure costs",
    category: "hosting",
    project: "Alpha",
    merchant: "Amazon Web Services",
    expenseDate: "2026-09-01",
    claimAmount: "250.00",
    claimAsset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    recipient: submitterAddress,
    paymentSource: "manual",
  };

  beforeEach(() => {
    mockDb = new MockDecisionDatabase();
    service = new ReviewDecisionService(mockDb as unknown as DatabaseClient);

    // Workspace & memberships
    mockDb.workspaces.push({
      workspace_id: workspaceId,
      created_by: approverAddress,
      name: "Review Test Workspace",
    });

    mockDb.memberships.push(
      {
        membership_id: "m_approver",
        workspace_id: workspaceId,
        user_id: "usr_approver",
        address: approverAddress,
        status: "active",
      },
      {
        membership_id: "m_submitter",
        workspace_id: workspaceId,
        user_id: "usr_submitter",
        address: submitterAddress,
        status: "active",
      },
      {
        membership_id: "m_unauth",
        workspace_id: workspaceId,
        user_id: "usr_unauthorized",
        address: unauthorizedAddress,
        status: "active",
      },
    );

    // Role grants: approver has APPROVER_ROLE
    mockDb.roleGrants.push({
      grant_id: "rg_approver",
      workspace_id: workspaceId,
      address: approverAddress,
      role: ROLE_IDENTIFIERS.APPROVER_ROLE,
      scope: GLOBAL_SCOPE,
      revoked_at: null,
    });

    // Expense header
    mockDb.expenses.push({
      workspace_id: workspaceId,
      expense_id: expenseId,
      created_by: submitterAddress,
      current_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Version 1 (submitted)
    const { recordCiphertext, saltCiphertext } = encryptTestPayload(
      workspaceId,
      expenseId,
      1,
      validPayload,
    );

    mockDb.expenseVersions.push({
      workspace_id: workspaceId,
      expense_id: expenseId,
      version: 1,
      status: "submitted",
      commitment: version1Commitment,
      previous_commitment: null,
      record_ciphertext: recordCiphertext,
      salt_ciphertext: saltCiphertext,
      submitted_at: new Date().toISOString(),
      submitted_by: submitterAddress,
      amount: "250000000",
      currency: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      recipient: submitterAddress,
    });

    // Evidence
    mockDb.evidenceObjects.push({
      evidence_id: "eo_invoice_1",
      workspace_id: workspaceId,
      expense_id: expenseId,
      version: 1,
      storage_key: "ev/invoice.pdf",
      sha256_hash: "0xdeadbeef",
      byte_length: 1024,
      mime_type: "application/pdf",
      encryption_metadata: "{}",
      created_at: new Date().toISOString(),
    });
  });

  describe("prepareDecision", () => {
    it("successfully prepares approval intent for authorized reviewer", async () => {
      const prepared = await service.prepareDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "approve",
        context: approverContext,
      });

      expect(prepared.decision).toBe("approve");
      expect(prepared.version).toBe(1);
      expect(prepared.commitment).toBe(version1Commitment);
      expect(prepared.calldata.startsWith("0x")).toBe(true);
      expect(prepared.typedData.primaryType).toBe("ClarioApproval");
    });

    it("prevents self-approval: submitter cannot approve own expense", async () => {
      // Temporarily give submitter APPROVER_ROLE
      mockDb.roleGrants.push({
        grant_id: "rg_submitter_approver",
        workspace_id: workspaceId,
        address: submitterAddress,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      });

      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "approve",
          context: submitterContext,
        }),
      ).rejects.toThrowError(/Self-approval is strictly prohibited/);
    });

    it("rejects caller without APPROVER_ROLE authority", async () => {
      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "approve",
          context: unauthorizedContext,
        }),
      ).rejects.toThrowError(/Caller lacks APPROVER_ROLE or OWNER_ROLE/);
    });

    it("strictly requires human reason when rejecting", async () => {
      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "reject",
          context: approverContext,
        }),
      ).rejects.toThrowError(/strictly required/i);
    });

    it("strictly requires human reason when requesting changes", async () => {
      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "request_changes",
          reason: "   ",
          context: approverContext,
        }),
      ).rejects.toThrowError(/strictly required/i);
    });

    it("fails when targeted version is not current", async () => {
      mockDb.expenses[0]!.current_version = 2;

      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "approve",
          context: approverContext,
        }),
      ).rejects.toThrowError(/not the current version/);
    });

    it("fails when decision is already recorded for that version", async () => {
      mockDb.decisions.push({
        decision_id: "dec_1",
        workspace_id: workspaceId,
        expense_id: expenseId,
        version: 1,
        commitment: version1Commitment,
        decision_type: "approve",
        reviewer_address: approverAddress,
        reason_commitment: null,
        policy_version: 1,
        nonce: 0,
        signature: null,
        transaction_hash: "0x123",
        recorded_at: new Date().toISOString(),
      });

      await expect(
        service.prepareDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "approve",
          context: approverContext,
        }),
      ).rejects.toThrowError(/already been recorded/);
    });
  });

  describe("reconcileDecision", () => {
    const txHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    it("atomically reconciles approval, updates version status, and logs audit event", async () => {
      const result = await service.reconcileDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "approve",
        txHash,
        context: approverContext,
      });

      expect(result.success).toBe(true);
      expect(result.decision).toBe("approve");

      // Version status is updated to 'current'
      expect(mockDb.expenseVersions[0]!.status).toBe("current");

      // Recorded in decisions table
      expect(mockDb.decisions.length).toBe(1);
      expect(mockDb.decisions[0]!.decision_type).toBe("approve");

      // Recorded in chain_transactions
      expect(mockDb.chainTransactions.length).toBe(1);
      expect(mockDb.chainTransactions[0]!.transaction_hash).toBe(txHash);

      // Recorded in audit_events
      expect(mockDb.auditEvents.length).toBe(1);
      expect(mockDb.auditEvents[0]!.event_type).toBe(
        "expense_version_approved",
      );
    });

    it("is idempotent: re-reconciliation with same txHash succeeds gracefully", async () => {
      const first = await service.reconcileDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "approve",
        txHash,
        context: approverContext,
      });

      const second = await service.reconcileDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "approve",
        txHash,
        context: approverContext,
      });

      expect(second.success).toBe(true);
      expect(second.decisionId).toBe(first.decisionId);
    });

    it("fails when decision already recorded with a different transaction hash", async () => {
      await service.reconcileDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "approve",
        txHash,
        context: approverContext,
      });

      const differentTx =
        "0x2222222222222222222222222222222222222222222222222222222222222222";

      await expect(
        service.reconcileDecision({
          workspaceId,
          expenseId,
          version: 1,
          decision: "approve",
          txHash: differentTx,
          context: approverContext,
        }),
      ).rejects.toThrowError(/already been recorded/);
    });

    it("records rejection with reason commitment hash", async () => {
      const reason = "Amount exceeds departmental per-diem limits";
      const result = await service.reconcileDecision({
        workspaceId,
        expenseId,
        version: 1,
        decision: "reject",
        reason,
        txHash,
        context: approverContext,
      });

      expect(result.success).toBe(true);
      expect(mockDb.decisions[0]!.decision_type).toBe("reject");
      expect(mockDb.decisions[0]!.reason_commitment?.startsWith("0x")).toBe(
        true,
      );
      expect(mockDb.auditEvents[0]!.event_type).toBe(
        "expense_version_rejected",
      );
    });
  });

  describe("createSuccessorDraft", () => {
    it("creates successor version V+1 with predecessor commitment binding and copies evidence", async () => {
      const successor = await service.createSuccessorDraft({
        workspaceId,
        expenseId,
        payloadUpdates: {
          claimAmount: "300.00",
          title: "AWS Cloud Services (Corrected)",
        },
        context: submitterContext,
      });

      expect(successor.version).toBe(2);
      expect(successor.status).toBe("draft");
      expect(successor.previousCommitment).toBe(version1Commitment);
      expect(successor.payload.claimAmount).toBe("300.00");
      expect(successor.payload.title).toBe("AWS Cloud Services (Corrected)");

      // Expense header points to version 2
      expect(mockDb.expenses[0]!.current_version).toBe(2);

      // Predecessor version 1 marked as superseded
      expect(mockDb.expenseVersions[0]!.status).toBe("superseded");

      // Evidence copied to version 2
      const copiedEvidence = mockDb.evidenceObjects.filter(
        (e) => e.version === 2,
      );
      expect(copiedEvidence.length).toBe(1);

      // Audit event emitted
      expect(
        mockDb.auditEvents.some(
          (e) => e.event_type === "successor_draft_created",
        ),
      ).toBe(true);
    });

    it("refuses to create successor draft if current version is already a draft", async () => {
      mockDb.expenseVersions[0]!.status = "draft";

      await expect(
        service.createSuccessorDraft({
          workspaceId,
          expenseId,
          context: submitterContext,
        }),
      ).rejects.toThrowError(/already an editable draft/);
    });

    it("refuses successor creation by unauthorized non-submitter / non-owner", async () => {
      await expect(
        service.createSuccessorDraft({
          workspaceId,
          expenseId,
          context: unauthorizedContext,
        }),
      ).rejects.toThrowError(/Only the expense submitter or workspace owner/);
    });
  });
});
