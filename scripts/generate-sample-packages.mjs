#!/usr/bin/env node

/**
 * Clario Sample Verification Package Generator (SUB-001)
 *
 * Generates reproducible sample verification packages for independent audit:
 * 1. sample-full-valid.zip     -> Valid full-disclosure verification package
 * 2. sample-full-tampered.zip  -> Tampered package with modified record amount
 * 3. sample-redacted.zip       -> Redacted package omitting private evidence & salts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJson,
  computeCanonicalManifestHash,
  computeExpenseCommitmentV1,
  computePackageFileHash,
  createDeterministicZip,
  hashCanonicalEvidenceManifestV1,
  hashCanonicalExpenseV1,
  validateVerificationPackageManifestV1,
  CLARIO_CANONICALIZATION_SPEC_V1,
} from "../packages/protocol/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../fixtures/samples");

const WORKSPACE_ID =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const EXPENSE_ID =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const ROOT_REGISTRY = "0x3333333333333333333333333333333333333333";
const EXPENSE_REGISTRY = "0x4444444444444444444444444444444444444444";
const USDC = "0x5555555555555555555555555555555555555555";
const SUBMITTER = "0x6666666666666666666666666666666666666666";
const RECIPIENT = "0x8888888888888888888888888888888888888888";
const SALT =
  "0x9999999999999999999999999999999999999999999999999999999999999999";
const CHAIN_ID = 10143; // Monad Testnet

function buildBundle({ redacted = false, tamper = false } = {}) {
  const evidence = Buffer.from(
    "%PDF-1.4 Clario Verifiable Receipt Sample Evidence",
    "utf8",
  );
  const evidenceHash = `0x${computePackageFileHash(evidence)}`;
  const evidenceManifest = {
    manifestVersion: 1,
    entries: [
      {
        evidenceId: "evidence-sample-01",
        mimeType: "application/pdf",
        sizeBytes: evidence.length,
        plaintextHash: evidenceHash,
        ciphertextHash: evidenceHash,
        uploadedAt: "2026-10-01T12:00:00Z",
      },
    ],
    previousManifestHash: null,
  };
  const evidenceManifestHash =
    hashCanonicalEvidenceManifestV1(evidenceManifest);

  const record = {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    expenseId: EXPENSE_ID,
    version: 1,
    title: "Monad Infrastructure Node Subscription",
    businessPurpose: "RPC Endpoint bandwidth & indexing for Clario team",
    category: "software_subscription",
    project: "clario-monad",
    merchant: "QuickNode Monad Infrastructure",
    expenseDate: "2026-10-01",
    claimAmount: "500000000", // 500.00 USDC (6 decimals)
    claimAsset: USDC,
    recipient: RECIPIENT,
    paymentSource: "imported_transaction",
    sourceChainId: 10143,
    sourceTransactionHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    evidenceManifestHash,
    submittedBy: SUBMITTER,
    submittedAt: "2026-10-01T12:05:00Z",
    client: null,
    invoiceNumber: "INV-2026-001",
    location: null,
    notes: "Verified by treasury for monthly cloud infra",
    tags: ["cloud", "infrastructure", "monad"],
  };

  const commitment = computeExpenseCommitmentV1({
    monadChainId: CHAIN_ID,
    registryAddress: EXPENSE_REGISTRY,
    workspaceId: WORKSPACE_ID,
    expenseId: EXPENSE_ID,
    version: 1,
    privateRecordHash: hashCanonicalExpenseV1(record),
    evidenceManifestHash,
    salt: SALT,
  });

  const deployment = {
    schemaVersion: 1,
    environment: "local",
    sourceCommit: "1111111111111111111111111111111111111111",
    chainFamily: "local",
    chainId: CHAIN_ID,
    deployer: SUBMITTER,
    deployedAt: "2026-10-01T09:00:00Z",
    contracts: {
      ClarioRegistry: {
        address: ROOT_REGISTRY,
        deploymentBlock: 1000,
        transactionHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        abiHash:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        verifiedSourceUrl: null,
      },
    },
    tokens: { USDC: { address: USDC, decimals: 6 } },
  };

  const policy = {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    policyVersion: 1,
    policyCommitment:
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    ownerAddress: SUBMITTER,
    roles: [
      {
        role: "OWNER_ROLE",
        roleName: "OWNER_ROLE",
        account: SUBMITTER,
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        grantedAt: "2026-10-01T09:00:00Z",
      },
    ],
    exportedAt: "2026-10-01T12:30:00Z",
  };

  const zipEntries = [];
  const manifestFiles = [];

  function addZipFile(relativePath, data, mediaType, privacyClass) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    manifestFiles.push({
      path: relativePath,
      sizeBytes: buf.length,
      sha256: computePackageFileHash(buf),
      mediaType,
      privacyClass,
    });
    zipEntries.push({
      path: `clario-export/${relativePath}`,
      data: buf,
    });
  }

  // Public metadata files
  addZipFile(
    "workspace-policy.json",
    canonicalizeJson(policy),
    "application/json",
    "PUBLIC",
  );
  addZipFile(
    "chain/deployment-manifest.json",
    canonicalizeJson(deployment),
    "application/json",
    "PUBLIC",
  );
  addZipFile("chain/expected-events.json", "[]", "application/json", "PUBLIC");

  const recordPath = `expenses/${EXPENSE_ID}/v1/record.json`;
  const saltPath = `expenses/${EXPENSE_ID}/v1/salt.txt`;
  const evManifestPath = `expenses/${EXPENSE_ID}/v1/evidence-manifest.json`;
  const evBinaryPath = "evidence/evidence-sample-01.pdf";

  if (redacted) {
    // Redacted: mark confidential files as redacted
    for (const [path, mediaType, privacyClass] of [
      [recordPath, "application/json", "WORKSPACE_CONFIDENTIAL"],
      [saltPath, "text/plain", "SECURITY_SENSITIVE"],
      [evManifestPath, "application/json", "WORKSPACE_CONFIDENTIAL"],
      [evBinaryPath, "application/pdf", "EVIDENCE_CONFIDENTIAL"],
    ]) {
      manifestFiles.push({
        path,
        sizeBytes: 0,
        sha256: "0".repeat(64),
        mediaType,
        privacyClass,
        isRedacted: true,
      });
    }
  } else {
    // Full disclosure
    // If tamper is true, the manifest declares the original hash, but the zip contains the tampered record!
    if (tamper) {
      const originalRecordBytes = Buffer.from(canonicalizeJson(record), "utf8");
      manifestFiles.push({
        path: recordPath,
        sizeBytes: originalRecordBytes.length,
        sha256: computePackageFileHash(originalRecordBytes),
        mediaType: "application/json",
        privacyClass: "WORKSPACE_CONFIDENTIAL",
      });
      const tamperedRecord = { ...record, claimAmount: "999999999" };
      zipEntries.push({
        path: `clario-export/${recordPath}`,
        data: Buffer.from(canonicalizeJson(tamperedRecord), "utf8"),
      });
    } else {
      addZipFile(
        recordPath,
        canonicalizeJson(record),
        "application/json",
        "WORKSPACE_CONFIDENTIAL",
      );
    }
    addZipFile(saltPath, SALT, "text/plain", "SECURITY_SENSITIVE");
    addZipFile(
      evManifestPath,
      canonicalizeJson(evidenceManifest),
      "application/json",
      "WORKSPACE_CONFIDENTIAL",
    );
    addZipFile(
      evBinaryPath,
      evidence,
      "application/pdf",
      "EVIDENCE_CONFIDENTIAL",
    );
  }

  const manifestDraft = {
    schemaVersion: 1,
    generator: "clario-export-v1.0.0",
    createdAt: "2026-10-01T12:30:00Z",
    disclosureLevel: redacted ? "REDACTED" : "FULL",
    chainId: CHAIN_ID,
    workspaceId: WORKSPACE_ID,
    registryAddress: ROOT_REGISTRY,
    canonicalizationSpec: CLARIO_CANONICALIZATION_SPEC_V1,
    exporterAddress: SUBMITTER,
    expenses: [
      {
        expenseId: EXPENSE_ID,
        versions: [1],
        currentVersion: 1,
        isSettled: true,
      },
    ],
    files: manifestFiles,
  };

  const manifest = validateVerificationPackageManifestV1(manifestDraft);
  const manifestBytes = Buffer.from(canonicalizeJson(manifest), "utf8");

  zipEntries.push({
    path: "clario-export/manifest.json",
    data: manifestBytes,
  });

  return createDeterministicZip(zipEntries);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  process.stdout.write(
    "Generating sample verification packages for Phase 7 (SUB-001)...\n",
  );

  // 1. Valid full-disclosure package
  const validZip = buildBundle({ redacted: false, tamper: false });
  const validPath = resolve(OUTPUT_DIR, "sample-full-valid.zip");
  await writeFile(validPath, validZip);
  process.stdout.write(
    ` [OK] Created: ${validPath} (${validZip.length} bytes)\n`,
  );

  // 2. Tampered full-disclosure package (claimAmount altered)
  const tamperedZip = buildBundle({ redacted: false, tamper: true });
  const tamperedPath = resolve(OUTPUT_DIR, "sample-full-tampered.zip");
  await writeFile(tamperedPath, tamperedZip);
  process.stdout.write(
    ` [OK] Created: ${tamperedPath} (${tamperedZip.length} bytes)\n`,
  );

  // 3. Redacted package
  const redactedZip = buildBundle({ redacted: true, tamper: false });
  const redactedPath = resolve(OUTPUT_DIR, "sample-redacted.zip");
  await writeFile(redactedPath, redactedZip);
  process.stdout.write(
    ` [OK] Created: ${redactedPath} (${redactedZip.length} bytes)\n`,
  );

  process.stdout.write("\nSample packages generated successfully.\n");
}

main().catch((err) => {
  process.stderr.write(`Failed to generate sample packages: ${err.message}\n`);
  process.exit(1);
});
