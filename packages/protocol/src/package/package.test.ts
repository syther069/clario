import { describe, expect, it } from "vitest";
import {
  CLARIO_PACKAGE_SCHEMA_VERSION_V1,
  CLARIO_CANONICALIZATION_SPEC_V1,
  type VerificationPackageManifestV1,
  validateVerificationPackageManifestV1,
  computePackageFileHash,
  computeCanonicalManifestHash,
} from "./index.js";
import { ProtocolError } from "../errors.js";

const VALID_MANIFEST: VerificationPackageManifestV1 = {
  schemaVersion: 1,
  generator: "clario-protocol@0.0.0",
  createdAt: "2026-09-19T12:00:00Z",
  disclosureLevel: "FULL",
  chainId: 10143,
  workspaceId: "0x" + "11".repeat(32),
  registryAddress: "0x1234567890123456789012345678901234567890",
  canonicalizationSpec: CLARIO_CANONICALIZATION_SPEC_V1,
  exporterAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  expenses: [
    {
      expenseId: "0x" + "22".repeat(32),
      versions: [1, 2],
      currentVersion: 2,
      isSettled: true,
    },
  ],
  files: [
    {
      path: "workspace-policy.json",
      sizeBytes: 150,
      sha256: computePackageFileHash('{"policyVersion":1}'),
      mediaType: "application/json",
      privacyClass: "PUBLIC",
    },
    {
      path: "expenses/0x22/v1/record.json",
      sizeBytes: 300,
      sha256: computePackageFileHash('{"title":"Expense 1"}'),
      mediaType: "application/json",
      privacyClass: "CONFIDENTIAL",
    },
    {
      path: "evidence/ev-1.pdf",
      sizeBytes: 1024,
      sha256: computePackageFileHash("PDF dummy content"),
      mediaType: "application/pdf",
      privacyClass: "EVIDENCE_CONFIDENTIAL",
    },
  ],
};

describe("Verification Package Protocol Schema v1", () => {
  it("validates a valid full manifest successfully", () => {
    const validated = validateVerificationPackageManifestV1(VALID_MANIFEST);
    expect(validated.schemaVersion).toBe(CLARIO_PACKAGE_SCHEMA_VERSION_V1);
    expect(validated.disclosureLevel).toBe("FULL");
    expect(validated.files.length).toBe(3);
  });

  it("validates a valid redacted manifest successfully", () => {
    const redactedManifest = {
      ...VALID_MANIFEST,
      disclosureLevel: "REDACTED",
      files: [
        {
          path: "workspace-policy.json",
          sizeBytes: 150,
          sha256: computePackageFileHash('{"policyVersion":1}'),
          mediaType: "application/json",
          privacyClass: "PUBLIC",
        },
      ],
    };
    const validated = validateVerificationPackageManifestV1(redactedManifest);
    expect(validated.disclosureLevel).toBe("REDACTED");
    expect(validated.files.length).toBe(1);
  });

  it("computes deterministic file hashes", () => {
    const data = "Test content for SHA-256";
    const hash1 = computePackageFileHash(data);
    const hash2 = computePackageFileHash(Buffer.from(data, "utf8"));
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("computes deterministic manifest canonical hash ignoring signature", () => {
    const manifestWithSig: VerificationPackageManifestV1 = {
      ...VALID_MANIFEST,
      exporterSignature: "0x1234567890abcdef",
    };
    const hashWithoutSig = computeCanonicalManifestHash(VALID_MANIFEST);
    const hashWithSig = computeCanonicalManifestHash(manifestWithSig);
    expect(hashWithSig).toBe(hashWithoutSig);
  });

  it("rejects unsupported schemaVersion", () => {
    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        schemaVersion: 2,
      }),
    ).toThrow(/Invalid package schemaVersion/);
  });

  it("rejects invalid disclosure level", () => {
    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        disclosureLevel: "PARTIAL",
      }),
    ).toThrow(/disclosureLevel must be either/);
  });

  it("rejects unsafe file paths with directory traversal", () => {
    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        files: [
          {
            path: "../etc/passwd",
            sizeBytes: 10,
            sha256: "00".repeat(32),
            mediaType: "text/plain",
            privacyClass: "PUBLIC",
          },
        ],
      }),
    ).toThrow(/safe relative POSIX path/);
  });

  it("rejects duplicate file paths", () => {
    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        files: [
          VALID_MANIFEST.files[0]!,
          VALID_MANIFEST.files[0]!,
        ],
      }),
    ).toThrow(/Duplicate file path/);
  });

  it("rejects invalid EVM address in registryAddress or exporterAddress", () => {
    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        registryAddress: "not-an-address",
      }),
    ).toThrow(/0x-prefixed 40-hex address/);

    expect(() =>
      validateVerificationPackageManifestV1({
        ...VALID_MANIFEST,
        exporterAddress: "0x123",
      }),
    ).toThrow(/0x-prefixed 40-hex address/);
  });
});
