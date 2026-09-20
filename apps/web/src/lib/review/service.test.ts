import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { ReviewService } from "./service";
import { ExpenseService } from "../expense/service";
import {
  GLOBAL_SCOPE,
  RecordNotFoundError,
  type AuthContext,
} from "../auth/policy";
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

class MockReviewDatabase implements DatabaseClient {
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
    predecessor_commitment: string | null;
    manifest_hash: string | null;
    record_ciphertext: string;
    salt_ciphertext: string;
    submitted_at: string | null;
    amount: string;
    currency: string;
    recipient: string;
  }> = [];

  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    original_filename: string;
    mime_type: string;
    byte_size: number;
    sha256_hash: string;
  }> = [];

  sourceTransactions: Array<{
    workspace_id: string;
    expense_id: string;
    source_chain_id: number;
    source_transaction_hash: string;
    status: string;
  }> = [];

  decisions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    decision_type: "approve" | "reject" | "request_changes";
    reviewer_address: string;
    recorded_at: string;
    reason_commitment: string | null;
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

    // Expenses: SELECT workspace_id, expense_id, created_by, current_version FROM expenses
    if (
      sql.includes(
        "SELECT expense_id, workspace_id, created_by, current_version, created_at, updated_at",
      ) ||
      sql.includes(
        "SELECT workspace_id, expense_id, created_by, current_version",
      )
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert into expenses
    if (sql.includes("INSERT INTO expenses")) {
      const now = new Date().toISOString();
      this.expenses.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        created_by: params[2] as string,
        current_version: (params[3] as number) ?? 1,
        created_at: now,
        updated_at: now,
      });
      return { rows: [], rowCount: 1 };
    }

    // Update expenses current_version
    if (sql.includes("UPDATE expenses SET current_version = $1")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[1] && e.expense_id === params[2],
      );
      if (exp) {
        exp.current_version = params[0] as number;
        exp.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Update expenses updated_at
    if (sql.includes("UPDATE expenses SET updated_at = NOW()")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      );
      if (exp) {
        exp.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Insert into expense_versions
    if (sql.includes("INSERT INTO expense_versions")) {
      this.expenseVersions.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        version: params[2] as number,
        predecessor_commitment: null,
        commitment: (params[3] as string) || "0x" + "00".repeat(32),
        manifest_hash: null,
        salt_ciphertext: params[4] as string,
        record_ciphertext: params[5] as string,
        amount: params[6] as string,
        currency: params[7] as string,
        recipient: params[8] as string,
        status: "draft",
        submitted_at: null,
      });
      return { rows: [], rowCount: 1 };
    }

    // Update expense_versions commitment
    if (
      sql.includes("UPDATE expense_versions") &&
      sql.includes("commitment = $1")
    ) {
      const ev = this.expenseVersions.find(
        (v) =>
          v.workspace_id === params[3] &&
          v.expense_id === params[4] &&
          v.version === params[5],
      );
      if (ev) {
        ev.commitment = params[0] as string;
        ev.predecessor_commitment = params[1] as string;
        ev.manifest_hash = params[2] as string;
      }
      return { rows: [], rowCount: ev ? 1 : 0 };
    }

    // Draft query for submission
    if (
      sql.includes("FROM expense_versions") &&
      sql.includes("status = 'draft'")
    ) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.status === "draft",
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence count helper for review queue
    if (
      sql.includes("FROM expenses e") &&
      sql.includes("JOIN expense_versions ev")
    ) {
      const rows: Array<Record<string, unknown>> = [];
      for (const e of this.expenses) {
        if (e.workspace_id !== params[0]) continue;
        const ev = this.expenseVersions.find(
          (v) =>
            v.workspace_id === e.workspace_id &&
            v.expense_id === e.expense_id &&
            v.version === e.current_version &&
            v.status !== "draft",
        );
        if (!ev) continue;

        const evidenceCount = this.evidenceObjects.filter(
          (eo) =>
            eo.workspace_id === e.workspace_id &&
            eo.expense_id === e.expense_id &&
            eo.version === ev.version,
        ).length;

        const st = this.sourceTransactions.find(
          (s) =>
            s.workspace_id === e.workspace_id && s.expense_id === e.expense_id,
        );

        const d = this.decisions.find(
          (dec) =>
            dec.workspace_id === e.workspace_id &&
            dec.expense_id === e.expense_id &&
            dec.version === ev.version,
        );

        rows.push({
          expense_id: e.expense_id,
          workspace_id: e.workspace_id,
          created_by: e.created_by,
          current_version: e.current_version,
          created_at: e.created_at,
          updated_at: e.updated_at,
          version: ev.version,
          status: ev.status,
          commitment: ev.commitment,
          predecessor_commitment: ev.predecessor_commitment,
          manifest_hash: ev.manifest_hash,
          record_ciphertext: ev.record_ciphertext,
          submitted_at: ev.submitted_at,
          amount: ev.amount,
          currency: ev.currency,
          recipient: ev.recipient,
          evidence_count: String(evidenceCount),
          source_chain_id: st ? st.source_chain_id : null,
          source_transaction_hash: st ? st.source_transaction_hash : null,
          source_status: st ? st.status : null,
          decision_type: d ? d.decision_type : null,
          reviewer_address: d ? d.reviewer_address : null,
          decision_recorded_at: d ? d.recorded_at : null,
          reason_commitment: d ? d.reason_commitment : null,
        });
      }
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expense Versions by version
    if (sql.includes("FROM expense_versions") && sql.includes("version = $3")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence Objects by version
    if (sql.includes("FROM evidence_objects") && sql.includes("version = $3")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Source transactions
    if (
      sql.includes("FROM source_transactions") &&
      sql.includes("expense_id = $2")
    ) {
      const rows = this.sourceTransactions.filter(
        (st) => st.workspace_id === params[0] && st.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Decisions by version
    if (sql.includes("FROM decisions") && sql.includes("version = $3")) {
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === params[0] &&
          d.expense_id === params[1] &&
          d.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("ReviewService", () => {
  let mockDb: MockReviewDatabase;
  let reviewService: ReviewService;
  let expenseService: ExpenseService;

  const workspaceId = "0x" + "11".repeat(32);
  const ownerAddress = "0x1111111111111111111111111111111111111111";
  const approverAddress = "0x2222222222222222222222222222222222222222";
  const submitterAddress = "0x3333333333333333333333333333333333333333";
  const strangerAddress = "0x9999999999999999999999999999999999999999";

  const ownerContext: AuthContext = {
    userId: "usr-owner",
    address: ownerAddress,
    session: createSessionPayload({
      userId: "usr-owner",
      address: ownerAddress,
    }),
  };

  const approverContext: AuthContext = {
    userId: "usr-approver",
    address: approverAddress,
    session: createSessionPayload({
      userId: "usr-approver",
      address: approverAddress,
    }),
  };

  const submitterContext: AuthContext = {
    userId: "usr-submitter",
    address: submitterAddress,
    session: createSessionPayload({
      userId: "usr-submitter",
      address: submitterAddress,
    }),
  };

  const strangerContext: AuthContext = {
    userId: "usr-stranger",
    address: strangerAddress,
    session: createSessionPayload({
      userId: "usr-stranger",
      address: strangerAddress,
    }),
  };

  beforeEach(() => {
    mockDb = new MockReviewDatabase();
    reviewService = new ReviewService(mockDb);
    expenseService = new ExpenseService(mockDb);

    // Setup Workspace
    mockDb.workspaces.push({
      workspace_id: workspaceId,
      created_by: ownerAddress,
      name: "Engineering DAO",
    });

    // Setup Memberships
    mockDb.memberships.push(
      {
        membership_id: "mem-owner",
        workspace_id: workspaceId,
        user_id: "usr-owner",
        address: ownerAddress,
        status: "active",
      },
      {
        membership_id: "mem-approver",
        workspace_id: workspaceId,
        user_id: "usr-approver",
        address: approverAddress,
        status: "active",
      },
      {
        membership_id: "mem-submitter",
        workspace_id: workspaceId,
        user_id: "usr-submitter",
        address: submitterAddress,
        status: "active",
      },
    );

    // Setup Role Grants
    mockDb.roleGrants.push(
      {
        grant_id: "grant-owner",
        workspace_id: workspaceId,
        address: ownerAddress,
        role: ROLE_IDENTIFIERS.OWNER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      },
      {
        grant_id: "grant-approver",
        workspace_id: workspaceId,
        address: approverAddress,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      },
    );
  });

  describe("assertReviewQueueAccess", () => {
    it("allows member with APPROVER_ROLE", async () => {
      const { authority } = await reviewService.assertReviewQueueAccess(
        workspaceId,
        approverContext,
      );
      expect(authority.hasApproverRole).toBe(true);
      expect(authority.address).toBe(approverAddress);
    });

    it("allows member with OWNER_ROLE", async () => {
      const { authority } = await reviewService.assertReviewQueueAccess(
        workspaceId,
        ownerContext,
      );
      expect(authority.isOwner).toBe(true);
    });

    it("denies access to member with only SUBMITTER_ROLE", async () => {
      await expect(
        reviewService.assertReviewQueueAccess(workspaceId, submitterContext),
      ).rejects.toThrow("You are not authorized to view the review queue");
    });

    it("denies access to non-member with UNAUTHORIZED", async () => {
      await expect(
        reviewService.assertReviewQueueAccess(workspaceId, strangerContext),
      ).rejects.toThrow("Account is not an active member of this workspace.");
    });

    it("denies access when workspace does not exist with RecordNotFoundError", async () => {
      const nonExistentWs = "0x" + "99".repeat(32);
      await expect(
        reviewService.assertReviewQueueAccess(nonExistentWs, approverContext),
      ).rejects.toThrow(RecordNotFoundError);
    });
  });

  describe("getReviewQueue & getReviewDetail", () => {
    beforeEach(async () => {
      // Create a draft and prepare/reconcile submission for v1
      const draft = await expenseService.createDraft({
        workspaceId,
        payload: {
          title: "Cloud Infrastructure Servers",
          businessPurpose: "Quarterly validator hosting",
          category: "hosting",
          project: "ops",
          merchant: "Validator Clouds Inc",
          claimAmount: "500.00",
          claimAsset: "0x0000000000000000000000000000000000001001",
          recipient: submitterAddress,
          paymentSource: "manual",
        },
        context: submitterContext,
      });

      // Prepare submission
      const preview = await expenseService.prepareSubmission({
        workspaceId,
        expenseId: draft.expenseId,
        context: submitterContext,
      });

      // Update mock database to simulate submitted status
      const exp = mockDb.expenses.find((e) => e.expense_id === draft.expenseId);
      if (exp) {
        exp.current_version = 1;
      }
      const existingV1 = mockDb.expenseVersions.find(
        (v) =>
          v.workspace_id === workspaceId &&
          v.expense_id === draft.expenseId &&
          v.version === 1,
      );
      if (existingV1) {
        existingV1.status = "submitted";
        existingV1.commitment = preview.intent.commitment;
        existingV1.predecessor_commitment = preview.intent.previousCommitment;
        existingV1.manifest_hash = preview.intent.evidenceManifestHash;
        existingV1.submitted_at = new Date().toISOString().slice(0, 19) + "Z";
      }

      // Attach evidence object
      mockDb.evidenceObjects.push({
        evidence_id: "ev-001",
        workspace_id: workspaceId,
        expense_id: draft.expenseId,
        version: 1,
        original_filename: "invoice_server_q3.pdf",
        mime_type: "application/pdf",
        byte_size: 245000,
        sha256_hash: "0x" + "aa".repeat(32),
      });

      // Add source transaction
      mockDb.sourceTransactions.push({
        workspace_id: workspaceId,
        expense_id: draft.expenseId,
        source_chain_id: 10143,
        source_transaction_hash: "0x" + "bb".repeat(32),
        status: "confirmed",
      });
    });

    it("lists submitted expenses in review queue for authorized approver", async () => {
      const queue = await reviewService.getReviewQueue({
        workspaceId,
        context: approverContext,
      });

      expect(queue.items.length).toBe(1);
      expect(queue.pendingCount).toBe(1);
      const item = queue.items[0]!;
      expect(item.title).toBe("Cloud Infrastructure Servers");
      expect(item.merchant).toBe("Validator Clouds Inc");
      expect(item.claimAmount).toBe("500.00");
      expect(item.isSelfExpense).toBe(false);
      expect(item.canApprove).toBe(true);
      expect(item.evidenceCount).toBe(1);
      expect(item.hasSourceTransaction).toBe(true);
      expect(item.sourceTransaction?.chainId).toBe(10143);
    });

    it("blocks self-approval when submitter views their own expense", async () => {
      // Temporarily grant submitter APPROVER_ROLE
      mockDb.roleGrants.push({
        grant_id: "grant-submitter-approver",
        workspace_id: workspaceId,
        address: submitterAddress,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      });

      const queue = await reviewService.getReviewQueue({
        workspaceId,
        context: submitterContext,
      });

      expect(queue.items.length).toBe(1);
      const item = queue.items[0]!;
      expect(item.isSelfExpense).toBe(true);
      expect(item.canApprove).toBe(false); // Invariant: Submitter cannot approve their own expense
    });

    it("returns full review detail with evidence objects and Proof Spine", async () => {
      const exp = mockDb.expenses[0]!;
      const detail = await reviewService.getReviewDetail({
        workspaceId,
        expenseId: exp.expense_id,
        context: approverContext,
      });

      expect(detail.title).toBe("Cloud Infrastructure Servers");
      expect(detail.merchant).toBe("Validator Clouds Inc");
      expect(detail.evidence.length).toBe(1);
      expect(detail.evidence[0]!.originalFilename).toBe(
        "invoice_server_q3.pdf",
      );
      expect(detail.evidence[0]!.previewAvailable).toBe(true);
      expect(detail.isCurrentVersion).toBe(true);
      expect(detail.isSuperseded).toBe(false);
      expect(detail.canApprove).toBe(true);

      // Verify Proof Spine structure
      expect(detail.proofSpine.length).toBe(4);
      expect(detail.proofSpine[0]!.step).toBe("draft_created");
      expect(detail.proofSpine[1]!.step).toBe("version_submitted");
      expect(detail.proofSpine[2]!.step).toBe("human_review");
      expect(detail.proofSpine[3]!.step).toBe("settlement");
    });

    it("computes material diff for version 2 when claim amount is edited", async () => {
      const exp = mockDb.expenses[0]!;
      const v2Payload = {
        title: "Cloud Infrastructure Servers",
        businessPurpose: "Quarterly validator hosting with extra nodes",
        category: "hosting",
        project: "ops",
        merchant: "Validator Clouds Inc",
        claimAmount: "750.00", // Modified from 500.00 to 750.00 (MATERIAL)
        claimAsset: "0x0000000000000000000000000000000000001001",
        expenseDate: "2026-09-17",
        recipient: submitterAddress,
        paymentSource: "manual",
      };

      const { recordCiphertext, saltCiphertext } = encryptTestPayload(
        workspaceId,
        exp.expense_id,
        2,
        v2Payload,
      );

      // Add version 2 to mockDb and set as current
      exp.current_version = 2;
      mockDb.expenseVersions.push({
        workspace_id: workspaceId,
        expense_id: exp.expense_id,
        version: 2,
        status: "submitted",
        commitment: "0x" + "33".repeat(32),
        predecessor_commitment: mockDb.expenseVersions[0]!.commitment,
        manifest_hash: mockDb.expenseVersions[0]!.manifest_hash,
        record_ciphertext: recordCiphertext,
        salt_ciphertext: saltCiphertext,
        submitted_at: new Date().toISOString(),
        amount: "750000000",
        currency: "0x0000000000000000000000000000000000001001",
        recipient: submitterAddress,
      });

      const detailV2 = await reviewService.getReviewDetail({
        workspaceId,
        expenseId: exp.expense_id,
        version: 2,
        context: approverContext,
      });

      expect(detailV2.version).toBe(2);
      expect(detailV2.isCurrentVersion).toBe(true);
      expect(detailV2.materialDiff).not.toBeNull();
      expect(detailV2.materialDiff!.hasChanges).toBe(true);
      expect(detailV2.materialDiff!.hasMaterialChanges).toBe(true);

      const amountDiff = detailV2.materialDiff!.changes.find(
        (c) => c.field === "claimAmount",
      );
      expect(amountDiff).toBeDefined();
      expect(amountDiff!.isMaterial).toBe(true);
    });

    it("flags historical version 1 as superseded when version 2 exists", async () => {
      const exp = mockDb.expenses[0]!;
      exp.current_version = 2;

      const detailV1 = await reviewService.getReviewDetail({
        workspaceId,
        expenseId: exp.expense_id,
        version: 1,
        context: approverContext,
      });

      expect(detailV1.version).toBe(1);
      expect(detailV1.isCurrentVersion).toBe(false);
      expect(detailV1.isSuperseded).toBe(true);
      expect(detailV1.canApprove).toBe(false); // Stale version cannot be approved
    });
  });
});
