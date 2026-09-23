import { createHash } from "node:crypto";
import { canonicalizeJson } from "../schema/v1/canonicalize.js";
import {
  CLARIO_PACKAGE_SCHEMA_VERSION_V1,
  CLARIO_CANONICALIZATION_SPEC_V1,
  type VerificationPackageManifestV1,
  type PackageFileEntry,
  type PackageExpenseSummary,
  type DisclosureLevel,
} from "./types.js";

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/**
 * Computes the SHA-256 hash of a file or string in lowercase hex (64 chars).
 */
export function computePackageFileHash(
  data: Buffer | Uint8Array | string,
): string {
  const hash = createHash("sha256");
  if (typeof data === "string") {
    hash.update(data, "utf8");
  } else {
    hash.update(data);
  }
  return hash.digest("hex").toLowerCase();
}

/**
 * Computes the canonical SHA-256 hash of a package manifest (excluding optional exporterSignature).
 */
export function computeCanonicalManifestHash(
  manifest: VerificationPackageManifestV1,
): string {
  const unsignedManifest = { ...manifest };
  delete unsignedManifest.exporterSignature;
  const canonicalJson = canonicalizeJson(unsignedManifest);
  return computePackageFileHash(canonicalJson);
}

/**
 * Validates a verification package manifest against schema rules.
 * Fails closed on any invalid or missing required field.
 */
export function validateVerificationPackageManifestV1(
  input: unknown,
): VerificationPackageManifestV1 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Manifest must be a non-null object.");
  }

  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== CLARIO_PACKAGE_SCHEMA_VERSION_V1) {
    throw new Error(
      `Invalid package schemaVersion: expected ${CLARIO_PACKAGE_SCHEMA_VERSION_V1}, received ${String(obj.schemaVersion)}.`,
    );
  }

  if (typeof obj.generator !== "string" || obj.generator.trim().length === 0) {
    throw new Error("Manifest generator must be a non-empty string.");
  }

  if (
    typeof obj.createdAt !== "string" ||
    !ISO_TIMESTAMP_REGEX.test(obj.createdAt)
  ) {
    throw new Error(
      "Manifest createdAt must be an ISO-8601 UTC timestamp ending in Z.",
    );
  }

  if (obj.disclosureLevel !== "FULL" && obj.disclosureLevel !== "REDACTED") {
    throw new Error(
      "Manifest disclosureLevel must be either 'FULL' or 'REDACTED'.",
    );
  }

  if (
    typeof obj.chainId !== "number" ||
    !Number.isInteger(obj.chainId) ||
    obj.chainId <= 0
  ) {
    throw new Error("Manifest chainId must be a positive integer.");
  }

  if (
    typeof obj.workspaceId !== "string" ||
    obj.workspaceId.trim().length === 0
  ) {
    throw new Error("Manifest workspaceId must be a non-empty string.");
  }

  if (
    typeof obj.registryAddress !== "string" ||
    !EVM_ADDRESS_REGEX.test(obj.registryAddress.trim())
  ) {
    throw new Error(
      "Manifest registryAddress must be a valid 0x-prefixed 40-hex address.",
    );
  }

  if (obj.canonicalizationSpec !== CLARIO_CANONICALIZATION_SPEC_V1) {
    throw new Error(
      `Manifest canonicalizationSpec must be '${CLARIO_CANONICALIZATION_SPEC_V1}'.`,
    );
  }

  if (
    typeof obj.exporterAddress !== "string" ||
    !EVM_ADDRESS_REGEX.test(obj.exporterAddress.trim())
  ) {
    throw new Error(
      "Manifest exporterAddress must be a valid 0x-prefixed 40-hex address.",
    );
  }

  if (!Array.isArray(obj.expenses) || obj.expenses.length === 0) {
    throw new Error("Manifest expenses must be a non-empty array.");
  }

  const expenses: PackageExpenseSummary[] = obj.expenses.map(
    (expItem, index) => {
      if (
        typeof expItem !== "object" ||
        expItem === null ||
        Array.isArray(expItem)
      ) {
        throw new Error(
          `Manifest expenses[${index}] must be a non-null object.`,
        );
      }
      const expObj = expItem as Record<string, unknown>;
      if (
        typeof expObj.expenseId !== "string" ||
        expObj.expenseId.trim().length === 0
      ) {
        throw new Error(
          `Manifest expenses[${index}].expenseId must be a non-empty string.`,
        );
      }
      if (
        !Array.isArray(expObj.versions) ||
        expObj.versions.length === 0 ||
        !expObj.versions.every(
          (v) => typeof v === "number" && Number.isInteger(v) && v > 0,
        )
      ) {
        throw new Error(
          `Manifest expenses[${index}].versions must be a non-empty array of positive integers.`,
        );
      }
      if (
        typeof expObj.currentVersion !== "number" ||
        !Number.isInteger(expObj.currentVersion) ||
        expObj.currentVersion <= 0
      ) {
        throw new Error(
          `Manifest expenses[${index}].currentVersion must be a positive integer.`,
        );
      }
      return {
        expenseId: expObj.expenseId,
        versions: expObj.versions as number[],
        currentVersion: expObj.currentVersion,
        isSettled: Boolean(expObj.isSettled),
      };
    },
  );

  if (!Array.isArray(obj.files) || obj.files.length === 0) {
    throw new Error("Manifest files must be a non-empty array.");
  }

  const seenPaths = new Set<string>();
  const files: PackageFileEntry[] = obj.files.map((fileItem, index) => {
    if (
      typeof fileItem !== "object" ||
      fileItem === null ||
      Array.isArray(fileItem)
    ) {
      throw new Error(`Manifest files[${index}] must be a non-null object.`);
    }
    const fObj = fileItem as Record<string, unknown>;
    if (
      typeof fObj.path !== "string" ||
      fObj.path.trim().length === 0 ||
      fObj.path.startsWith("/") ||
      fObj.path.startsWith("\\") ||
      fObj.path.includes("..")
    ) {
      throw new Error(
        `Manifest files[${index}].path must be a safe relative POSIX path without leading slashes or directory traversal.`,
      );
    }

    if (seenPaths.has(fObj.path)) {
      throw new Error(`Duplicate file path in manifest: '${fObj.path}'.`);
    }
    seenPaths.add(fObj.path);

    if (
      typeof fObj.sizeBytes !== "number" ||
      !Number.isInteger(fObj.sizeBytes) ||
      fObj.sizeBytes < 0
    ) {
      throw new Error(
        `Manifest files[${index}].sizeBytes must be a non-negative integer.`,
      );
    }

    if (typeof fObj.sha256 !== "string" || !HEX_64_REGEX.test(fObj.sha256)) {
      throw new Error(
        `Manifest files[${index}].sha256 must be a 64-character hex string.`,
      );
    }

    if (
      typeof fObj.mediaType !== "string" ||
      fObj.mediaType.trim().length === 0
    ) {
      throw new Error(
        `Manifest files[${index}].mediaType must be a non-empty string.`,
      );
    }

    const validPrivacyClasses = [
      "PUBLIC",
      "WORKSPACE_CONFIDENTIAL",
      "EVIDENCE_CONFIDENTIAL",
      "SECURITY_SENSITIVE",
    ];
    if (
      typeof fObj.privacyClass !== "string" ||
      !validPrivacyClasses.includes(fObj.privacyClass)
    ) {
      throw new Error(
        `Manifest files[${index}].privacyClass must be one of: ${validPrivacyClasses.join(", ")}.`,
      );
    }

    return {
      path: fObj.path,
      sizeBytes: fObj.sizeBytes,
      sha256: fObj.sha256.toLowerCase(),
      mediaType: fObj.mediaType,
      privacyClass: fObj.privacyClass as PackageFileEntry["privacyClass"],
      isRedacted:
        fObj.isRedacted !== undefined ? Boolean(fObj.isRedacted) : undefined,
    };
  });

  return {
    schemaVersion: CLARIO_PACKAGE_SCHEMA_VERSION_V1,
    generator: obj.generator,
    createdAt: obj.createdAt,
    disclosureLevel: obj.disclosureLevel as DisclosureLevel,
    chainId: obj.chainId,
    workspaceId: obj.workspaceId,
    registryAddress: obj.registryAddress.trim(),
    canonicalizationSpec: CLARIO_CANONICALIZATION_SPEC_V1,
    exporterAddress: obj.exporterAddress.trim(),
    expenses,
    files,
    exporterSignature:
      typeof obj.exporterSignature === "string"
        ? obj.exporterSignature
        : undefined,
  };
}
