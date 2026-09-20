import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ExpenseService } from "./service";
import { MemoryStorageDriver } from "../evidence/storage";
import { RecordNotFoundError, type AuthContext } from "../auth/policy";
import { createSessionPayload } from "../auth/session";

class MockDatabaseClient implements DatabaseClient {
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
    current_version: number | null;
    created_at: string;
    updated_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    previous_commitment: string | null;
    salt_ciphertext: string;
    salt_key_reference: string;
    record_ciphertext: string;
    record_key_reference: string;
    amount: string;
    currency: string;
    recipient: string;
    status: string;
    created_at: string;
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
    encryption_metadata: unknown;
    created_at: string;
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
          (m.address.toLowerCase() === (params[1] as string)?.toLowerCase() ||
            m.user_id === params[1]),
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

    // Expenses: SELECT workspace_id, expense_id, created_by, current_version
    if (
      sql.includes(
        "SELECT workspace_id, expense_id, created_by, current_version",
      ) &&
      sql.includes("FROM expenses")
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses: SELECT created_at, updated_at
    if (sql.includes("SELECT created_at, updated_at FROM expenses")) {
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
        current_version: (params[3] as number) ?? null,
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

    // Update expenses unlink current_version
    if (sql.includes("UPDATE expenses SET current_version = NULL")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      );
      if (exp) {
        exp.current_version = null;
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Delete expenses
    if (sql.includes("DELETE FROM expenses")) {
      this.expenses = this.expenses.filter(
        (e) => !(e.workspace_id === params[0] && e.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    // Insert into expense_versions
    if (sql.includes("INSERT INTO expense_versions")) {
      this.expenseVersions.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        version: params[2] as number,
        commitment: params[3] as string,
        previous_commitment: null,
        salt_ciphertext: params[4] as string,
        salt_key_reference: "kek-v1",
        record_ciphertext: params[5] as string,
        record_key_reference: "kek-v1",
        amount: params[6] as string,
        currency: params[7] as string,
        recipient: params[8] as string,
        status: "draft",
        created_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }

    // List expenses
    if (
      sql.includes("FROM expenses e") &&
      sql.includes("JOIN expense_versions ev")
    ) {
      const results: Record<string, unknown>[] = [];
      for (const e of this.expenses.filter(
        (x) => x.workspace_id === params[0],
      )) {
        const ev = this.expenseVersions.find(
          (v) =>
            v.workspace_id === e.workspace_id &&
            v.expense_id === e.expense_id &&
            v.version === e.current_version,
        );
        if (ev) {
          const evidenceCount = this.evidenceObjects.filter(
            (o) =>
              o.workspace_id === e.workspace_id &&
              o.expense_id === e.expense_id &&
              o.version === ev.version,
          ).length;

          results.push({
            expense_id: e.expense_id,
            workspace_id: e.workspace_id,
            created_by: e.created_by,
            current_version: e.current_version,
            created_at: e.created_at,
            updated_at: e.updated_at,
            status: ev.status,
            amount: ev.amount,
            currency: ev.currency,
            recipient: ev.recipient,
            record_ciphertext: ev.record_ciphertext,
            evidence_count: evidenceCount.toString(),
          });
        }
      }
      return { rows: results as unknown as T[], rowCount: results.length };
    }

    // Delete from expense_versions
    if (sql.includes("DELETE FROM expense_versions")) {
      this.expenseVersions = this.expenseVersions.filter(
        (v) => !(v.workspace_id === params[0] && v.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    // Select from expense_versions
    if (sql.includes("FROM expense_versions")) {
      const rows = this.expenseVersions.filter(
        (ev) =>
          ev.workspace_id === params[0] &&
          ev.expense_id === params[1] &&
          ev.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Update expense_versions
    if (sql.includes("UPDATE expense_versions")) {
      const hasSalt = sql.includes("salt_ciphertext");
      const wId = String(params[hasSalt ? 5 : 4]);
      const eId = String(params[hasSalt ? 6 : 5]);
      const ver = Number(params[hasSalt ? 7 : 6]);
      const ev = this.expenseVersions.find(
        (v) =>
          v.workspace_id === wId && v.expense_id === eId && v.version === ver,
      );
      if (ev) {
        ev.record_ciphertext = params[0] as string;
        if (hasSalt) {
          ev.salt_ciphertext = params[1] as string;
          ev.amount = params[2] as string;
          ev.currency = params[3] as string;
          ev.recipient = params[4] as string;
        } else {
          ev.amount = params[1] as string;
          ev.currency = params[2] as string;
          ev.recipient = params[3] as string;
        }
      }
      return { rows: [], rowCount: ev ? 1 : 0 };
    }

    // Evidence objects
    if (sql.includes("DELETE FROM evidence_objects")) {
      this.evidenceObjects = this.evidenceObjects.filter(
        (eo) => !(eo.workspace_id === params[0] && eo.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("ExpenseService — Manual Expense Drafts", () => {
  let db: MockDatabaseClient;
  let storage: MemoryStorageDriver;
  let service: ExpenseService;
  let testKek: Buffer;

  const WS_1 =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const WS_2 =
    "0x2222222222222222222222222222222222222222222222222222222222222222";
  const USER_ALICE: `0x${string}` =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const USER_BOB: `0x${string}` = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const makeContext = (address: `0x${string}`): AuthContext => {
    const userId = `user-${address.slice(2, 8)}`;
    return {
      userId,
      address,
      session: createSessionPayload({
        userId,
        address,
      }),
    };
  };

  beforeEach(() => {
    db = new MockDatabaseClient();
    storage = new MemoryStorageDriver();
    testKek = Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    );
    service = new ExpenseService(db, storage, testKek);

    // Seed workspace 1
    db.workspaces.push({
      workspace_id: WS_1,
      name: "Engineering Core",
      created_by: USER_ALICE,
    });

    db.memberships.push({
      membership_id: "mem-alice-1",
      workspace_id: WS_1,
      user_id: "user-aaaaaa",
      address: USER_ALICE,
      status: "active",
    });

    db.memberships.push({
      membership_id: "mem-bob-1",
      workspace_id: WS_1,
      user_id: "user-bbbbbb",
      address: USER_BOB,
      status: "active",
    });

    // Seed workspace 2
    db.workspaces.push({
      workspace_id: WS_2,
      name: "Private Finance",
      created_by: USER_BOB,
    });

    db.memberships.push({
      membership_id: "mem-bob-2",
      workspace_id: WS_2,
      user_id: "user-bbbbbb",
      address: USER_BOB,
      status: "active",
    });
  });

  it("creates a new draft with encrypted payload offchain", async () => {
    const ctx = makeContext(USER_ALICE);
    const draft = await service.createDraft({
      workspaceId: WS_1,
      payload: {
        title: "Flight to Tokyo Hackathon",
        businessPurpose: "Attending Monad developer conference",
        category: "travel",
        project: "growth",
        merchant: "Japan Airlines",
        claimAmount: "450.00",
      },
      context: ctx,
    });

    expect(draft.workspaceId).toBe(WS_1);
    expect(draft.expenseId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(draft.version).toBe(1);
    expect(draft.status).toBe("draft");
    expect(draft.amount).toBe("450000000"); // 450 * 10^6 base units
    expect(draft.payload.title).toBe("Flight to Tokyo Hackathon");

    // Assert that the raw database row contains ciphertext, NOT plaintext
    const verRow = db.expenseVersions[0]!;
    expect(verRow.record_ciphertext).not.toContain("Flight to Tokyo Hackathon");
    expect(verRow.record_ciphertext).toContain("ciphertext");
    expect(verRow.record_ciphertext).toContain("authTag");
  });

  it("retrieves and decrypts an existing draft", async () => {
    const ctx = makeContext(USER_ALICE);
    const created = await service.createDraft({
      workspaceId: WS_1,
      payload: {
        title: "Team Lunch in Lisbon",
        category: "meals",
        claimAmount: "85.50",
      },
      context: ctx,
    });

    const retrieved = await service.getDraft({
      workspaceId: WS_1,
      expenseId: created.expenseId,
      context: ctx,
    });

    expect(retrieved.expenseId).toBe(created.expenseId);
    expect(retrieved.payload.title).toBe("Team Lunch in Lisbon");
    expect(retrieved.payload.category).toBe("meals");
    expect(retrieved.amount).toBe("85500000");
  });

  it("enforces multi-tenant workspace isolation (cannot view expense from other workspace)", async () => {
    const aliceCtx = makeContext(USER_ALICE);
    const createdInWs1 = await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "Secret WS1 Draft" },
      context: aliceCtx,
    });

    // Bob trying to read WS1 expense by pretending it is in WS2 fails with RecordNotFoundError
    const bobCtx = makeContext(USER_BOB);
    await expect(
      service.getDraft({
        workspaceId: WS_2,
        expenseId: createdInWs1.expenseId,
        context: bobCtx,
      }),
    ).rejects.toThrow(RecordNotFoundError);
  });

  it("updates and autosaves draft fields with re-encryption", async () => {
    const ctx = makeContext(USER_ALICE);
    const created = await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "Draft v1", claimAmount: "10.00" },
      context: ctx,
    });

    const updated = await service.updateDraft({
      workspaceId: WS_1,
      expenseId: created.expenseId,
      payload: {
        title: "Draft v1 Updated",
        claimAmount: "25.50",
        merchant: "Updated Merchant",
      },
      context: ctx,
    });

    expect(updated.payload.title).toBe("Draft v1 Updated");
    expect(updated.payload.merchant).toBe("Updated Merchant");
    expect(updated.amount).toBe("25500000");

    // Verify persisted decryption
    const fetched = await service.getDraft({
      workspaceId: WS_1,
      expenseId: created.expenseId,
      context: ctx,
    });
    expect(fetched.payload.title).toBe("Draft v1 Updated");
  });

  it("prevents updating or deleting non-draft versions", async () => {
    const ctx = makeContext(USER_ALICE);
    const created = await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "To be submitted" },
      context: ctx,
    });

    // Simulate version has been submitted
    const ver = db.expenseVersions.find(
      (v) => v.expense_id === created.expenseId,
    )!;
    ver.status = "submitted";

    await expect(
      service.updateDraft({
        workspaceId: WS_1,
        expenseId: created.expenseId,
        payload: { title: "Illegal Edit" },
        context: ctx,
      }),
    ).rejects.toThrow(/Only drafts may be modified/);

    await expect(
      service.deleteDraft({
        workspaceId: WS_1,
        expenseId: created.expenseId,
        context: ctx,
      }),
    ).rejects.toThrow(/Only unsubmitted drafts may be deleted/);
  });

  it("deletes draft and cascades cleanup of evidence objects", async () => {
    const ctx = makeContext(USER_ALICE);
    const created = await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "Draft To Delete" },
      context: ctx,
    });

    // Add dummy evidence object
    db.evidenceObjects.push({
      evidence_id: "ev-1",
      workspace_id: WS_1,
      expense_id: created.expenseId,
      version: 1,
      storage_key: `evidence/${WS_1}/ev-1.enc`,
      sha256_hash: "0x123",
      byte_length: 1024,
      mime_type: "application/pdf",
      encryption_metadata: {},
      created_at: new Date().toISOString(),
    });
    await storage.put(
      `evidence/${WS_1}/ev-1.enc`,
      Buffer.from("test"),
      "application/octet-stream",
    );

    const deleteResult = await service.deleteDraft({
      workspaceId: WS_1,
      expenseId: created.expenseId,
      context: ctx,
    });

    expect(deleteResult.success).toBe(true);
    expect(db.expenses).toHaveLength(0);
    expect(db.expenseVersions).toHaveLength(0);
    expect(db.evidenceObjects).toHaveLength(0);
    expect(await storage.exists(`evidence/${WS_1}/ev-1.enc`)).toBe(false);
  });

  it("lists workspace expenses with decrypted metadata", async () => {
    const ctx = makeContext(USER_ALICE);
    await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "Expense 1", category: "software" },
      context: ctx,
    });
    await service.createDraft({
      workspaceId: WS_1,
      payload: { title: "Expense 2", category: "office" },
      context: ctx,
    });

    const list = await service.listExpenses({
      workspaceId: WS_1,
      context: ctx,
    });

    expect(list).toHaveLength(2);
    expect(list.some((e) => e.title === "Expense 1")).toBe(true);
    expect(list.some((e) => e.title === "Expense 2")).toBe(true);
  });
});
