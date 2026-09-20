import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  ROLE_IDENTIFIERS,
  validateVerificationPackageManifestV1,
  computePackageFileHash,
  computeCanonicalManifestHash,
} from "@clario/protocol";
import { ExportService } from "./service";
import { MemoryStorageDriver } from "../evidence/storage";
import { extractZipEntries } from "./zip";
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
  const dummySalt = Buffer.alloc(32, 0x42);
  const encSalt = encryptEvidence(dummySalt, dek, saltContext);
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

function encryptTestEvidence(
  workspaceId: string,
  expenseId: string,
  version: number,
  evidenceId: string,
  data: Buffer,
): { ciphertext: Buffer; metadata: Record<string, unknown> } {
  const kek = getEvidenceKek();
  const dek = generateDataEncryptionKey();
  const wrapResult = wrapKey(dek, kek, "kek-v1");

  const authContext = {
    workspaceId: workspaceId.toLowerCase(),
    expenseId: expenseId.toLowerCase(),
    version,
    evidenceId: evidenceId.toLowerCase(),
  };
  const encResult = encryptEvidence(data, dek, authContext);

  const metadata = {
    algorithm: "aes-256-gcm",
    keyId: wrapResult.keyId,
    wrappedKey: wrapResult.wrappedKey.toString("hex"),
    iv: encResult.iv.toString("hex"),
    authTag: encResult.authTag.toString("hex"),
    kekIv: wrapResult.iv.toString("hex"),
    kekAuthTag: wrapResult.authTag.toString("hex"),
  };

  return { ciphertext: encResult.ciphertext, metadata };
}

class MockExportDatabase implements DatabaseClient {
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
    granted_at: Date;
    revoked_at: Date | null;
  }> = [];

  workspacePolicies: Array<{
    workspace_id: string;
    policy_version: number;
    policy_commitment: string;
    created_by: string;
  }> = [];

  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number;
    created_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    record_ciphertext: string;
    salt_ciphertext: string;
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
    encryption_metadata: Record<string, unknown>;
    created_at: string;
  }> = [];

  reimbursements: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
  }> = [];

  indexedEvents: Array<{
    workspace_id: string;
    block_number: number;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    contract_address: string;
    payload: string;
  }> = [];

  exports: Array<{
    export_id: string;
    workspace_id: string;
    requested_by: string;
    filter_criteria: string;
    package_hash: string;
    storage_key: string;
    created_at: string;
    expires_at: string;
  }> = [];

  auditEvents: Array<{
    workspace_id: string;
    actor_address: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata: string;
    occurred_at: string;
  }> = [];

  async query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim();

    // 1. SELECT workspace_id, created_by FROM workspaces WHERE workspace_id = $1
    if (s.startsWith("SELECT workspace_id, created_by FROM workspaces")) {
      const ws = this.workspaces.find((w) => w.workspace_id === params?.[0]);
      return { rows: (ws ? [ws] : []) as T[], rowCount: ws ? 1 : 0 };
    }

    // 2. SELECT membership_id, workspace_id, user_id, address, status FROM memberships
    if (s.includes("FROM memberships")) {
      const wsId = params?.[0];
      const addr = (params?.[2] as string)?.toLowerCase();
      const mem = this.memberships.find(
        (m) =>
          m.workspace_id === wsId && m.address.toLowerCase() === addr,
      );
      return { rows: (mem ? [mem] : []) as T[], rowCount: mem ? 1 : 0 };
    }

    // 3. SELECT role, scope FROM role_grants WHERE workspace_id = $1 AND LOWER(address) = LOWER($2) AND revoked_at IS NULL
    if (s.includes("FROM role_grants WHERE workspace_id = $1 AND LOWER(address)")) {
      const wsId = params?.[0];
      const addr = (params?.[1] as string)?.toLowerCase();
      const grants = this.roleGrants.filter(
        (g) =>
          g.workspace_id === wsId &&
          g.address.toLowerCase() === addr &&
          !g.revoked_at,
      );
      return { rows: grants as T[], rowCount: grants.length };
    }

    // 4. SELECT role, address, scope, granted_at FROM role_grants WHERE workspace_id = $1 AND revoked_at IS NULL
    if (s.includes("SELECT role, address, scope, granted_at FROM role_grants")) {
      const wsId = params?.[0];
      const grants = this.roleGrants.filter(
        (g) => g.workspace_id === wsId && !g.revoked_at,
      );
      return { rows: grants as T[], rowCount: grants.length };
    }

    // 5. SELECT policy_version, policy_commitment, created_by FROM workspace_policies
    if (s.includes("FROM workspace_policies")) {
      const wsId = params?.[0];
      const policies = this.workspacePolicies
        .filter((p) => p.workspace_id === wsId)
        .sort((a, b) => b.policy_version - a.policy_version);
      return { rows: policies.slice(0, 1) as T[], rowCount: Math.min(1, policies.length) };
    }

    // 6. SELECT block_number, transaction_hash, log_index, event_name, contract_address, payload FROM indexed_events
    if (s.includes("FROM indexed_events")) {
      const wsId = params?.[0];
      const evs = this.indexedEvents.filter((e) => e.workspace_id === wsId);
      return { rows: evs as T[], rowCount: evs.length };
    }

    // 7. SELECT expense_id, current_version FROM expenses
    if (s.includes("FROM expenses WHERE workspace_id = $1")) {
      const wsId = params?.[0];
      let exps = this.expenses.filter((e) => e.workspace_id === wsId);
      if (s.includes("AND expense_id = ANY($2)")) {
        const allowedIds = params?.[1] as string[];
        exps = exps.filter((e) => allowedIds.includes(e.expense_id));
      }
      return { rows: exps as T[], rowCount: exps.length };
    }

    // 8. SELECT version, amount, currency, recipient FROM expense_versions
    if (s.includes("SELECT version, amount, currency, recipient FROM expense_versions")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const vers = this.expenseVersions.filter(
        (v) => v.workspace_id === wsId && v.expense_id === expId,
      );
      return { rows: vers as T[], rowCount: vers.length };
    }

    // 9. SELECT version, commitment, record_ciphertext, salt_ciphertext FROM expense_versions
    if (s.includes("SELECT version, commitment, record_ciphertext, salt_ciphertext FROM expense_versions")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const vers = this.expenseVersions.filter(
        (v) => v.workspace_id === wsId && v.expense_id === expId,
      );
      return { rows: vers as T[], rowCount: vers.length };
    }

    // 10. SELECT byte_length FROM evidence_objects
    if (s.includes("SELECT byte_length FROM evidence_objects")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const ver = params?.[2];
      const evs = this.evidenceObjects.filter(
        (e) =>
          e.workspace_id === wsId &&
          e.expense_id === expId &&
          e.version === ver,
      );
      return { rows: evs as T[], rowCount: evs.length };
    }

    // 11. SELECT evidence_id, storage_key, sha256_hash, byte_length, mime_type, encryption_metadata, created_at FROM evidence_objects
    if (s.includes("SELECT evidence_id, storage_key, sha256_hash, byte_length, mime_type")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const ver = params?.[2];
      const evs = this.evidenceObjects.filter(
        (e) =>
          e.workspace_id === wsId &&
          e.expense_id === expId &&
          e.version === ver,
      );
      return { rows: evs as T[], rowCount: evs.length };
    }

    // 12. SELECT status FROM reimbursements
    if (s.includes("FROM reimbursements WHERE workspace_id = $1 AND expense_id = $2")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const reims = this.reimbursements.filter(
        (r) =>
          r.workspace_id === wsId &&
          r.expense_id === expId &&
          r.status === "confirmed",
      );
      return { rows: reims as T[], rowCount: reims.length };
    }

    // 13. INSERT INTO exports
    if (s.includes("INSERT INTO exports")) {
      this.exports.push({
        export_id: params?.[0] as string,
        workspace_id: params?.[1] as string,
        requested_by: params?.[2] as string,
        filter_criteria: params?.[3] as string,
        package_hash: params?.[4] as string,
        storage_key: params?.[5] as string,
        created_at: params?.[6] as string,
        expires_at: params?.[7] as string,
      });
      return { rows: [] as T[], rowCount: 1 };
    }

    // 14. INSERT INTO audit_events
    if (s.includes("INSERT INTO audit_events")) {
      this.auditEvents.push({
        workspace_id: params?.[0] as string,
        actor_address: params?.[1] as string,
        event_type: params?.[2] as string,
        entity_type: params?.[3] as string,
        entity_id: params?.[4] as string,
        metadata: params?.[5] as string,
        occurred_at: params?.[6] as string,
      });
      return { rows: [] as T[], rowCount: 1 };
    }

    // 15. SELECT export_id, workspace_id, package_hash, storage_key, created_at, expires_at FROM exports
    if (s.includes("FROM exports WHERE workspace_id = $1 AND export_id = $2")) {
      const wsId = params?.[0];
      const expId = params?.[1];
      const found = this.exports.filter(
        (e) => e.workspace_id === wsId && e.export_id === expId,
      );
      return { rows: found as T[], rowCount: found.length };
    }

    throw new Error(`Unhandled mock query: ${sql}`);
  }
}

describe("ExportService (VER-001)", () => {
  let db: MockExportDatabase;
  let storage: MemoryStorageDriver;
  let service: ExportService;

  const WORKSPACE_ID = "ws_test_export_123";
  const OWNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const AUDITOR_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const SUBMITTER_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  function createAuthContext(address: string, isConfirmed = true): AuthContext {
    const session = createSessionPayload({
      userId: `user_${address}`,
      address,
      chainId: 10143,
    });
    if (isConfirmed) {
      session.confirmedAt = new Date().toISOString();
    }
    return {
      userId: `user_${address}`,
      address,
      session,
    };
  }

  beforeEach(async () => {
    db = new MockExportDatabase();
    storage = new MemoryStorageDriver();
    service = new ExportService(db, storage);

    // Setup workspace and memberships
    db.workspaces.push({
      workspace_id: WORKSPACE_ID,
      created_by: OWNER_ADDRESS,
      name: "Acme Treasury",
    });

    db.memberships.push(
      {
        membership_id: "mem_owner",
        workspace_id: WORKSPACE_ID,
        user_id: `user_${OWNER_ADDRESS}`,
        address: OWNER_ADDRESS,
        status: "active",
      },
      {
        membership_id: "mem_auditor",
        workspace_id: WORKSPACE_ID,
        user_id: `user_${AUDITOR_ADDRESS}`,
        address: AUDITOR_ADDRESS,
        status: "active",
      },
      {
        membership_id: "mem_submitter",
        workspace_id: WORKSPACE_ID,
        user_id: `user_${SUBMITTER_ADDRESS}`,
        address: SUBMITTER_ADDRESS,
        status: "active",
      },
    );

    db.roleGrants.push(
      {
        grant_id: "grant_owner",
        workspace_id: WORKSPACE_ID,
        address: OWNER_ADDRESS,
        role: ROLE_IDENTIFIERS.OWNER_ROLE,
        scope: GLOBAL_SCOPE,
        granted_at: new Date("2026-09-01T00:00:00Z"),
        revoked_at: null,
      },
      {
        grant_id: "grant_auditor",
        workspace_id: WORKSPACE_ID,
        address: AUDITOR_ADDRESS,
        role: ROLE_IDENTIFIERS.AUDITOR_ROLE,
        scope: GLOBAL_SCOPE,
        granted_at: new Date("2026-09-01T00:00:00Z"),
        revoked_at: null,
      },
    );

    db.workspacePolicies.push({
      workspace_id: WORKSPACE_ID,
      policy_version: 1,
      policy_commitment: "0x" + "11".repeat(32),
      created_by: OWNER_ADDRESS,
    });

    // Populate an expense with private encrypted record and evidence
    const expenseId = "exp_001";
    const privatePayload = {
      title: "Confidential Consulting Services",
      businessPurpose: "Q3 Auditing Services",
      category: "legal_and_professional",
      project: "Project Phoenix",
      merchant: "TopTier Legal LLC",
      expenseDate: "2026-09-10",
      claimAmount: "5000.00",
      claimAsset: "0x" + "22".repeat(20),
      recipient: "0x" + "33".repeat(20),
      paymentSource: "manual",
    };

    const { recordCiphertext, saltCiphertext } = encryptTestPayload(
      WORKSPACE_ID,
      expenseId,
      1,
      privatePayload,
    );

    db.expenses.push({
      workspace_id: WORKSPACE_ID,
      expense_id: expenseId,
      created_by: SUBMITTER_ADDRESS,
      current_version: 1,
      created_at: new Date("2026-09-10T12:00:00Z").toISOString(),
    });

    db.expenseVersions.push({
      workspace_id: WORKSPACE_ID,
      expense_id: expenseId,
      version: 1,
      commitment: "0x" + "aa".repeat(32),
      record_ciphertext: recordCiphertext,
      salt_ciphertext: saltCiphertext,
      amount: "5000000000",
      currency: "USDC",
      recipient: "0x" + "33".repeat(20),
    });

    // Attached PDF receipt
    const evidenceId = "ev_receipt_001";
    const rawPdf = Buffer.from("%PDF-1.4 dummy evidence pdf content");
    const { ciphertext: encPdf, metadata: pdfMeta } = encryptTestEvidence(
      WORKSPACE_ID,
      expenseId,
      1,
      evidenceId,
      rawPdf,
    );
    const pdfStorageKey = `evidence/${WORKSPACE_ID}/${evidenceId}.enc`;
    await storage.put(pdfStorageKey, encPdf);

    db.evidenceObjects.push({
      evidence_id: evidenceId,
      workspace_id: WORKSPACE_ID,
      expense_id: expenseId,
      version: 1,
      storage_key: pdfStorageKey,
      sha256_hash: computePackageFileHash(rawPdf),
      byte_length: rawPdf.length,
      mime_type: "application/pdf",
      encryption_metadata: pdfMeta,
      created_at: new Date("2026-09-10T12:05:00Z").toISOString(),
    });

    // Mock indexed onchain event
    db.indexedEvents.push({
      workspace_id: WORKSPACE_ID,
      block_number: 100,
      transaction_hash: "0x" + "99".repeat(32),
      log_index: 0,
      event_name: "ExpenseVersionSubmitted",
      contract_address: "0x" + "11".repeat(20),
      payload: JSON.stringify({ expenseId, version: 1 }),
    });
  });

  describe("Authorization & Confirmation (RULES §8)", () => {
    it("fails if caller lacks recent confirmation", async () => {
      const unconfirmedContext = createAuthContext(OWNER_ADDRESS, false);
      await expect(
        service.previewDisclosure(WORKSPACE_ID, {}, unconfirmedContext),
      ).rejects.toThrow(/confirmation/i);

      await expect(
        service.generateExportPackage(
          WORKSPACE_ID,
          { disclosureLevel: "FULL" },
          unconfirmedContext,
        ),
      ).rejects.toThrow(/confirmation/i);
    });

    it("fails if caller is a submitter without owner, admin, or auditor role", async () => {
      const submitterContext = createAuthContext(SUBMITTER_ADDRESS, true);
      await expect(
        service.previewDisclosure(WORKSPACE_ID, {}, submitterContext),
      ).rejects.toThrow(/restricted to workspace owners/i);

      await expect(
        service.generateExportPackage(
          WORKSPACE_ID,
          { disclosureLevel: "FULL" },
          submitterContext,
        ),
      ).rejects.toThrow(/restricted to workspace owners/i);
    });

    it("succeeds for auditor with fresh confirmation", async () => {
      const auditorContext = createAuthContext(AUDITOR_ADDRESS, true);
      const preview = await service.previewDisclosure(WORKSPACE_ID, {}, auditorContext);
      expect(preview.totalExpenses).toBe(1);
    });
  });

  describe("previewDisclosure", () => {
    it("returns truthful disclosure metrics, confidential fields, and impact notices", async () => {
      const context = createAuthContext(OWNER_ADDRESS, true);
      const preview = await service.previewDisclosure(WORKSPACE_ID, {}, context);

      expect(preview.workspaceId).toBe(WORKSPACE_ID);
      expect(preview.totalExpenses).toBe(1);
      expect(preview.totalVersions).toBe(1);
      expect(preview.totalEvidenceFiles).toBe(1);
      expect(preview.totalEvidenceSizeBytes).toBeGreaterThan(0);
      expect(preview.confidentialFieldNames).toContain("merchant");
      expect(preview.confidentialFieldNames).toContain("businessPurpose");
      expect(preview.modes.FULL.disclosesPrivateRecords).toBe(true);
      expect(preview.modes.REDACTED.disclosesPrivateRecords).toBe(false);
      expect(preview.modes.REDACTED.verificationImpact).toContain("UNVERIFIABLE/UNAVAILABLE");
    });
  });

  describe("generateExportPackage (FULL mode)", () => {
    it("creates a deterministic ZIP package with decrypted records and valid manifest", async () => {
      const context = createAuthContext(OWNER_ADDRESS, true);
      const result = await service.generateExportPackage(
        WORKSPACE_ID,
        { disclosureLevel: "FULL" },
        context,
      );

      expect(result.disclosureLevel).toBe("FULL");
      expect(result.packageHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.zipBuffer.length).toBeGreaterThan(0);

      // Validate manifest using @clario/protocol validator
      const validatedManifest = validateVerificationPackageManifestV1(result.manifest);
      expect(validatedManifest.disclosureLevel).toBe("FULL");
      expect(validatedManifest.schemaVersion).toBe(1);
      expect(computeCanonicalManifestHash(validatedManifest)).toBe(result.packageHash);

      // Unpack ZIP and verify entries
      const entries = extractZipEntries(result.zipBuffer);
      const paths = entries.map((e) => e.path);

      expect(paths).toContain("clario-export/manifest.json");
      expect(paths).toContain("clario-export/workspace-policy.json");
      expect(paths).toContain("clario-export/chain/deployment-manifest.json");
      expect(paths).toContain("clario-export/chain/expected-events.json");
      expect(paths).toContain("clario-export/expenses/exp_001/v1/record.json");
      expect(paths).toContain("clario-export/expenses/exp_001/v1/salt.txt");
      expect(paths).toContain("clario-export/expenses/exp_001/v1/evidence-manifest.json");
      expect(paths).toContain("clario-export/evidence/ev_receipt_001.pdf");

      // Verify decrypted record matches original confidential title
      const recordEntry = entries.find((e) => e.path === "clario-export/expenses/exp_001/v1/record.json")!;
      const recordJson = JSON.parse(recordEntry.data.toString("utf8"));
      expect(recordJson.title).toBe("Confidential Consulting Services");
      expect(recordJson.merchant).toBe("TopTier Legal LLC");

      // Verify decrypted evidence matches original bytes
      const evidenceEntry = entries.find((e) => e.path === "clario-export/evidence/ev_receipt_001.pdf")!;
      expect(evidenceEntry.data.toString("utf8")).toBe("%PDF-1.4 dummy evidence pdf content");

      // Verify salt.txt contains 32-byte hex
      const saltEntry = entries.find((e) => e.path === "clario-export/expenses/exp_001/v1/salt.txt")!;
      expect(saltEntry.data.toString("utf8")).toMatch(/^0x[0-9a-f]{64}$/);

      // Verify audit events recorded without private data
      expect(db.auditEvents.length).toBe(1);
      expect(db.auditEvents[0]!.event_type).toBe("export_generated");
      expect(db.auditEvents[0]!.metadata).not.toContain("Confidential Consulting Services");
      expect(db.auditEvents[0]!.metadata).not.toContain("TopTier Legal LLC");
    });
  });

  describe("generateExportPackage (REDACTED mode)", () => {
    it("omits private records, salts, and evidence files, marking them as redacted", async () => {
      const context = createAuthContext(OWNER_ADDRESS, true);
      const result = await service.generateExportPackage(
        WORKSPACE_ID,
        { disclosureLevel: "REDACTED" },
        context,
      );

      expect(result.disclosureLevel).toBe("REDACTED");

      // Validate manifest
      const validatedManifest = validateVerificationPackageManifestV1(result.manifest);
      expect(validatedManifest.disclosureLevel).toBe("REDACTED");

      // Unpack ZIP
      const entries = extractZipEntries(result.zipBuffer);
      const paths = entries.map((e) => e.path);

      // Private files must NOT exist in the ZIP
      expect(paths).not.toContain("clario-export/expenses/exp_001/v1/record.json");
      expect(paths).not.toContain("clario-export/expenses/exp_001/v1/salt.txt");
      expect(paths).not.toContain("clario-export/evidence/ev_receipt_001.pdf");

      // Public files must be present
      expect(paths).toContain("clario-export/manifest.json");
      expect(paths).toContain("clario-export/workspace-policy.json");
      expect(paths).toContain("clario-export/chain/deployment-manifest.json");
      expect(paths).toContain("clario-export/chain/expected-events.json");

      // Manifest files must flag omitted confidential records with isRedacted: true and 64 zeros hash
      const recordMeta = result.manifest.files.find(
        (f) => f.path === "expenses/exp_001/v1/record.json",
      );
      expect(recordMeta).toBeDefined();
      expect(recordMeta?.isRedacted).toBe(true);
      expect(recordMeta?.sha256).toBe("0".repeat(64));

      const evMeta = result.manifest.files.find(
        (f) => f.path === "evidence/ev_receipt_001.pdf",
      );
      expect(evMeta).toBeDefined();
      expect(evMeta?.isRedacted).toBe(true);
    });
  });

  describe("getExportPackage", () => {
    it("retrieves previously stored package and fails when expired", async () => {
      const context = createAuthContext(OWNER_ADDRESS, true);
      const generated = await service.generateExportPackage(
        WORKSPACE_ID,
        { disclosureLevel: "FULL", retentionHours: 1 },
        context,
      );

      const stored = await service.getExportPackage(
        WORKSPACE_ID,
        generated.exportId,
        context,
      );
      expect(stored.exportId).toBe(generated.exportId);
      expect(stored.data.equals(generated.zipBuffer)).toBe(true);

      // Simulate expired export
      const expRow = db.exports.find((e) => e.export_id === generated.exportId)!;
      expRow.expires_at = new Date(Date.now() - 1000).toISOString();

      await expect(
        service.getExportPackage(WORKSPACE_ID, generated.exportId, context),
      ).rejects.toThrow(/retention policy/i);
    });
  });
});
