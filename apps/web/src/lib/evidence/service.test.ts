import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { EvidenceService, type StoredEncryptionMetadata } from "./service";
import { MemoryStorageDriver } from "./storage";
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
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
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

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
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

    // Expenses
    if (sql.includes("FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expense versions
    if (sql.includes("FROM expense_versions")) {
      const rows = this.expenseVersions.filter(
        (ev) =>
          ev.workspace_id === params[0] &&
          ev.expense_id === params[1] &&
          ev.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert evidence_objects
    if (sql.includes("INSERT INTO evidence_objects")) {
      const newObj = {
        evidence_id: params[0] as string,
        workspace_id: params[1] as string,
        expense_id: params[2] as string,
        version: params[3] as number,
        storage_key: params[4] as string,
        sha256_hash: params[5] as string,
        byte_length: params[6] as number,
        mime_type: params[7] as string,
        encryption_metadata: params[8] as string,
        created_at: params[9] as string,
      };
      this.evidenceObjects.push(newObj);
      return { rows: [newObj as unknown as T], rowCount: 1 };
    }

    // Delete evidence_objects
    if (sql.includes("DELETE FROM evidence_objects")) {
      const before = this.evidenceObjects.length;
      this.evidenceObjects = this.evidenceObjects.filter(
        (eo) =>
          !(
            eo.workspace_id === params[0] &&
            eo.expense_id === params[1] &&
            eo.evidence_id === params[2]
          ),
      );
      return { rows: [], rowCount: before - this.evidenceObjects.length };
    }

    // Query evidence_objects
    if (sql.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.evidence_id === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async end(): Promise<void> {}
}

describe("EvidenceService", () => {
  const wsId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const expId =
    "0x2222222222222222222222222222222222222222222222222222222222222222";
  const submitterAddr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const approverAddr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const adminAddr = "0xcccccccccccccccccccccccccccccccccccccccc";
  const strangerAddr = "0xdddddddddddddddddddddddddddddddddddddddd";
  const ownerAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  let db: MockDatabaseClient;
  let storage: MemoryStorageDriver;
  let service: EvidenceService;

  const makeContext = (address: `0x${string}`): AuthContext => {
    const session = createSessionPayload({
      userId: `user-${address}`,
      address,
    });
    return {
      userId: session.userId,
      address,
      session,
    };
  };

  beforeEach(() => {
    db = new MockDatabaseClient();
    storage = new MemoryStorageDriver();
    service = new EvidenceService(db, storage);

    // Setup base workspace
    db.workspaces.push({
      workspace_id: wsId,
      created_by: ownerAddr,
      name: "Engineering Lab",
    });

    // Setup members
    db.memberships.push(
      {
        membership_id: "m-owner",
        workspace_id: wsId,
        user_id: `user-${ownerAddr}`,
        address: ownerAddr,
        status: "active",
      },
      {
        membership_id: "m-submitter",
        workspace_id: wsId,
        user_id: `user-${submitterAddr}`,
        address: submitterAddr,
        status: "active",
      },
      {
        membership_id: "m-approver",
        workspace_id: wsId,
        user_id: `user-${approverAddr}`,
        address: approverAddr,
        status: "active",
      },
      {
        membership_id: "m-admin",
        workspace_id: wsId,
        user_id: `user-${adminAddr}`,
        address: adminAddr,
        status: "active",
      },
    );

    // Setup roles
    db.roleGrants.push(
      {
        grant_id: "rg-owner",
        workspace_id: wsId,
        address: ownerAddr,
        role: ROLE_IDENTIFIERS.OWNER_ROLE,
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        revoked_at: null,
      },
      {
        grant_id: "rg-approver",
        workspace_id: wsId,
        address: approverAddr,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        revoked_at: null,
      },
      {
        grant_id: "rg-admin",
        workspace_id: wsId,
        address: adminAddr,
        role: ROLE_IDENTIFIERS.ADMIN_ROLE,
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        revoked_at: null,
      },
    );

    // Setup expense header
    db.expenses.push({
      workspace_id: wsId,
      expense_id: expId,
      created_by: submitterAddr,
      current_version: 1,
    });

    // Setup draft version 1
    db.expenseVersions.push({
      workspace_id: wsId,
      expense_id: expId,
      version: 1,
      status: "draft",
    });
  });

  describe("Upload Workflow", () => {
    it("successfully uploads and envelope-encrypts evidence for draft version", async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const payload = Buffer.from("Receipt PDF contents: $450 server hardware");

      const result = await service.uploadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        version: 1,
        data: payload,
        mimeType: "application/pdf",
        filename: "hardware-invoice.pdf",
        context: submitterCtx,
      });

      expect(result.workspaceId).toBe(wsId);
      expect(result.expenseId).toBe(expId);
      expect(result.version).toBe(1);
      expect(result.byteLength).toBe(payload.length);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.storageKey).toMatch(
        /^evidence\/0x1111111111111111111111111111111111111111111111111111111111111111\/[a-f0-9-]+\.enc$/,
      );

      // Verify ciphertext exists in storage
      const storedCiphertext = await storage.get(result.storageKey);
      expect(storedCiphertext).not.toBeNull();
      // Ciphertext must NOT match plaintext
      expect(storedCiphertext?.equals(payload)).toBe(false);

      // Verify DB row exists
      expect(db.evidenceObjects.length).toBe(1);
      const row = db.evidenceObjects[0]!;
      expect(row.evidence_id).toBe(result.evidenceId);
      expect(row.sha256_hash).toBe(result.sha256Hash);

      const meta = JSON.parse(
        row.encryption_metadata,
      ) as StoredEncryptionMetadata;
      expect(meta.algorithm).toBe("aes-256-gcm");
      expect(meta.wrappedKey).toBeDefined();
      expect(meta.iv).toBeDefined();
      expect(meta.authTag).toBeDefined();
      expect(meta.originalFilename).toBe("hardware-invoice.pdf");
    });

    it("fails when trying to upload to a submitted expense version (immutability)", async () => {
      db.expenseVersions[0]!.status = "submitted";
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);

      await expect(
        service.uploadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          version: 1,
          data: Buffer.from("New receipt"),
          mimeType: "image/png",
          context: submitterCtx,
        }),
      ).rejects.toThrow(
        /Cannot upload evidence to an expense version with status 'submitted'/,
      );
    });

    it("fails when non-creator non-owner tries to upload to draft", async () => {
      const approverCtx = makeContext(approverAddr as `0x${string}`);

      await expect(
        service.uploadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          version: 1,
          data: Buffer.from("Unauthorized receipt"),
          mimeType: "image/png",
          context: approverCtx,
        }),
      ).rejects.toThrow(
        /Only the submitter or a workspace owner can modify this expense/,
      );
    });
  });

  describe("Download and Decryption Workflow", () => {
    let evidenceId: string;
    const originalPlaintext = Buffer.from(
      "Secret Vendor Agreement Contract v1",
    );

    beforeEach(async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const uploaded = await service.uploadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        version: 1,
        data: originalPlaintext,
        mimeType: "application/pdf",
        context: submitterCtx,
      });
      evidenceId = uploaded.evidenceId;
    });

    it("allows submitter to download and decrypt evidence cleanly", async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const res = await service.downloadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        evidenceId,
        context: submitterCtx,
      });

      expect(res.data.equals(originalPlaintext)).toBe(true);
      expect(res.mimeType).toBe("application/pdf");
      expect(res.byteLength).toBe(originalPlaintext.length);
    });

    it("allows approver to download and decrypt evidence", async () => {
      const approverCtx = makeContext(approverAddr as `0x${string}`);
      const res = await service.downloadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        evidenceId,
        context: approverCtx,
      });

      expect(res.data.equals(originalPlaintext)).toBe(true);
    });

    it("allows workspace owner to download and decrypt evidence", async () => {
      const ownerCtx = makeContext(ownerAddr as `0x${string}`);
      const res = await service.downloadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        evidenceId,
        context: ownerCtx,
      });

      expect(res.data.equals(originalPlaintext)).toBe(true);
    });

    it("DENIES admin access to private evidence without authorized role (Admin Isolation)", async () => {
      const adminCtx = makeContext(adminAddr as `0x${string}`);

      await expect(
        service.downloadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          evidenceId,
          context: adminCtx,
        }),
      ).rejects.toThrow(
        /Administrative membership does not grant private evidence access/,
      );
    });

    it("DENIES access to non-member stranger (fails closed with UNAUTHORIZED)", async () => {
      const strangerCtx = makeContext(strangerAddr as `0x${string}`);

      await expect(
        service.downloadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          evidenceId,
          context: strangerCtx,
        }),
      ).rejects.toThrow(/Account is not an active member of this workspace/);
    });

    it("fails closed with RecordNotFoundError for member querying non-existent or cross-workspace expense", async () => {
      const approverCtx = makeContext(approverAddr as `0x${string}`);
      const nonExistentExpId =
        "0x9999999999999999999999999999999999999999999999999999999999999999";

      await expect(
        service.downloadEvidence({
          workspaceId: wsId,
          expenseId: nonExistentExpId,
          evidenceId,
          context: approverCtx,
        }),
      ).rejects.toThrow(RecordNotFoundError);
    });

    it("fails closed if storage ciphertext has been tampered with", async () => {
      const row = db.evidenceObjects[0]!;
      const ciphertext = await storage.get(row.storage_key);
      expect(ciphertext).not.toBeNull();

      // Tamper 1 bit in storage ciphertext
      const tampered = Buffer.from(ciphertext!);
      tampered[0] = (tampered[0] ?? 0) ^ 0x01;
      await storage.put(row.storage_key, tampered);

      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      await expect(
        service.downloadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          evidenceId,
          context: submitterCtx,
        }),
      ).rejects.toThrow(/Decryption failed/);
    });

    it("fails closed if database sha256_hash has been modified", async () => {
      // Modify DB hash commitment
      db.evidenceObjects[0]!.sha256_hash =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      await expect(
        service.downloadEvidence({
          workspaceId: wsId,
          expenseId: expId,
          evidenceId,
          context: submitterCtx,
        }),
      ).rejects.toThrow(/Integrity check failed/);
    });
  });

  describe("Deletion and Replacement Workflow", () => {
    let evidenceId: string;
    const payload = Buffer.from("Draft receipt to delete");

    beforeEach(async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const uploaded = await service.uploadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        version: 1,
        data: payload,
        mimeType: "text/plain",
        context: submitterCtx,
      });
      evidenceId = uploaded.evidenceId;
    });

    it("allows deleting draft evidence, removing from storage and DB", async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const storageKey = db.evidenceObjects[0]!.storage_key;

      expect(await storage.exists(storageKey)).toBe(true);
      expect(db.evidenceObjects.length).toBe(1);

      await service.deleteEvidence({
        workspaceId: wsId,
        expenseId: expId,
        evidenceId,
        context: submitterCtx,
      });

      expect(await storage.exists(storageKey)).toBe(false);
      expect(db.evidenceObjects.length).toBe(0);
    });

    it("prevents deleting evidence once version is submitted (Immutability)", async () => {
      db.expenseVersions[0]!.status = "submitted";
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);

      await expect(
        service.deleteEvidence({
          workspaceId: wsId,
          expenseId: expId,
          evidenceId,
          context: submitterCtx,
        }),
      ).rejects.toThrow(
        /Cannot delete evidence from an expense version with status 'submitted'/,
      );
    });

    it("replaces draft evidence by deleting old and uploading new record", async () => {
      const submitterCtx = makeContext(submitterAddr as `0x${string}`);
      const newPayload = Buffer.from("Updated draft receipt data");

      const replacement = await service.replaceEvidence(evidenceId, {
        workspaceId: wsId,
        expenseId: expId,
        version: 1,
        data: newPayload,
        mimeType: "text/plain",
        context: submitterCtx,
      });

      expect(replacement.evidenceId).not.toBe(evidenceId);
      expect(db.evidenceObjects.length).toBe(1);
      expect(db.evidenceObjects[0]!.evidence_id).toBe(replacement.evidenceId);

      const downloaded = await service.downloadEvidence({
        workspaceId: wsId,
        expenseId: expId,
        evidenceId: replacement.evidenceId,
        context: submitterCtx,
      });

      expect(downloaded.data.equals(newPayload)).toBe(true);
    });
  });
});
