import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { GLOBAL_SCOPE } from "@/lib/auth/policy";
import { setDatabaseClient } from "@/lib/db";
import { POST as prepareDecisionHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/decision/prepare/route";
import { POST as reconcileDecisionHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/decision/reconcile/route";
import { POST as createSuccessorHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/successor/route";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";
import {
  generateDataEncryptionKey,
  wrapKey,
  encryptEvidence,
} from "@/lib/evidence/crypto";
import { getEvidenceKek } from "@/lib/evidence/service";

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

class MockDbForDecisionRoutes implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    name: string;
    created_by: string;
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

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.user_id === params[1] ||
            m.address.toLowerCase() === String(params[2] ?? "").toLowerCase()),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("FROM workspace_policies")) {
      return { rows: [{ policy_version: 1 }] as unknown as T[], rowCount: 1 };
    }

    if (
      sql.includes(
        "SELECT COUNT(*) as count FROM decisions WHERE reviewer_address = $1",
      )
    ) {
      return { rows: [{ count: "0" }] as unknown as T[], rowCount: 1 };
    }

    if (sql.includes("FROM decisions") && sql.includes("version = $3")) {
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === params[0] &&
          d.expense_id === params[1] &&
          d.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("SELECT created_by, current_version FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("FROM expense_versions") && sql.includes("version = $3")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

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

    if (sql.includes("SELECT created_at FROM expense_versions")) {
      return {
        rows: [{ created_at: new Date().toISOString() }] as unknown as T[],
        rowCount: 1,
      };
    }

    if (
      sql.includes("INSERT INTO chain_transactions") ||
      sql.includes("INSERT INTO audit_events")
    ) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("Decision Route Handlers", () => {
  let mockDb: MockDbForDecisionRoutes;
  const workspaceId = "ws_test_routes";
  const expenseId =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const commitment =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  const approverAddress = "0x2222222222222222222222222222222222222222";
  const submitterAddress = "0x1111111111111111111111111111111111111111";
  const secret = getSessionSecret();

  let approverCookie: string;
  let approverCsrfToken: string;
  let submitterCookie: string;
  let submitterCsrfToken: string;

  beforeEach(() => {
    mockDb = new MockDbForDecisionRoutes();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: workspaceId,
      name: "Engineering DAO",
      created_by: approverAddress,
    });

    mockDb.memberships.push(
      {
        membership_id: "mem_approver",
        workspace_id: workspaceId,
        user_id: "usr_approver",
        address: approverAddress,
        status: "active",
      },
      {
        membership_id: "mem_submitter",
        workspace_id: workspaceId,
        user_id: "usr_submitter",
        address: submitterAddress,
        status: "active",
      },
    );

    mockDb.roleGrants.push({
      grant_id: "grant_approver",
      workspace_id: workspaceId,
      address: approverAddress,
      role: ROLE_IDENTIFIERS.APPROVER_ROLE,
      scope: GLOBAL_SCOPE,
      revoked_at: null,
    });

    const approverSession = createSessionPayload({
      userId: "usr_approver",
      address: approverAddress,
    });
    const approverToken = signSessionToken(approverSession, secret);
    approverCookie = serializeSessionCookie(approverToken, { secure: false });
    approverCsrfToken = approverSession.csrfToken;

    const submitterSession = createSessionPayload({
      userId: "usr_submitter",
      address: submitterAddress,
    });
    const submitterToken = signSessionToken(submitterSession, secret);
    submitterCookie = serializeSessionCookie(submitterToken, { secure: false });
    submitterCsrfToken = submitterSession.csrfToken;

    mockDb.expenses.push({
      workspace_id: workspaceId,
      expense_id: expenseId,
      created_by: submitterAddress,
      current_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { recordCiphertext, saltCiphertext } = encryptTestPayload(
      workspaceId,
      expenseId,
      1,
      {
        title: "Server hosting",
        claimAmount: "120.00",
        claimAsset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        recipient: submitterAddress,
      },
    );

    mockDb.expenseVersions.push({
      workspace_id: workspaceId,
      expense_id: expenseId,
      version: 1,
      status: "submitted",
      commitment,
      previous_commitment: null,
      record_ciphertext: recordCiphertext,
      salt_ciphertext: saltCiphertext,
      submitted_at: new Date().toISOString(),
      submitted_by: submitterAddress,
      amount: "120000000",
      currency: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      recipient: submitterAddress,
    });
  });

  afterEach(() => {
    setDatabaseClient(undefined);
  });

  describe("POST /decision/prepare", () => {
    it("returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, decision: "approve" }),
      });

      const res = await prepareDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 when CSRF token is missing", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
        },
        body: JSON.stringify({ version: 1, decision: "approve" }),
      });

      const res = await prepareDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 when missing version or decision", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
          "x-csrf-token": approverCsrfToken,
        },
        body: JSON.stringify({ version: 0, decision: "approve" }),
      });

      const res = await prepareDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when reason is missing for reject", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
          "x-csrf-token": approverCsrfToken,
        },
        body: JSON.stringify({ version: 1, decision: "reject" }),
      });

      const res = await prepareDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toMatch(/strictly required/i);
    });

    it("returns 200 with prepared calldata and typed data on success", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
          "x-csrf-token": approverCsrfToken,
        },
        body: JSON.stringify({ version: 1, decision: "approve" }),
      });

      const res = await prepareDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.prepared.calldata.startsWith("0x")).toBe(true);
      expect(data.prepared.typedData.primaryType).toBe("ClarioApproval");
    });
  });

  describe("POST /decision/reconcile", () => {
    const validTxHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    it("returns 401 when CSRF token is missing", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
        },
        body: JSON.stringify({
          version: 1,
          decision: "approve",
          txHash: validTxHash,
        }),
      });

      const res = await reconcileDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 when txHash is invalid format", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
          "x-csrf-token": approverCsrfToken,
        },
        body: JSON.stringify({
          version: 1,
          decision: "approve",
          txHash: "invalid_hash",
        }),
      });

      const res = await reconcileDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 200 on successful reconciliation", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: approverCookie,
          "x-csrf-token": approverCsrfToken,
        },
        body: JSON.stringify({
          version: 1,
          decision: "approve",
          txHash: validTxHash,
        }),
      });

      const res = await reconcileDecisionHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.decision).toBe("approve");
      expect(mockDb.expenseVersions[0]!.status).toBe("current");
    });
  });

  describe("POST /successor", () => {
    it("returns 401 when CSRF is missing", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: submitterCookie,
        },
        body: JSON.stringify({}),
      });

      const res = await createSuccessorHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 201 on successful successor draft creation", async () => {
      const req = new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: submitterCookie,
          "x-csrf-token": submitterCsrfToken,
        },
        body: JSON.stringify({
          payloadUpdates: { claimAmount: "150.00" },
        }),
      });

      const res = await createSuccessorHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.draft.version).toBe(2);
      expect(data.draft.status).toBe("draft");
      expect(data.draft.previousCommitment).toBe(commitment);
    });
  });
});
