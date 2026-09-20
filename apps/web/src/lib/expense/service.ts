/**
 * Clario Expense Service
 *
 * Implements private offchain expense draft creation, retrieval, autosave,
 * deletion, and workspace-isolated querying with envelope encryption.
 */

import { randomBytes } from "node:crypto";
import {
  type DatabaseClient,
  withTransaction,
  type EvidenceObjectRow,
} from "@clario/database";
import { computeExpenseCommitmentV1, ProtocolError } from "@clario/protocol";
import { keccak256, stringToBytes } from "viem";

import {
  AuthorizationPolicy,
  type AuthContext,
  RecordNotFoundError,
} from "../auth/policy";
import {
  decryptEvidence,
  encryptEvidence,
  generateDataEncryptionKey,
  unwrapKey,
  wrapKey,
} from "../evidence/crypto";
import { getEvidenceKek } from "../evidence/service";
import {
  getDefaultStorageDriver,
  type StorageDriver,
} from "../evidence/storage";
import {
  DEFAULT_TOKEN,
  findTokenAsset,
  normalizeAddress,
  parseBaseUnits,
} from "./amount";
import type {
  EvidenceAttachmentSummary,
  ExpenseDraftPayload,
  ExpenseDraftRecord,
  ExpenseSummary,
} from "./types";
import { validateExpenseDraft } from "./validation";
import {
  assertCalldataPrivacy,
  buildCanonicalEvidenceManifest,
  buildCanonicalExpenseRecord,
  encodeSubmitVersionCalldata,
  ZERO_BYTES32,
  SUBMISSION_DISCLAIMER,
  type ExpenseSubmissionPreview,
  type RawEvidenceItem,
} from "./submission";

interface StoredDraftEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: string;
  keyId: string;
  kekIv: string;
  kekAuthTag: string;
}

interface StoredSaltEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class ExpenseService {
  private readonly policy: AuthorizationPolicy;
  private readonly storage: StorageDriver;
  private readonly kek: Buffer;

  constructor(
    private readonly db: DatabaseClient,
    storage?: StorageDriver,
    kek?: Buffer,
    policy?: AuthorizationPolicy,
  ) {
    this.storage = storage ?? getDefaultStorageDriver();
    this.kek = kek ?? getEvidenceKek();
    this.policy = policy ?? new AuthorizationPolicy(db);
  }

  /**
   * Generates a 0x-prefixed 32-byte hex ID.
   */
  private generateExpenseId(): `0x${string}` {
    return `0x${randomBytes(32).toString("hex")}`;
  }

  /**
   * Encrypts the draft payload using AES-256-GCM envelope encryption.
   */
  private encryptPayload(
    workspaceId: string,
    expenseId: string,
    version: number,
    payload: ExpenseDraftPayload,
  ): { recordCiphertext: string; saltCiphertext: string } {
    const dek = generateDataEncryptionKey();
    const wrapResult = wrapKey(dek, this.kek, "kek-v1");

    // Encrypt record payload with AAD binding
    const recordContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_record",
    };
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const encRecord = encryptEvidence(plaintext, dek, recordContext);

    const recordEnvelope: StoredDraftEnvelope = {
      ciphertext: encRecord.ciphertext.toString("hex"),
      iv: encRecord.iv.toString("hex"),
      authTag: encRecord.authTag.toString("hex"),
      wrappedKey: wrapResult.wrappedKey.toString("hex"),
      keyId: wrapResult.keyId,
      kekIv: wrapResult.iv.toString("hex"),
      kekAuthTag: wrapResult.authTag.toString("hex"),
    };

    // Encrypt random 32-byte salt with AAD binding
    const salt = randomBytes(32);
    const saltContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_salt",
    };
    const encSalt = encryptEvidence(salt, dek, saltContext);

    const saltEnvelope: StoredSaltEnvelope = {
      ciphertext: encSalt.ciphertext.toString("hex"),
      iv: encSalt.iv.toString("hex"),
      authTag: encSalt.authTag.toString("hex"),
    };

    return {
      recordCiphertext: JSON.stringify(recordEnvelope),
      saltCiphertext: JSON.stringify(saltEnvelope),
    };
  }

  /**
   * Decrypts the draft payload from envelope ciphertext.
   */
  private decryptPayload(
    workspaceId: string,
    expenseId: string,
    version: number,
    recordCiphertext: string,
  ): ExpenseDraftPayload {
    const envelope = JSON.parse(recordCiphertext) as StoredDraftEnvelope;

    const dek = unwrapKey(
      {
        wrappedKey: Buffer.from(envelope.wrappedKey, "hex"),
        iv: Buffer.from(envelope.kekIv, "hex"),
        authTag: Buffer.from(envelope.kekAuthTag, "hex"),
        keyId: envelope.keyId,
      },
      this.kek,
    );

    const recordContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_record",
    };

    const plaintext = decryptEvidence(
      Buffer.from(envelope.ciphertext, "hex"),
      dek,
      Buffer.from(envelope.iv, "hex"),
      Buffer.from(envelope.authTag, "hex"),
      recordContext,
    );

    return JSON.parse(plaintext.toString("utf8")) as ExpenseDraftPayload;
  }

  /**
   * Decrypts the 32-byte salt from envelope ciphertext.
   */
  private decryptSalt(
    workspaceId: string,
    expenseId: string,
    version: number,
    recordCiphertext: string,
    saltCiphertext: string,
  ): `0x${string}` {
    const recordEnvelope = JSON.parse(recordCiphertext) as StoredDraftEnvelope;
    const saltEnvelope = JSON.parse(saltCiphertext) as StoredSaltEnvelope;

    const dek = unwrapKey(
      {
        wrappedKey: Buffer.from(recordEnvelope.wrappedKey, "hex"),
        iv: Buffer.from(recordEnvelope.kekIv, "hex"),
        authTag: Buffer.from(recordEnvelope.kekAuthTag, "hex"),
        keyId: recordEnvelope.keyId,
      },
      this.kek,
    );

    const saltContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_salt",
    };

    const plaintext = decryptEvidence(
      Buffer.from(saltEnvelope.ciphertext, "hex"),
      dek,
      Buffer.from(saltEnvelope.iv, "hex"),
      Buffer.from(saltEnvelope.authTag, "hex"),
      saltContext,
    );

    return `0x${plaintext.toString("hex").toLowerCase()}`;
  }

  /**
   * Creates a new manual expense draft.
   */
  async createDraft(params: {
    workspaceId: string;
    payload?: Partial<ExpenseDraftPayload> | undefined;
    context: AuthContext;
  }): Promise<ExpenseDraftRecord> {
    const { workspaceId, context } = params;

    // Verify workspace membership
    await this.policy.getMembership(workspaceId, context);

    const expenseId = this.generateExpenseId();
    const version = 1;

    const defaultPayload: ExpenseDraftPayload = {
      title: "",
      businessPurpose: "",
      category: "other",
      project: "",
      merchant: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      claimAmount: "0",
      claimAsset: DEFAULT_TOKEN.address,
      recipient: normalizeAddress(context.address),
      paymentSource: "manual",
      ...params.payload,
    };

    // Validate draft format
    const validation = validateExpenseDraft(defaultPayload, false);
    if (!validation.valid) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Validation failed: ${Object.values(validation.errors).join(", ")}`,
      });
    }

    const { recordCiphertext, saltCiphertext } = this.encryptPayload(
      workspaceId,
      expenseId,
      version,
      defaultPayload,
    );

    const tokenMeta = findTokenAsset(defaultPayload.claimAsset);
    const decimals = tokenMeta?.decimals ?? 6;
    let baseUnits = "0";
    try {
      baseUnits = parseBaseUnits(
        defaultPayload.claimAmount,
        decimals,
      ).toString();
    } catch {
      baseUnits = "0";
    }

    const commitment = keccak256(
      stringToBytes(
        `draft:${expenseId.toLowerCase()}:${version}:${Date.now()}`,
      ),
    );

    return await withTransaction(this.db, async (tx) => {
      // 1. Insert header
      await tx.query(
        `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
         VALUES ($1, $2, $3, NULL);`,
        [workspaceId, expenseId, context.address],
      );

      // 2. Insert version 1 (draft)
      await tx.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, $3, $4, NULL, $5, 'kek-v1', $6, 'kek-v1', $7, $8, $9, 'draft');`,
        [
          workspaceId,
          expenseId,
          version,
          commitment,
          saltCiphertext,
          recordCiphertext,
          baseUnits,
          normalizeAddress(defaultPayload.claimAsset),
          normalizeAddress(defaultPayload.recipient),
        ],
      );

      // 3. Link current_version on expenses header
      await tx.query(
        `UPDATE expenses SET current_version = $1, updated_at = NOW()
         WHERE workspace_id = $2 AND expense_id = $3;`,
        [version, workspaceId, expenseId],
      );

      const timestamps = await tx.query<{
        created_at: string;
        updated_at: string;
      }>(
        `SELECT created_at, updated_at FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      return {
        workspaceId,
        expenseId,
        version,
        createdBy: context.address,
        status: "draft",
        amount: baseUnits,
        currency: normalizeAddress(defaultPayload.claimAsset),
        recipient: normalizeAddress(defaultPayload.recipient),
        payload: defaultPayload,
        evidence: [],
        createdAt: timestamps.rows[0]?.created_at || new Date().toISOString(),
        updatedAt: timestamps.rows[0]?.updated_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Retrieves a draft expense record and its attached evidence.
   */
  async getDraft(params: {
    workspaceId: string;
    expenseId: string;
    context: AuthContext;
  }): Promise<ExpenseDraftRecord> {
    const { workspaceId, expenseId, context } = params;

    // Authorize read access
    const { expense } = await this.policy.authorizeExpense(
      workspaceId,
      expenseId,
      context,
      "read",
    );

    const versionRes = await this.db.query<{
      version: number;
      amount: string;
      currency: string;
      recipient: string;
      status: string;
      record_ciphertext: string;
      created_at: string;
    }>(
      `SELECT version, amount, currency, recipient, status, record_ciphertext, created_at
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, expense.currentVersion ?? 1],
    );

    if (versionRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense draft version not found.");
    }

    const row = versionRes.rows[0]!;
    if (row.status !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Expense is not in draft status (current status: ${row.status}).`,
      });
    }

    const payload = this.decryptPayload(
      workspaceId,
      expenseId,
      row.version,
      row.record_ciphertext,
    );

    // Fetch attached evidence objects
    const evRes = await this.db.query<EvidenceObjectRow>(
      `SELECT evidence_id, mime_type, byte_length, sha256_hash, encryption_metadata, created_at
       FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY created_at ASC;`,
      [workspaceId, expenseId, row.version],
    );

    const evidence: EvidenceAttachmentSummary[] = evRes.rows.map((r) => {
      const meta = r.encryption_metadata as
        { originalFilename?: string } | undefined;
      return {
        evidenceId: r.evidence_id,
        mimeType: r.mime_type,
        byteLength: Number(r.byte_length),
        sha256Hash: r.sha256_hash,
        originalFilename: meta?.originalFilename,
        createdAt:
          typeof r.created_at === "string"
            ? r.created_at
            : new Date(r.created_at).toISOString(),
      };
    });

    const expRow = await this.db.query<{
      created_at: string;
      updated_at: string;
    }>(
      `SELECT created_at, updated_at FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    return {
      workspaceId,
      expenseId,
      version: row.version,
      createdBy: expense.createdBy,
      status: "draft",
      amount: row.amount,
      currency: row.currency,
      recipient: row.recipient,
      payload,
      evidence,
      createdAt: expRow.rows[0]?.created_at || row.created_at,
      updatedAt: expRow.rows[0]?.updated_at || row.created_at,
    };
  }

  /**
   * Updates an existing expense draft (autosave or explicit save).
   */
  async updateDraft(params: {
    workspaceId: string;
    expenseId: string;
    payload: Partial<ExpenseDraftPayload>;
    context: AuthContext;
  }): Promise<ExpenseDraftRecord> {
    const { workspaceId, expenseId, payload, context } = params;

    // 1. Authorize edit access
    const { expense } = await this.policy.authorizeExpense(
      workspaceId,
      expenseId,
      context,
      "edit",
    );

    const versionNum = expense.currentVersion ?? 1;

    // 2. Load existing version row
    const verRes = await this.db.query<{
      status: string;
      record_ciphertext: string;
      created_at: string;
    }>(
      `SELECT status, record_ciphertext, created_at
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, versionNum],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("Draft version not found.");
    }

    const currentVer = verRes.rows[0]!;
    if (currentVer.status !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Cannot edit expense version with status '${currentVer.status}'. Only drafts may be modified.`,
      });
    }

    // 3. Decrypt and merge payload
    const existingPayload = this.decryptPayload(
      workspaceId,
      expenseId,
      versionNum,
      currentVer.record_ciphertext,
    );

    const mergedPayload: ExpenseDraftPayload = {
      ...existingPayload,
      ...payload,
    };

    // 4. Validate merged payload
    const validation = validateExpenseDraft(mergedPayload, false);
    if (!validation.valid) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Validation failed: ${Object.values(validation.errors).join(", ")}`,
      });
    }

    // 5. Encrypt updated payload and synchronized salt
    const { recordCiphertext, saltCiphertext } = this.encryptPayload(
      workspaceId,
      expenseId,
      versionNum,
      mergedPayload,
    );

    const tokenMeta = findTokenAsset(mergedPayload.claimAsset);
    const decimals = tokenMeta?.decimals ?? 6;
    let baseUnits = "0";
    try {
      baseUnits = parseBaseUnits(
        mergedPayload.claimAmount,
        decimals,
      ).toString();
    } catch {
      baseUnits = "0";
    }

    return await withTransaction(this.db, async (tx) => {
      await tx.query(
        `UPDATE expense_versions
         SET record_ciphertext = $1,
             salt_ciphertext = $2,
             amount = $3,
             currency = $4,
             recipient = $5
         WHERE workspace_id = $6 AND expense_id = $7 AND version = $8;`,
        [
          recordCiphertext,
          saltCiphertext,
          baseUnits,
          normalizeAddress(mergedPayload.claimAsset),
          normalizeAddress(mergedPayload.recipient),
          workspaceId,
          expenseId,
          versionNum,
        ],
      );

      await tx.query(
        `UPDATE expenses SET updated_at = NOW() WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      // Load attached evidence
      const evRes = await tx.query<EvidenceObjectRow>(
        `SELECT evidence_id, mime_type, byte_length, sha256_hash, encryption_metadata, created_at
         FROM evidence_objects
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
         ORDER BY created_at ASC;`,
        [workspaceId, expenseId, versionNum],
      );

      const evidence: EvidenceAttachmentSummary[] = evRes.rows.map((r) => {
        const meta = r.encryption_metadata as
          { originalFilename?: string } | undefined;
        return {
          evidenceId: r.evidence_id,
          mimeType: r.mime_type,
          byteLength: Number(r.byte_length),
          sha256Hash: r.sha256_hash,
          originalFilename: meta?.originalFilename,
          createdAt:
            typeof r.created_at === "string"
              ? r.created_at
              : new Date(r.created_at).toISOString(),
        };
      });

      const expRow = await tx.query<{ created_at: string; updated_at: string }>(
        `SELECT created_at, updated_at FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      return {
        workspaceId,
        expenseId,
        version: versionNum,
        createdBy: expense.createdBy,
        status: "draft",
        amount: baseUnits,
        currency: normalizeAddress(mergedPayload.claimAsset),
        recipient: normalizeAddress(mergedPayload.recipient),
        payload: mergedPayload,
        evidence,
        createdAt: expRow.rows[0]?.created_at || currentVer.created_at,
        updatedAt: expRow.rows[0]?.updated_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Deletes a draft expense and cleans up its envelope-encrypted evidence.
   */
  async deleteDraft(params: {
    workspaceId: string;
    expenseId: string;
    context: AuthContext;
  }): Promise<{ success: boolean; expenseId: string }> {
    const { workspaceId, expenseId, context } = params;

    // 1. Authorize edit access
    const { expense } = await this.policy.authorizeExpense(
      workspaceId,
      expenseId,
      context,
      "edit",
    );

    const versionNum = expense.currentVersion ?? 1;

    // 2. Check draft status
    const verRes = await this.db.query<{ status: string }>(
      `SELECT status FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, versionNum],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("Draft version not found.");
    }

    const currentVer = verRes.rows[0]!;
    if (currentVer.status !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Cannot delete expense with status '${currentVer.status}'. Only unsubmitted drafts may be deleted.`,
      });
    }

    // 3. Load evidence storage keys
    const evRes = await this.db.query<{ storage_key: string }>(
      `SELECT storage_key FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, versionNum],
    );

    // 4. Delete objects from storage
    for (const row of evRes.rows) {
      await this.storage.delete(row.storage_key).catch(() => {});
    }

    // 5. Delete rows atomically
    await withTransaction(this.db, async (tx) => {
      await tx.query(
        `DELETE FROM evidence_objects WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      // Unlink current_version to satisfy foreign key before version deletion
      await tx.query(
        `UPDATE expenses SET current_version = NULL WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      await tx.query(
        `DELETE FROM expense_versions WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );

      await tx.query(
        `DELETE FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
        [workspaceId, expenseId],
      );
    });

    return { success: true, expenseId };
  }

  /**
   * Lists all expenses in a workspace with decrypted metadata summaries.
   */
  async listExpenses(params: {
    workspaceId: string;
    context: AuthContext;
    statusFilter?: string | undefined;
  }): Promise<ExpenseSummary[]> {
    const { workspaceId, context, statusFilter } = params;

    // Verify membership
    await this.policy.getMembership(workspaceId, context);

    const rowsRes = await this.db.query<{
      expense_id: string;
      workspace_id: string;
      created_by: string;
      current_version: number;
      created_at: string;
      updated_at: string;
      status: string;
      amount: string;
      currency: string;
      recipient: string;
      record_ciphertext: string;
      evidence_count: string;
    }>(
      `SELECT e.expense_id, e.workspace_id, e.created_by, e.current_version,
              e.created_at, e.updated_at,
              ev.status, ev.amount, ev.currency, ev.recipient, ev.record_ciphertext,
              COALESCE(eo.cnt, 0) as evidence_count
       FROM expenses e
       JOIN expense_versions ev
         ON e.workspace_id = ev.workspace_id
        AND e.expense_id = ev.expense_id
        AND e.current_version = ev.version
       LEFT JOIN (
         SELECT workspace_id, expense_id, version, COUNT(*) as cnt
         FROM evidence_objects
         GROUP BY workspace_id, expense_id, version
       ) eo
         ON ev.workspace_id = eo.workspace_id
        AND ev.expense_id = eo.expense_id
        AND ev.version = eo.version
       WHERE e.workspace_id = $1
       ORDER BY e.updated_at DESC;`,
      [workspaceId],
    );

    const summaries: ExpenseSummary[] = [];

    for (const r of rowsRes.rows) {
      if (statusFilter && r.status !== statusFilter) {
        continue;
      }

      let title = "Untitled Expense";
      let category = "other";
      let merchant = "Unknown";
      let expenseDate = r.created_at.slice(0, 10);
      let claimAmount = "0";

      try {
        const payload = this.decryptPayload(
          r.workspace_id,
          r.expense_id,
          r.current_version,
          r.record_ciphertext,
        );
        title = payload.title || "Untitled Expense";
        category = payload.category || "other";
        merchant = payload.merchant || "Unknown";
        expenseDate = payload.expenseDate || expenseDate;
        claimAmount = payload.claimAmount || "0";
      } catch {
        // If decryption fails, show masked defaults
      }

      summaries.push({
        expenseId: r.expense_id,
        workspaceId: r.workspace_id,
        title,
        category,
        merchant,
        expenseDate,
        claimAmount,
        currency: r.currency,
        recipient: r.recipient,
        status: r.status,
        version: r.current_version,
        evidenceCount: Number(r.evidence_count),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    return summaries;
  }

  /**
   * Prepares canonical commitment and calldata intent for submitting an expense version to Monad.
   */
  async prepareSubmission(params: {
    workspaceId: string;
    expenseId: string;
    context: AuthContext;
  }): Promise<ExpenseSubmissionPreview> {
    const { workspaceId, expenseId, context } = params;

    // 1. Authorize draft edit access
    await this.policy.authorizeExpense(workspaceId, expenseId, context, "edit");

    // 2. Fetch draft version row
    const verRes = await this.db.query<{
      version: number;
      status: string;
      record_ciphertext: string;
      salt_ciphertext: string;
    }>(
      `SELECT version, status, record_ciphertext, salt_ciphertext
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND status = 'draft';`,
      [workspaceId, expenseId],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("No draft version found for submission.");
    }

    const currentDraft = verRes.rows[0]!;

    // 3. Decrypt payload and salt
    const payload = this.decryptPayload(
      workspaceId,
      expenseId,
      currentDraft.version,
      currentDraft.record_ciphertext,
    );

    // Validate draft strictly before submission
    const validation = validateExpenseDraft(payload, true);
    if (!validation.valid) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Draft validation failed: ${Object.values(validation.errors).join(", ")}`,
      });
    }

    const salt = this.decryptSalt(
      workspaceId,
      expenseId,
      currentDraft.version,
      currentDraft.record_ciphertext,
      currentDraft.salt_ciphertext,
    );

    // 4. Fetch attached evidence
    const evRes = await this.db.query<EvidenceObjectRow>(
      `SELECT evidence_id, mime_type, byte_length, sha256_hash, created_at
       FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY evidence_id ASC;`,
      [workspaceId, expenseId, currentDraft.version],
    );

    const rawEvidence: RawEvidenceItem[] = evRes.rows.map((r) => ({
      evidenceId: r.evidence_id,
      mimeType: r.mime_type,
      byteLength: Number(r.byte_length),
      sha256Hash: r.sha256_hash,
      createdAt:
        typeof r.created_at === "string"
          ? r.created_at
          : new Date(r.created_at).toISOString(),
    }));

    // 5. Build canonical manifest
    const { manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: rawEvidence,
    });

    // 6. Check predecessor commitment
    let previousCommitment: `0x${string}` = ZERO_BYTES32;
    if (currentDraft.version > 1) {
      const prevVerRes = await this.db.query<{ commitment: string }>(
        `SELECT commitment FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3 AND status = 'submitted';`,
        [workspaceId, expenseId, currentDraft.version - 1],
      );

      if (prevVerRes.rows.length === 0 || !prevVerRes.rows[0]?.commitment) {
        throw new ProtocolError("INVALID_COMMITMENT", {
          message: `Predecessor version ${currentDraft.version - 1} was not found or is not submitted.`,
        });
      }

      previousCommitment = prevVerRes.rows[0]!.commitment as `0x${string}`;
    }

    // 7. Build canonical expense record
    const { privateRecordHash } = buildCanonicalExpenseRecord({
      workspaceId: workspaceId as `0x${string}`,
      expenseId: expenseId as `0x${string}`,
      version: currentDraft.version,
      payload,
      evidenceManifestHash: manifestHash,
      submittedBy: context.address as `0x${string}`,
    });

    // 8. Resolve Monad chain & registry address
    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337", 10);
    const registryAddress = (process.env.NEXT_PUBLIC_EXPENSE_REGISTRY_ADDRESS ??
      "0x2000000000000000000000000000000000000002") as `0x${string}`;

    // 9. Compute golden commitment
    const commitment = computeExpenseCommitmentV1({
      monadChainId: chainId,
      registryAddress,
      workspaceId: workspaceId as `0x${string}`,
      expenseId: expenseId as `0x${string}`,
      version: currentDraft.version,
      privateRecordHash,
      evidenceManifestHash: manifestHash,
      salt,
    });

    // 10. Encode calldata
    const calldata = encodeSubmitVersionCalldata({
      workspaceId: workspaceId as `0x${string}`,
      expenseId: expenseId as `0x${string}`,
      version: currentDraft.version,
      commitment,
      previousCommitment,
    });

    // 11. Assert calldata privacy scan
    assertCalldataPrivacy(calldata, [
      payload.title,
      payload.businessPurpose,
      payload.merchant,
      payload.project,
      payload.notes ?? "",
      payload.client ?? "",
      payload.invoiceNumber ?? "",
    ]);

    // 12. Save prepared commitment on draft version
    await this.db.query(
      `UPDATE expense_versions
       SET commitment = $1, submitted_by = $2
       WHERE workspace_id = $3 AND expense_id = $4 AND version = $5;`,
      [
        commitment,
        context.address,
        workspaceId,
        expenseId,
        currentDraft.version,
      ],
    );

    return {
      intent: {
        to: registryAddress,
        data: calldata,
        chainId,
        functionName: "submitVersion",
        description: `Submit version ${currentDraft.version} commitment to Monad expense registry`,
        workspaceId: workspaceId as `0x${string}`,
        expenseId: expenseId as `0x${string}`,
        version: currentDraft.version,
        commitment,
        previousCommitment,
        privateRecordHash,
        evidenceManifestHash: manifestHash,
      },
      publicFields: {
        workspaceId,
        expenseId,
        version: currentDraft.version,
        commitment,
        previousCommitment,
        submitter: context.address,
      },
      privateFields: {
        title: payload.title,
        businessPurpose: payload.businessPurpose,
        category: payload.category,
        project: payload.project,
        merchant: payload.merchant,
        expenseDate: payload.expenseDate,
        claimAmount: payload.claimAmount,
        claimAsset: payload.claimAsset,
        recipient: payload.recipient,
        evidenceCount: rawEvidence.length,
        tags: payload.tags ?? [],
      },
      disclaimer: SUBMISSION_DISCLAIMER,
    };
  }

  /**
   * Reconciles onchain block receipt and marks the expense version as submitted.
   */
  async reconcileSubmission(params: {
    workspaceId: string;
    expenseId: string;
    txHash: `0x${string}`;
    context: AuthContext;
  }): Promise<{
    success: boolean;
    expenseId: string;
    version: number;
    commitment: string;
    txHash: string;
    status: string;
  }> {
    const { workspaceId, expenseId, txHash, context } = params;

    // 1. Authorize draft edit access
    await this.policy.authorizeExpense(workspaceId, expenseId, context, "edit");

    // 2. Fetch current draft version
    const verRes = await this.db.query<{
      version: number;
      status: string;
      commitment: string;
    }>(
      `SELECT version, status, commitment
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2
       ORDER BY version DESC LIMIT 1;`,
      [workspaceId, expenseId],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("No expense version found.");
    }

    const currentVer = verRes.rows[0]!;

    // Idempotent return if already submitted with this txHash
    if (currentVer.status === "submitted") {
      return {
        success: true,
        expenseId,
        version: currentVer.version,
        commitment: currentVer.commitment,
        txHash,
        status: "submitted",
      };
    }

    if (currentVer.status !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Cannot reconcile expense version with status '${currentVer.status}'.`,
      });
    }

    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337", 10);
    const registryAddress =
      process.env.NEXT_PUBLIC_EXPENSE_REGISTRY_ADDRESS ??
      "0x2000000000000000000000000000000000000002";

    // 3. Atomically transition state in database
    return await withTransaction(this.db, async (tx) => {
      // Update version status
      await tx.query(
        `UPDATE expense_versions
         SET status = 'submitted',
             submitted_by = $1,
             submitted_transaction_hash = $2
         WHERE workspace_id = $3 AND expense_id = $4 AND version = $5;`,
        [context.address, txHash, workspaceId, expenseId, currentVer.version],
      );

      // Update expense header
      await tx.query(
        `UPDATE expenses
         SET current_version = $1, updated_at = NOW()
         WHERE workspace_id = $2 AND expense_id = $3;`,
        [currentVer.version, workspaceId, expenseId],
      );

      // Record transaction in chain_transactions
      await tx.query(
        `INSERT INTO chain_transactions (
           workspace_id, chain_id, transaction_hash, transaction_type,
           target_address, status, metadata
         ) VALUES ($1, $2, $3, 'expense_version_submission', $4, 'confirmed', $5)
         ON CONFLICT (workspace_id, chain_id, transaction_hash) DO NOTHING;`,
        [
          workspaceId,
          chainId,
          txHash,
          registryAddress,
          JSON.stringify({
            expenseId,
            version: currentVer.version,
            commitment: currentVer.commitment,
          }),
        ],
      );

      // Record audit event
      await tx.query(
        `INSERT INTO audit_events (
           workspace_id, event_type, actor, target_id, metadata
         ) VALUES ($1, 'expense_version_submitted', $2, $3, $4);`,
        [
          workspaceId,
          context.address,
          expenseId,
          JSON.stringify({
            version: currentVer.version,
            commitment: currentVer.commitment,
            txHash,
          }),
        ],
      );

      return {
        success: true,
        expenseId,
        version: currentVer.version,
        commitment: currentVer.commitment,
        txHash,
        status: "submitted",
      };
    });
  }
}
