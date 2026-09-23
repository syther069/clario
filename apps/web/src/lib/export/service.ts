/**
 * Clario Verification Package Export Service (VER-001)
 *
 * Governed by:
 * - Architecture section 15 (Verification package architecture)
 * - PRD section 9.12 (Independent verifier)
 * - RULES.md sections 2, 7, 8, 14, 15, 19
 *
 * Invariants enforced:
 * - Export restricted to OWNER_ROLE, ADMIN_ROLE, or AUDITOR_ROLE (RULES §8)
 * - Recent wallet confirmation required within 15 minutes (RULES §8)
 * - Explicit disclosure preview before export creation
 * - REDACTED mode omits private records, salts, and evidence; missing inputs become UNVERIFIABLE
 * - FULL mode decrypts records and evidence without saving plaintext to server disk or logs
 * - Per-file SHA-256 hashes, sizes, media types, and privacy classes recorded in manifest.json
 * - Canonical manifest hash computed over RFC 8785 canonical JSON
 * - Export tracking stored in exports table with expiration timestamp
 */

import { randomUUID } from "node:crypto";
import {
  CLARIO_CANONICALIZATION_SPEC_V1,
  computeCanonicalManifestHash,
  computePackageFileHash,
  validateVerificationPackageManifestV1,
  canonicalizeJson,
  hashCanonicalEvidenceManifestV1,
  ProtocolError,
  type VerificationPackageManifestV1,
  type PackageFileEntry,
  type PackageExpenseSummary,
  type WorkspacePolicyExportV1,
  type ExpectedEventExportV1,
  type DisclosureLevel,
} from "@clario/protocol";
import type { DatabaseClient } from "@clario/database";
import {
  AuthorizationPolicy,
  assertRecentConfirmation,
  type AuthContext,
  RecordNotFoundError,
} from "../auth/policy";
import { unwrapKey, decryptEvidence } from "../evidence/crypto";
import {
  type StorageDriver,
  getDefaultStorageDriver,
} from "../evidence/storage";
import { getEvidenceKek } from "../evidence/service";
import { createDeterministicZip, type ZipEntry } from "./zip";
import { getServerConfiguration } from "../../config/server";
import type { DeploymentManifest } from "../../config/schema";
import {
  buildCanonicalEvidenceManifest,
  buildCanonicalExpenseRecord,
} from "../expense/submission";
import type { ExpenseDraftPayload } from "../expense/types";

export interface ExportFilterOptions {
  expenseIds?: string[] | undefined;
}

export interface ExportOptions {
  disclosureLevel: DisclosureLevel;
  expenseIds?: string[] | undefined;
  retentionHours?: number | undefined;
}

export interface DisclosurePreviewItem {
  expenseId: string;
  version: number;
  amount: string;
  currency: string;
  recipient: string;
  hasConfidentialFields: boolean;
  evidenceCount: number;
  evidenceTotalBytes: number;
}

export interface DisclosurePreviewResponse {
  workspaceId: string;
  totalExpenses: number;
  totalVersions: number;
  totalEvidenceFiles: number;
  totalEvidenceSizeBytes: number;
  confidentialFieldNames: string[];
  expenses: DisclosurePreviewItem[];
  modes: {
    FULL: {
      disclosesPrivateRecords: true;
      disclosesEvidenceBinaries: true;
      disclosesSalts: true;
      description: string;
      verificationImpact: string;
    };
    REDACTED: {
      disclosesPrivateRecords: false;
      disclosesEvidenceBinaries: false;
      disclosesSalts: false;
      description: string;
      verificationImpact: string;
    };
  };
}

export interface ExportGenerationResult {
  exportId: string;
  workspaceId: string;
  disclosureLevel: DisclosureLevel;
  packageHash: string;
  storageKey: string;
  manifest: VerificationPackageManifestV1;
  zipBuffer: Buffer;
  createdAt: string;
  expiresAt: string;
}

export interface StoredExportResult {
  exportId: string;
  workspaceId: string;
  packageHash: string;
  data: Buffer;
  createdAt: string;
  expiresAt: string;
}

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

interface StoredEncryptionMetadata {
  wrappedKey: string;
  iv: string;
  authTag: string;
  kekIv: string;
  kekAuthTag: string;
  keyId: string;
}

/**
 * Generates an opaque storage key for verification package export archives.
 */
export function generateExportStorageKey(
  workspaceId: string,
  exportId: string,
): string {
  const safeWorkspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeExport = exportId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeWorkspace || !safeExport) {
    throw new Error(
      "Invalid workspaceId or exportId for export storage key generation.",
    );
  }
  return `exports/${safeWorkspace}/${safeExport}.zip`;
}

/**
 * Maps standard MIME types to file extensions.
 */
export function getExtensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "text/plain":
      return "txt";
    case "application/json":
      return "json";
    case "text/csv":
      return "csv";
    default:
      return "bin";
  }
}

export class ExportService {
  private readonly policy: AuthorizationPolicy;
  private readonly kek: Buffer;
  private readonly storage: StorageDriver;
  private readonly deploymentManifestOverride: DeploymentManifest | undefined;

  constructor(
    private readonly db: DatabaseClient,
    storage?: StorageDriver,
    kek?: Buffer,
    deploymentManifest?: DeploymentManifest,
  ) {
    this.policy = new AuthorizationPolicy(db);
    this.storage = storage ?? getDefaultStorageDriver();
    this.kek = kek ?? getEvidenceKek();
    this.deploymentManifestOverride = deploymentManifest;
  }

  /**
   * Asserts caller is an authorized exporter (owner, admin, or auditor) with fresh confirmation.
   */
  private async assertExporterAuthority(
    workspaceId: string,
    context: AuthContext,
  ): Promise<{ address: string; role: string }> {
    assertRecentConfirmation(context.session);

    const membership = await this.policy.getMembership(workspaceId, context);
    const isAuthorized =
      membership.isOwner ||
      this.policy.hasRole(membership, "OWNER_ROLE") ||
      this.policy.hasRole(membership, "ADMIN_ROLE") ||
      this.policy.hasRole(membership, "AUDITOR_ROLE");

    if (!isAuthorized) {
      throw new ProtocolError("UNAUTHORIZED", {
        message:
          "Exporting verification packages is restricted to workspace owners, administrators, or auditors.",
      });
    }

    let role = "AUDITOR_ROLE";
    if (membership.isOwner || this.policy.hasRole(membership, "OWNER_ROLE")) {
      role = "OWNER_ROLE";
    } else if (this.policy.hasRole(membership, "ADMIN_ROLE")) {
      role = "ADMIN_ROLE";
    }

    return { address: context.address, role };
  }

  /**
   * Generates a preview of disclosure for an upcoming export, detailing exactly
   * what private data would be revealed vs redacted.
   */
  async previewDisclosure(
    workspaceId: string,
    options: ExportFilterOptions,
    context: AuthContext,
  ): Promise<DisclosurePreviewResponse> {
    await this.assertExporterAuthority(workspaceId, context);

    let expenseQuery = `SELECT expense_id, current_version FROM expenses WHERE workspace_id = $1`;
    const params: unknown[] = [workspaceId];

    if (options.expenseIds && options.expenseIds.length > 0) {
      expenseQuery += ` AND expense_id = ANY($2)`;
      params.push(options.expenseIds);
    }
    expenseQuery += ` ORDER BY created_at ASC;`;

    const expensesRes = await this.db.query<{
      expense_id: string;
      current_version: number | null;
    }>(expenseQuery, params);

    const previewItems: DisclosurePreviewItem[] = [];
    let totalVersions = 0;
    let totalEvidenceFiles = 0;
    let totalEvidenceSizeBytes = 0;

    for (const exp of expensesRes.rows) {
      const versionsRes = await this.db.query<{
        version: number;
        amount: string;
        currency: string;
        recipient: string;
      }>(
        `SELECT version, amount, currency, recipient
         FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY version ASC;`,
        [workspaceId, exp.expense_id],
      );

      for (const v of versionsRes.rows) {
        totalVersions++;

        const evRes = await this.db.query<{
          byte_length: string | number;
        }>(
          `SELECT byte_length
           FROM evidence_objects
           WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
          [workspaceId, exp.expense_id, v.version],
        );

        const vEvidenceBytes = evRes.rows.reduce(
          (sum, r) => sum + Number(r.byte_length),
          0,
        );
        totalEvidenceFiles += evRes.rows.length;
        totalEvidenceSizeBytes += vEvidenceBytes;

        previewItems.push({
          expenseId: exp.expense_id,
          version: v.version,
          amount: v.amount,
          currency: v.currency,
          recipient: v.recipient,
          hasConfidentialFields: true,
          evidenceCount: evRes.rows.length,
          evidenceTotalBytes: vEvidenceBytes,
        });
      }
    }

    return {
      workspaceId,
      totalExpenses: expensesRes.rows.length,
      totalVersions,
      totalEvidenceFiles,
      totalEvidenceSizeBytes,
      confidentialFieldNames: [
        "title",
        "businessPurpose",
        "merchant",
        "notes",
        "project",
        "category",
      ],
      expenses: previewItems,
      modes: {
        FULL: {
          disclosesPrivateRecords: true,
          disclosesEvidenceBinaries: true,
          disclosesSalts: true,
          description:
            "Includes decrypted offchain canonical records, random 32-byte salts, and evidence files for complete independent auditability.",
          verificationImpact:
            "Permits full independent cryptographic verification of SHA-256 evidence digests, RFC 8785 canonical record encoding, and Monad onchain commitments.",
        },
        REDACTED: {
          disclosesPrivateRecords: false,
          disclosesEvidenceBinaries: false,
          disclosesSalts: false,
          description:
            "Omits all private expense descriptions, merchant identifiers, salts, and receipts, providing integrity verification of onchain event lineage only.",
          verificationImpact:
            "Commitment calculation and evidence matching will be reported as UNVERIFIABLE/UNAVAILABLE. Only onchain sequence and registry consistency can be verified.",
        },
      },
    };
  }

  /**
   * Generates a portable verification package v1 deterministic ZIP archive.
   */
  async generateExportPackage(
    workspaceId: string,
    options: ExportOptions,
    context: AuthContext,
  ): Promise<ExportGenerationResult> {
    const { address: exporterAddress } = await this.assertExporterAuthority(
      workspaceId,
      context,
    );

    if (
      options.disclosureLevel !== "FULL" &&
      options.disclosureLevel !== "REDACTED"
    ) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "disclosureLevel must be either 'FULL' or 'REDACTED'.",
      });
    }

    const exportId = randomUUID();
    const createdAt = new Date().toISOString();
    const retentionHours = options.retentionHours ?? 24;
    const expiresAt = new Date(
      Date.now() + retentionHours * 3600 * 1000,
    ).toISOString();

    // 1. Resolve workspace policy snapshot
    const policyRes = await this.db.query<{
      policy_version: number;
      policy_commitment: string;
      created_by: string;
    }>(
      `SELECT policy_version, policy_commitment, created_by
       FROM workspace_policies
       WHERE workspace_id = $1
       ORDER BY policy_version DESC
       LIMIT 1;`,
      [workspaceId],
    );

    const latestPolicy = policyRes.rows[0];
    if (!latestPolicy) {
      throw new ProtocolError("INTERNAL_ERROR", {
        message:
          "A persisted workspace policy is required before generating a verification package.",
      });
    }

    const rolesRes = await this.db.query<{
      role: string;
      address: string;
      scope: string;
      granted_at: string | Date;
    }>(
      `SELECT role, address, scope, granted_at
       FROM role_grants
       WHERE workspace_id = $1 AND revoked_at IS NULL
       ORDER BY granted_at ASC;`,
      [workspaceId],
    );

    const workspacePolicyExport: WorkspacePolicyExportV1 = {
      schemaVersion: 1,
      workspaceId,
      policyVersion: latestPolicy.policy_version,
      policyCommitment: latestPolicy.policy_commitment,
      ownerAddress: latestPolicy.created_by,
      roles: rolesRes.rows.map((r) => ({
        role: r.role,
        roleName: r.role,
        account: r.address,
        scope: r.scope,
        grantedAt:
          typeof r.granted_at === "string"
            ? r.granted_at
            : new Date(r.granted_at).toISOString(),
      })),
      exportedAt: createdAt,
    };

    // 2. Resolve deployment manifest & chain info.
    // VER-001 packages must be portable and independent; they therefore need
    // the exact deployment manifest used for verification. Do not synthesize
    // placeholder contracts, token addresses, blocks, or hashes.
    const deploymentManifest =
      this.deploymentManifestOverride ?? getServerConfiguration().deployment;

    if (!deploymentManifest) {
      throw new ProtocolError("INTERNAL_ERROR", {
        message:
          "A validated deployment manifest is required before generating a portable verification package.",
      });
    }

    const chainId = deploymentManifest.chainId;
    const registryAddress = deploymentManifest.contracts.ClarioRegistry.address;
    const deploymentManifestContent = canonicalizeJson(deploymentManifest);

    // 3. Resolve onchain expected events
    const eventsRes = await this.db.query<{
      block_number: string | number;
      block_hash: string;
      transaction_hash: string;
      log_index: number;
      event_name: string;
      contract_address: string;
      payload: string | Record<string, unknown>;
    }>(
      `SELECT block_number, block_hash, transaction_hash, log_index, event_name, contract_address, payload
       FROM indexed_events
       WHERE workspace_id = $1
       ORDER BY block_number ASC, log_index ASC;`,
      [workspaceId],
    );

    const expectedEvents: ExpectedEventExportV1[] = eventsRes.rows.map((ev) => {
      const parsedPayload =
        typeof ev.payload === "string"
          ? (JSON.parse(ev.payload) as Record<string, unknown>)
          : ev.payload;
      return {
        blockNumber: String(ev.block_number),
        blockHash: ev.block_hash,
        transactionHash: ev.transaction_hash,
        logIndex: Number(ev.log_index),
        eventName: ev.event_name,
        contractAddress: ev.contract_address,
        args: parsedPayload,
      };
    });

    // 4. Query expenses and versions
    let expenseQuery = `SELECT expense_id, current_version FROM expenses WHERE workspace_id = $1`;
    const expParams: unknown[] = [workspaceId];
    if (options.expenseIds && options.expenseIds.length > 0) {
      expenseQuery += ` AND expense_id = ANY($2)`;
      expParams.push(options.expenseIds);
    }
    expenseQuery += ` ORDER BY created_at ASC;`;

    const expensesRes = await this.db.query<{
      expense_id: string;
      current_version: number | null;
    }>(expenseQuery, expParams);

    // Package contents maps
    const zipEntries: ZipEntry[] = [];
    const manifestFileEntries: PackageFileEntry[] = [];
    const packageExpenses: PackageExpenseSummary[] = [];

    // Add workspace-policy.json
    const policyBytes = Buffer.from(
      canonicalizeJson(workspacePolicyExport),
      "utf8",
    );
    manifestFileEntries.push({
      path: "workspace-policy.json",
      sizeBytes: policyBytes.length,
      sha256: computePackageFileHash(policyBytes),
      mediaType: "application/json",
      privacyClass: "PUBLIC",
    });
    zipEntries.push({
      path: "clario-export/workspace-policy.json",
      data: policyBytes,
    });

    // Add chain/deployment-manifest.json
    const deploymentBytes = Buffer.from(deploymentManifestContent, "utf8");
    manifestFileEntries.push({
      path: "chain/deployment-manifest.json",
      sizeBytes: deploymentBytes.length,
      sha256: computePackageFileHash(deploymentBytes),
      mediaType: "application/json",
      privacyClass: "PUBLIC",
    });
    zipEntries.push({
      path: "clario-export/chain/deployment-manifest.json",
      data: deploymentBytes,
    });

    // Add chain/expected-events.json
    const eventsBytes = Buffer.from(canonicalizeJson(expectedEvents), "utf8");
    manifestFileEntries.push({
      path: "chain/expected-events.json",
      sizeBytes: eventsBytes.length,
      sha256: computePackageFileHash(eventsBytes),
      mediaType: "application/json",
      privacyClass: "PUBLIC",
    });
    zipEntries.push({
      path: "clario-export/chain/expected-events.json",
      data: eventsBytes,
    });

    // 5. Process each expense & version
    for (const exp of expensesRes.rows) {
      const versRes = await this.db.query<{
        version: number;
        commitment: string;
        record_ciphertext: string;
        salt_ciphertext: string;
        submitted_by: string | null;
        submitted_at: string | Date | null;
      }>(
        `SELECT version, commitment, record_ciphertext, salt_ciphertext, submitted_by, submitted_at
         FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY version ASC;`,
        [workspaceId, exp.expense_id],
      );

      // Check settlement status
      const reimRes = await this.db.query<{ status: string }>(
        `SELECT status FROM reimbursements WHERE workspace_id = $1 AND expense_id = $2 AND status = 'confirmed' LIMIT 1;`,
        [workspaceId, exp.expense_id],
      );
      const isSettled = reimRes.rows.length > 0;

      packageExpenses.push({
        expenseId: exp.expense_id,
        versions: versRes.rows.map((v) => v.version),
        currentVersion: exp.current_version ?? 1,
        isSettled,
      });

      for (const v of versRes.rows) {
        const evRows = await this.db.query<{
          evidence_id: string;
          storage_key: string;
          sha256_hash: string;
          byte_length: string | number;
          mime_type: string;
          encryption_metadata: string | StoredEncryptionMetadata;
          created_at: string | Date;
        }>(
          `SELECT evidence_id, storage_key, sha256_hash, byte_length, mime_type, encryption_metadata, created_at
           FROM evidence_objects
           WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
           ORDER BY evidence_id ASC;`,
          [workspaceId, exp.expense_id, v.version],
        );

        const evidenceItems = evRows.rows.map((r) => ({
          evidenceId: r.evidence_id,
          sha256Hash: r.sha256_hash,
          byteLength: Number(r.byte_length),
          mimeType: r.mime_type,
          createdAt:
            typeof r.created_at === "string"
              ? r.created_at
              : new Date(r.created_at).toISOString(),
        }));

        const { manifest: evidenceManifest } = buildCanonicalEvidenceManifest({
          evidenceItems,
        });

        if (options.disclosureLevel === "FULL") {
          const draftPayload = this.decryptRecordPayload(
            workspaceId,
            exp.expense_id,
            v.version,
            v.record_ciphertext,
          );
          if (!v.submitted_by || !v.submitted_at) {
            throw new ProtocolError("INTERNAL_ERROR", {
              message:
                "A submitted-by address and canonical submission timestamp are required for a full verification export.",
            });
          }
          const submittedAt =
            new Date(v.submitted_at).toISOString().slice(0, 19) + "Z";
          const { canonicalExpense } = buildCanonicalExpenseRecord({
            workspaceId: workspaceId as `0x${string}`,
            expenseId: exp.expense_id as `0x${string}`,
            version: v.version,
            payload: draftPayload as unknown as ExpenseDraftPayload,
            evidenceManifestHash:
              hashCanonicalEvidenceManifestV1(evidenceManifest),
            submittedBy: v.submitted_by as `0x${string}`,
            submittedAt,
          });
          const recordBytes = Buffer.from(
            canonicalizeJson(canonicalExpense),
            "utf8",
          );
          const recordPath = `expenses/${exp.expense_id}/v${v.version}/record.json`;
          manifestFileEntries.push({
            path: recordPath,
            sizeBytes: recordBytes.length,
            sha256: computePackageFileHash(recordBytes),
            mediaType: "application/json",
            privacyClass: "WORKSPACE_CONFIDENTIAL",
          });
          zipEntries.push({
            path: `clario-export/${recordPath}`,
            data: recordBytes,
          });

          // Decrypt salt
          const saltHex = this.decryptSaltValue(
            workspaceId,
            exp.expense_id,
            v.version,
            v.record_ciphertext,
            v.salt_ciphertext,
          );
          const saltBytes = Buffer.from(saltHex, "utf8");
          const saltPath = `expenses/${exp.expense_id}/v${v.version}/salt.txt`;
          manifestFileEntries.push({
            path: saltPath,
            sizeBytes: saltBytes.length,
            sha256: computePackageFileHash(saltBytes),
            mediaType: "text/plain",
            privacyClass: "SECURITY_SENSITIVE",
          });
          zipEntries.push({
            path: `clario-export/${saltPath}`,
            data: saltBytes,
          });

          // Evidence manifest
          const evManifestBytes = Buffer.from(
            canonicalizeJson(evidenceManifest),
            "utf8",
          );
          const evManifestPath = `expenses/${exp.expense_id}/v${v.version}/evidence-manifest.json`;
          manifestFileEntries.push({
            path: evManifestPath,
            sizeBytes: evManifestBytes.length,
            sha256: computePackageFileHash(evManifestBytes),
            mediaType: "application/json",
            privacyClass: "WORKSPACE_CONFIDENTIAL",
          });
          zipEntries.push({
            path: `clario-export/${evManifestPath}`,
            data: evManifestBytes,
          });

          // Decrypt attached evidence objects
          for (const ev of evRows.rows) {
            const ext = getExtensionForMimeType(ev.mime_type);
            const evPath = `evidence/${ev.evidence_id}.${ext}`;

            const decryptedEvidence = await this.decryptEvidenceFile(
              ev.storage_key,
              ev.encryption_metadata,
              {
                workspaceId,
                expenseId: exp.expense_id,
                version: v.version,
                evidenceId: ev.evidence_id,
              },
            );

            manifestFileEntries.push({
              path: evPath,
              sizeBytes: decryptedEvidence.length,
              sha256: computePackageFileHash(decryptedEvidence),
              mediaType: ev.mime_type,
              privacyClass: "EVIDENCE_CONFIDENTIAL",
            });
            zipEntries.push({
              path: `clario-export/${evPath}`,
              data: decryptedEvidence,
            });
          }
        } else {
          // REDACTED mode: register omitted confidential files with isRedacted: true
          const recordPath = `expenses/${exp.expense_id}/v${v.version}/record.json`;
          manifestFileEntries.push({
            path: recordPath,
            sizeBytes: 0,
            sha256: "0".repeat(64),
            mediaType: "application/json",
            privacyClass: "WORKSPACE_CONFIDENTIAL",
            isRedacted: true,
          });

          const saltPath = `expenses/${exp.expense_id}/v${v.version}/salt.txt`;
          manifestFileEntries.push({
            path: saltPath,
            sizeBytes: 0,
            sha256: "0".repeat(64),
            mediaType: "text/plain",
            privacyClass: "SECURITY_SENSITIVE",
            isRedacted: true,
          });

          const evManifestPath = `expenses/${exp.expense_id}/v${v.version}/evidence-manifest.json`;
          manifestFileEntries.push({
            path: evManifestPath,
            sizeBytes: 0,
            sha256: "0".repeat(64),
            mediaType: "application/json",
            privacyClass: "WORKSPACE_CONFIDENTIAL",
            isRedacted: true,
          });

          for (const ev of evRows.rows) {
            const ext = getExtensionForMimeType(ev.mime_type);
            const evPath = `evidence/${ev.evidence_id}.${ext}`;
            manifestFileEntries.push({
              path: evPath,
              sizeBytes: 0,
              sha256: "0".repeat(64),
              mediaType: ev.mime_type,
              privacyClass: "EVIDENCE_CONFIDENTIAL",
              isRedacted: true,
            });
          }
        }
      }
    }

    // 6. Build manifest.json
    const manifestDraft: VerificationPackageManifestV1 = {
      schemaVersion: 1,
      generator: "clario-export-v1.0.0",
      createdAt,
      disclosureLevel: options.disclosureLevel,
      chainId,
      workspaceId,
      registryAddress,
      canonicalizationSpec: CLARIO_CANONICALIZATION_SPEC_V1,
      exporterAddress,
      expenses: packageExpenses,
      files: manifestFileEntries,
    };

    // Validate manifest schema
    const manifest = validateVerificationPackageManifestV1(manifestDraft);
    const packageHash = computeCanonicalManifestHash(manifest);

    // Add manifest.json to ZIP entries
    const manifestBytes = Buffer.from(canonicalizeJson(manifest), "utf8");
    zipEntries.push({
      path: "clario-export/manifest.json",
      data: manifestBytes,
    });

    // 7. Create deterministic ZIP archive
    const zipBuffer = createDeterministicZip(zipEntries);

    // 8. Persist to storage driver & exports table
    const storageKey = generateExportStorageKey(workspaceId, exportId);
    await this.storage.put(storageKey, zipBuffer, "application/zip");

    await this.db.query(
      `INSERT INTO exports (
         export_id, workspace_id, requested_by, filter_criteria,
         package_hash, storage_key, created_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        exportId,
        workspaceId,
        exporterAddress,
        JSON.stringify({
          disclosureLevel: options.disclosureLevel,
          expenseIds: options.expenseIds ?? [],
          retentionHours,
        }),
        packageHash,
        storageKey,
        createdAt,
        expiresAt,
      ],
    );

    // 9. Emit audit event (zero private data logged)
    await this.db.query(
      `INSERT INTO audit_events (
         workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        workspaceId,
        exporterAddress,
        "export_generated",
        "export",
        exportId,
        JSON.stringify({
          exportId,
          disclosureLevel: options.disclosureLevel,
          packageHash,
          fileCount: manifestFileEntries.length,
          expenseCount: packageExpenses.length,
          expiresAt,
        }),
        createdAt,
      ],
    );

    return {
      exportId,
      workspaceId,
      disclosureLevel: options.disclosureLevel,
      packageHash,
      storageKey,
      manifest,
      zipBuffer,
      createdAt,
      expiresAt,
    };
  }

  /**
   * Retrieves an existing exported verification package archive.
   */
  async getExportPackage(
    workspaceId: string,
    exportId: string,
    context: AuthContext,
  ): Promise<StoredExportResult> {
    await this.assertExporterAuthority(workspaceId, context);

    const exportRes = await this.db.query<{
      export_id: string;
      workspace_id: string;
      package_hash: string;
      storage_key: string;
      created_at: string | Date;
      expires_at: string | Date;
    }>(
      `SELECT export_id, workspace_id, package_hash, storage_key, created_at, expires_at
       FROM exports
       WHERE workspace_id = $1 AND export_id = $2;`,
      [workspaceId, exportId],
    );

    if (exportRes.rows.length === 0) {
      throw new RecordNotFoundError("Verification package export not found.");
    }

    const row = exportRes.rows[0]!;
    const expiresAt =
      typeof row.expires_at === "string"
        ? row.expires_at
        : new Date(row.expires_at).toISOString();

    if (new Date(expiresAt).getTime() < Date.now()) {
      throw new RecordNotFoundError(
        "Verification package export has expired under workspace retention policy.",
      );
    }

    const data = await this.storage.get(row.storage_key);
    if (!data) {
      throw new RecordNotFoundError(
        "Verification package archive file was not found in storage.",
      );
    }

    return {
      exportId: row.export_id,
      workspaceId: row.workspace_id,
      packageHash: row.package_hash,
      data,
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at
          : new Date(row.created_at).toISOString(),
      expiresAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Decryption Helpers
  // ---------------------------------------------------------------------------

  private decryptRecordPayload(
    workspaceId: string,
    expenseId: string,
    version: number,
    recordCiphertext: string,
  ): Record<string, unknown> {
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

    return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
  }

  private decryptSaltValue(
    workspaceId: string,
    expenseId: string,
    version: number,
    recordCiphertext: string,
    saltCiphertext: string,
  ): string {
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

  private async decryptEvidenceFile(
    storageKey: string,
    encryptionMetadata: string | StoredEncryptionMetadata,
    context: {
      workspaceId: string;
      expenseId: string;
      version: number;
      evidenceId: string;
    },
  ): Promise<Buffer> {
    const encMeta: StoredEncryptionMetadata =
      typeof encryptionMetadata === "string"
        ? (JSON.parse(encryptionMetadata) as StoredEncryptionMetadata)
        : encryptionMetadata;

    const encryptedBytes = await this.storage.get(storageKey);
    if (!encryptedBytes) {
      throw new Error(`Evidence file not found in storage: ${storageKey}`);
    }

    const dek = unwrapKey(
      {
        wrappedKey: Buffer.from(encMeta.wrappedKey, "hex"),
        iv: Buffer.from(encMeta.kekIv, "hex"),
        authTag: Buffer.from(encMeta.kekAuthTag, "hex"),
        keyId: encMeta.keyId,
      },
      this.kek,
    );

    return decryptEvidence(
      encryptedBytes,
      dek,
      Buffer.from(encMeta.iv, "hex"),
      Buffer.from(encMeta.authTag, "hex"),
      context,
    );
  }
}
