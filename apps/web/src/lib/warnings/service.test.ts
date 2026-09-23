import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import type { AuthorizationPolicy, AuthContext } from "../auth/policy";
import { createSessionPayload } from "../auth/session";
import {
  encryptEvidence,
  generateDataEncryptionKey,
  wrapKey,
} from "../evidence/crypto";
import type { ExpenseDraftPayload } from "../expense/types";
import { WarningService } from "./service";

const kek = Buffer.alloc(32, 4);
const workspaceId = "workspace-1";
const expenseId = "expense-1";
const context: AuthContext = {
  userId: "user-1",
  address: "0x0000000000000000000000000000000000000001",
  session: createSessionPayload({
    userId: "user-1",
    address: "0x0000000000000000000000000000000000000001",
  }),
};

const privatePayload: ExpenseDraftPayload = {
  title: "Private fixture",
  businessPurpose: "Private purpose",
  category: "other",
  project: "Private project",
  merchant: "Private merchant",
  expenseDate: "2026-09-22",
  claimAmount: "42.00",
  claimAsset: "0x0000000000000000000000000000000000000002",
  recipient: "0x0000000000000000000000000000000000000003",
  paymentSource: "manual",
};

function encryptedPayload(): string {
  const dek = generateDataEncryptionKey();
  const encrypted = encryptEvidence(
    Buffer.from(JSON.stringify(privatePayload)),
    dek,
    { workspaceId, expenseId, version: 1, evidenceId: "draft_record" },
  );
  const wrapped = wrapKey(dek, kek);
  return JSON.stringify({
    ciphertext: encrypted.ciphertext.toString("hex"),
    iv: encrypted.iv.toString("hex"),
    authTag: encrypted.authTag.toString("hex"),
    wrappedKey: wrapped.wrappedKey.toString("hex"),
    keyId: wrapped.keyId,
    kekIv: wrapped.iv.toString("hex"),
    kekAuthTag: wrapped.authTag.toString("hex"),
  });
}

class MockDb implements DatabaseClient {
  readonly calls: Array<{ sql: string; params: unknown[] }> = [];
  constructor(readonly includeFailedSource = false) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    this.calls.push({ sql, params });
    if (sql.includes("SELECT e.current_version")) {
      return {
        rows: [
          {
            current_version: 1,
            status: "draft",
            amount: "42000000",
            currency: "USDC",
            recipient: privatePayload.recipient,
            record_ciphertext: encryptedPayload(),
          },
        ] as T[],
      };
    }
    if (sql.includes("SELECT evidence_id FROM evidence_objects")) {
      return { rows: [] };
    }
    if (sql.includes("COUNT(DISTINCT other.expense_id)")) {
      return { rows: [{ reused_count: 0 }] as T[] };
    }
    if (sql.includes("FROM source_transactions st")) {
      return {
        rows: (this.includeFailedSource
          ? [
              {
                id: "source-1",
                status: "failed",
                imported_at: "2026-09-22T00:00:00.000Z",
                duplicate_count: 1,
              },
            ]
          : []) as T[],
      };
    }
    return { rows: [] };
  }
}

function service(includeFailedSource = false) {
  const db = new MockDb(includeFailedSource);
  const policy = {
    authorizeExpense: vi.fn().mockResolvedValue({}),
    authorizeEvidence: vi.fn().mockResolvedValue({}),
  } as unknown as AuthorizationPolicy;
  return {
    db,
    policy,
    service: new WarningService(db, kek, policy),
  };
}

describe("WarningService", () => {
  it("authorizes private access and returns explainable warnings without private values", async () => {
    const setup = service();
    const response = await setup.service.getWarnings({
      workspaceId,
      expenseId,
      context,
    });
    expect(setup.policy.authorizeExpense).toHaveBeenCalledWith(
      workspaceId,
      expenseId,
      context,
      "read",
    );
    expect(response.warnings[0]).toMatchObject({
      code: "INCOMPLETE_EVIDENCE",
      affectedFields: ["evidence"],
    });
    expect(JSON.stringify(response)).not.toContain(privatePayload.merchant);
    expect(JSON.stringify(response)).not.toContain(
      privatePayload.businessPurpose,
    );
  });

  it("records false-positive recovery as privacy-safe immutable audit metadata", async () => {
    const setup = service();
    const current = await setup.service.getWarnings({
      workspaceId,
      expenseId,
      context,
    });
    const warningId = current.warnings[0]!.warningId;
    const result = await setup.service.recordDisposition({
      workspaceId,
      expenseId,
      warningId,
      disposition: "dismissed_false_positive",
      context,
    });
    expect(result.disposition).toBe("dismissed_false_positive");
    const insert = setup.db.calls.find((call) =>
      call.sql.includes("INSERT INTO audit_events"),
    );
    expect(insert).toBeDefined();
    const metadata = String(insert!.params[4]);
    expect(metadata).toContain(warningId);
    expect(metadata).not.toContain(privatePayload.merchant);
    expect(metadata).not.toContain(privatePayload.businessPurpose);
  });

  it("does not allow a deterministic blocking warning to be dismissed", async () => {
    const setup = service(true);
    const current = await setup.service.getWarnings({
      workspaceId,
      expenseId,
      context,
    });
    const blocking = current.warnings.find(
      (warning) => warning.severity === "blocking",
    );
    expect(blocking?.code).toBe("FAILED_SOURCE_TRANSACTION");
    await expect(
      setup.service.recordDisposition({
        workspaceId,
        expenseId,
        warningId: blocking!.warningId,
        disposition: "dismissed_false_positive",
        context,
      }),
    ).rejects.toMatchObject({ code: "INVALID_LIFECYCLE_TRANSITION" });
    expect(
      setup.db.calls.some((call) =>
        call.sql.includes("INSERT INTO audit_events"),
      ),
    ).toBe(false);
  });
});
