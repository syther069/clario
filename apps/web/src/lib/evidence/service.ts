import { randomUUID } from "node:crypto";
import { ProtocolError } from "@clario/protocol";
import type { DatabaseClient, EvidenceObjectRow } from "@clario/database";
import {
  AuthorizationPolicy,
  type AuthContext,
  RecordNotFoundError,
  GLOBAL_SCOPE,
} from "../auth/policy";
import {
  computeSha256,
  decryptEvidence,
  encryptEvidence,
  generateDataEncryptionKey,
  unwrapKey,
  wrapKey,
} from "./crypto";
import {
  generateEvidenceStorageKey,
  getDefaultStorageDriver,
  type StorageDriver,
} from "./storage";

export function getEvidenceKek(): Buffer {
  const hex = process.env.CLARIO_EVIDENCE_KEK;
  if (hex) {
    const clean = hex.replace(/^0x/, "");
    const buf = Buffer.from(clean, "hex");
    if (buf.length === 32) return buf;
  }
  if (
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
  ) {
    return Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex",
    );
  }
  throw new Error(
    "CLARIO_EVIDENCE_KEK environment variable is required and must be a 32-byte hex string in production.",
  );
}

export interface UploadEvidenceParams {
  workspaceId: string;
  expenseId: string;
  version: number;
  data: Buffer;
  mimeType: string;
  context: AuthContext;
  filename?: string | undefined;
}

export interface UploadEvidenceResult {
  evidenceId: string;
  workspaceId: string;
  expenseId: string;
  version: number;
  storageKey: string;
  sha256Hash: string;
  byteLength: number;
  mimeType: string;
  createdAt: string;
}

export interface DownloadEvidenceParams {
  workspaceId: string;
  expenseId: string;
  evidenceId: string;
  context: AuthContext;
  targetScope?: string | undefined;
}

export interface DownloadEvidenceResult {
  evidenceId: string;
  workspaceId: string;
  expenseId: string;
  version: number;
  data: Buffer;
  mimeType: string;
  sha256Hash: string;
  byteLength: number;
}

export interface StoredEncryptionMetadata {
  algorithm: string;
  keyId: string;
  wrappedKey: string;
  iv: string;
  authTag: string;
  kekIv: string;
  kekAuthTag: string;
  originalFilename?: string | undefined;
}

export class EvidenceService {
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
   * Uploads and envelope-encrypts an evidence file for a draft expense version.
   * Rejects modifications to submitted or finalized versions.
   */
  async uploadEvidence(
    params: UploadEvidenceParams,
  ): Promise<UploadEvidenceResult> {
    const { workspaceId, expenseId, version, data, mimeType, context } = params;

    // 1. Authorize draft edit access
    await this.policy.authorizeExpense(workspaceId, expenseId, context, "edit");

    // 2. Check that the expense version is currently in draft status
    const verRes = await this.db.query<{ status: string }>(
      `SELECT status FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, version],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError(
        "The specified expense version was not found.",
      );
    }

    const versionStatus = verRes.rows[0]!.status;
    if (versionStatus !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Cannot upload evidence to an expense version with status '${versionStatus}'. Modifications require creating a new draft version.`,
      });
    }

    // 3. Generate random ID and keys
    const evidenceId = randomUUID();
    const storageKey = generateEvidenceStorageKey(workspaceId, evidenceId);
    const sha256Hash = computeSha256(data);
    const dek = generateDataEncryptionKey();

    // 4. AES-256-GCM envelope encryption with context binding
    const authContext = {
      workspaceId,
      expenseId,
      version,
      evidenceId,
    };
    const encResult = encryptEvidence(data, dek, authContext);
    const wrapResult = wrapKey(dek, this.kek, "kek-v1");

    // 5. Write ciphertext to private object storage
    await this.storage.put(
      storageKey,
      encResult.ciphertext,
      "application/octet-stream",
    );

    // 6. Record metadata in database
    const metadata: StoredEncryptionMetadata = {
      algorithm: "aes-256-gcm",
      keyId: wrapResult.keyId,
      wrappedKey: wrapResult.wrappedKey.toString("hex"),
      iv: encResult.iv.toString("hex"),
      authTag: encResult.authTag.toString("hex"),
      kekIv: wrapResult.iv.toString("hex"),
      kekAuthTag: wrapResult.authTag.toString("hex"),
      ...(params.filename ? { originalFilename: params.filename } : {}),
    };

    const createdAt = new Date().toISOString();
    await this.db.query(
      `INSERT INTO evidence_objects (
         evidence_id, workspace_id, expense_id, version,
         storage_key, sha256_hash, byte_length, mime_type,
         encryption_metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
      [
        evidenceId,
        workspaceId,
        expenseId,
        version,
        storageKey,
        sha256Hash,
        data.length,
        mimeType,
        JSON.stringify(metadata),
        createdAt,
      ],
    );

    return {
      evidenceId,
      workspaceId,
      expenseId,
      version,
      storageKey,
      sha256Hash,
      byteLength: data.length,
      mimeType,
      createdAt,
    };
  }

  /**
   * Authorizes, downloads, decrypts, and verifies integrity of an evidence object.
   * Fails closed if ciphertext, IV, auth tag, or context are tampered with.
   */
  async downloadEvidence(
    params: DownloadEvidenceParams,
  ): Promise<DownloadEvidenceResult> {
    const {
      workspaceId,
      expenseId,
      evidenceId,
      context,
      targetScope = GLOBAL_SCOPE,
    } = params;

    // 1. Authorize evidence read access (enforces admin isolation & role scoping)
    await this.policy.authorizeEvidence(
      workspaceId,
      expenseId,
      evidenceId,
      context,
      "read",
      targetScope,
    );

    // 2. Fetch evidence metadata row
    const evRes = await this.db.query<EvidenceObjectRow>(
      `SELECT evidence_id, workspace_id, expense_id, version,
              storage_key, sha256_hash, byte_length, mime_type,
              encryption_metadata, created_at
       FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND evidence_id = $3;`,
      [workspaceId, expenseId, evidenceId],
    );

    if (evRes.rows.length === 0) {
      throw new RecordNotFoundError("Evidence record not found.");
    }

    const row = evRes.rows[0]!;
    const rawMeta =
      typeof row.encryption_metadata === "string"
        ? (JSON.parse(row.encryption_metadata) as StoredEncryptionMetadata)
        : (row.encryption_metadata as unknown as StoredEncryptionMetadata);

    // 3. Fetch ciphertext from storage
    const ciphertext = await this.storage.get(row.storage_key);
    if (!ciphertext) {
      throw new RecordNotFoundError(
        "Evidence ciphertext object not found in private storage.",
      );
    }

    // 4. Unwrap DEK using KEK
    const dek = unwrapKey(
      {
        wrappedKey: Buffer.from(rawMeta.wrappedKey, "hex"),
        iv: Buffer.from(rawMeta.kekIv, "hex"),
        authTag: Buffer.from(rawMeta.kekAuthTag, "hex"),
        keyId: rawMeta.keyId,
      },
      this.kek,
    );

    // 5. Decrypt evidence with authenticated context
    const authContext = {
      workspaceId: row.workspace_id,
      expenseId: row.expense_id,
      version: row.version,
      evidenceId: row.evidence_id,
    };

    const plaintext = decryptEvidence(
      ciphertext,
      dek,
      Buffer.from(rawMeta.iv, "hex"),
      Buffer.from(rawMeta.authTag, "hex"),
      authContext,
    );

    // 6. Verify SHA-256 integrity against database commitment
    const actualHash = computeSha256(plaintext);
    if (actualHash.toLowerCase() !== row.sha256_hash.toLowerCase()) {
      throw new Error(
        "Integrity check failed: decrypted plaintext SHA-256 does not match recorded evidence hash.",
      );
    }

    return {
      evidenceId: row.evidence_id,
      workspaceId: row.workspace_id,
      expenseId: row.expense_id,
      version: row.version,
      data: plaintext,
      mimeType: row.mime_type,
      sha256Hash: row.sha256_hash,
      byteLength: Number(row.byte_length),
    };
  }

  /**
   * Previews evidence by decrypting and returning payload for streaming or viewing.
   */
  async previewEvidence(
    params: DownloadEvidenceParams,
  ): Promise<DownloadEvidenceResult> {
    return this.downloadEvidence(params);
  }

  /**
   * Deletes evidence from storage and database.
   * Only permitted for draft expense versions. Submitted evidence is immutable.
   */
  async deleteEvidence(params: {
    workspaceId: string;
    expenseId: string;
    evidenceId: string;
    context: AuthContext;
    targetScope?: string | undefined;
  }): Promise<void> {
    const { workspaceId, expenseId, evidenceId, context, targetScope } = params;

    // 1. Authorize evidence delete access
    const { evidence } = await this.policy.authorizeEvidence(
      workspaceId,
      expenseId,
      evidenceId,
      context,
      "delete",
      targetScope,
    );

    // 2. Check version status: must be 'draft'
    const verRes = await this.db.query<{ status: string }>(
      `SELECT status FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, evidence.version],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense version not found.");
    }

    const versionStatus = verRes.rows[0]!.status;
    if (versionStatus !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `Cannot delete evidence from an expense version with status '${versionStatus}'. Submitted versions are immutable.`,
      });
    }

    // 3. Delete ciphertext from object storage
    const storageKey = generateEvidenceStorageKey(workspaceId, evidenceId);
    await this.storage.delete(storageKey);

    // 4. Delete row from database
    await this.db.query(
      `DELETE FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND evidence_id = $3;`,
      [workspaceId, expenseId, evidenceId],
    );
  }

  /**
   * Replaces evidence for a draft version by deleting existing and uploading new content.
   * For submitted versions, this strictly fails closed, mandating a new version.
   */
  async replaceEvidence(
    oldEvidenceId: string,
    uploadParams: UploadEvidenceParams,
  ): Promise<UploadEvidenceResult> {
    await this.deleteEvidence({
      workspaceId: uploadParams.workspaceId,
      expenseId: uploadParams.expenseId,
      evidenceId: oldEvidenceId,
      context: uploadParams.context,
    });

    return this.uploadEvidence(uploadParams);
  }
}
