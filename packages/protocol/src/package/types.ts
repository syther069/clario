/**
 * Clario Verification Package v1 Types
 *
 * Governed by:
 * - Architecture section 15 (Verification package architecture)
 * - PRD section 9.12 (Independent verifier)
 * - RULES.md sections 2, 7, 8, 14, 15, 19
 */

import type { PrivacyClass } from "../schema/v1/types.js";

export const CLARIO_PACKAGE_SCHEMA_VERSION_V1 = 1 as const;
export const CLARIO_CANONICALIZATION_SPEC_V1 =
  "RFC 8785 JSON Canonicalization Scheme (JCS)" as const;

export type DisclosureLevel = "FULL" | "REDACTED";

/**
 * A file entry within the verification package manifest.
 */
export interface PackageFileEntry {
  /** Relative POSIX path inside the package (e.g. "workspace-policy.json") */
  readonly path: string;
  /** Size in bytes */
  readonly sizeBytes: number;
  /** SHA-256 hash of file contents in lowercase hex (without 0x prefix, 64 chars) */
  readonly sha256: string;
  /** MIME media type */
  readonly mediaType: string;
  /** Privacy class of the file contents */
  readonly privacyClass: PrivacyClass;
  /** Whether the file is present or omitted under the disclosure level */
  readonly isRedacted?: boolean | undefined;
}

/**
 * Expense version summary within the verification package.
 */
export interface PackageExpenseSummary {
  readonly expenseId: string;
  readonly versions: readonly number[];
  readonly currentVersion: number;
  readonly isSettled: boolean;
}

/**
 * Exported workspace policy snapshot.
 */
export interface WorkspaceRoleGrantExportV1 {
  readonly role: string;
  readonly roleName: string;
  readonly account: string;
  readonly scope: string;
  readonly grantedAt?: string | undefined;
}

export interface WorkspacePolicyExportV1 {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly policyVersion: number;
  readonly policyCommitment: string;
  readonly ownerAddress: string;
  readonly roles: readonly WorkspaceRoleGrantExportV1[];
  readonly exportedAt: string;
}

/**
 * An onchain event captured in the verification package.
 */
export interface ExpectedEventExportV1 {
  readonly blockNumber: string;
  readonly blockHash: string;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly eventName: string;
  readonly contractAddress: string;
  readonly args: Record<string, unknown>;
}

/**
 * Root verification package manifest (manifest.json).
 */
export interface VerificationPackageManifestV1 {
  /** Schema version of the package manifest format (1) */
  readonly schemaVersion: 1;
  /** Name and version of the generating tool */
  readonly generator: string;
  /** ISO-8601 UTC creation timestamp */
  readonly createdAt: string;
  /** Level of disclosure: FULL (with private evidence/salts) or REDACTED (integrity only) */
  readonly disclosureLevel: DisclosureLevel;
  /** Monad chain ID */
  readonly chainId: number;
  /** Workspace identifier */
  readonly workspaceId: string;
  /** ClarioRegistry or ClarioSettlementRegistry address */
  readonly registryAddress: string;
  /** Canonical JSON canonicalization specification */
  readonly canonicalizationSpec: typeof CLARIO_CANONICALIZATION_SPEC_V1;
  /** EVM address of the user who authorized the export */
  readonly exporterAddress: string;
  /** List of expenses included in this package */
  readonly expenses: readonly PackageExpenseSummary[];
  /** File manifest containing all package files and their SHA-256 hashes */
  readonly files: readonly PackageFileEntry[];
  /** Optional cryptographic signature over the canonical manifest by exporter */
  readonly exporterSignature?: string | undefined;
}

/**
 * In-memory representation of a verification package bundle.
 */
export interface VerificationPackageBundle {
  readonly manifest: VerificationPackageManifestV1;
  readonly files: Map<string, Buffer>;
}
