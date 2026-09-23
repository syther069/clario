import { describe, expect, it } from "vitest";
import {
  computeExpenseCommitmentV1,
  hashCanonicalEvidenceManifestV1,
  hashCanonicalExpenseV1,
} from "../schema/v1/commitment.js";
import { canonicalizeJson } from "../schema/v1/canonicalize.js";
import type {
  CanonicalEvidenceManifestV1,
  CanonicalExpenseV1,
} from "../schema/v1/types.js";
import {
  CLARIO_CANONICALIZATION_SPEC_V1,
  type VerificationPackageBundle,
  type VerificationPackageManifestV1,
} from "../package/types.js";
import { computePackageFileHash } from "../package/validate.js";
import type {
  VerifierChainSource,
  VerifierDecisionState,
  VerifierExpenseVersionState,
  VerifierSettlementState,
} from "./types.js";
import { verifyPackage } from "./verify.js";

const WORKSPACE_ID = `0x${"11".repeat(32)}` as `0x${string}`;
const EXPENSE_ID = `0x${"22".repeat(32)}` as `0x${string}`;
const ROOT_REGISTRY = `0x${"33".repeat(20)}` as `0x${string}`;
const EXPENSE_REGISTRY = `0x${"44".repeat(20)}` as `0x${string}`;
const USDC = `0x${"55".repeat(20)}` as `0x${string}`;
const SUBMITTER = `0x${"66".repeat(20)}` as `0x${string}`;
const REVIEWER = `0x${"77".repeat(20)}` as `0x${string}`;
const RECIPIENT = `0x${"88".repeat(20)}` as `0x${string}`;
const SALT = `0x${"99".repeat(32)}` as `0x${string}`;
const CHAIN_ID = 31337;

interface Fixture {
  bundle: VerificationPackageBundle;
  chain: MutableChainSource;
  recordPath: string;
  saltPath: string;
  evidencePath: string;
}

class MutableChainSource implements VerifierChainSource {
  chainId = CHAIN_ID;
  registryAddress = ROOT_REGISTRY;
  currentVersion = 1;
  versionState: VerifierExpenseVersionState | null = null;
  decisionState: VerifierDecisionState | null = null;
  settlementState: VerifierSettlementState | null = null;

  async getChainId(): Promise<number> {
    return this.chainId;
  }
  async isRegistry(registryAddress: string): Promise<boolean> {
    return registryAddress.toLowerCase() === this.registryAddress.toLowerCase();
  }
  async getCurrentVersion(): Promise<number> {
    return this.currentVersion;
  }
  async getExpenseVersion(): Promise<VerifierExpenseVersionState | null> {
    return this.versionState;
  }
  async getDecision(): Promise<VerifierDecisionState | null> {
    return this.decisionState;
  }
  async getSettlement(): Promise<VerifierSettlementState | null> {
    return this.settlementState;
  }
}

function addFile(
  files: Map<string, Buffer>,
  entries: VerificationPackageManifestV1["files"] extends readonly (infer T)[]
    ? T[]
    : never,
  path: string,
  value: Buffer | string,
  privacyClass:
    | "PUBLIC"
    | "WORKSPACE_CONFIDENTIAL"
    | "EVIDENCE_CONFIDENTIAL"
    | "SECURITY_SENSITIVE",
  mediaType = "application/json",
): void {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  files.set(path, data);
  entries.push({
    path,
    sizeBytes: data.length,
    sha256: computePackageFileHash(data),
    mediaType,
    privacyClass,
  });
}

function replaceDeclaredFile(
  fixture: Fixture,
  path: string,
  data: Buffer,
): void {
  fixture.bundle.files.set(path, data);
  const entry = fixture.bundle.manifest.files.find(
    (item) => item.path === path,
  );
  if (!entry) throw new Error(`Missing manifest entry ${path}`);
  Object.assign(entry, {
    sizeBytes: data.length,
    sha256: computePackageFileHash(data),
  });
}

function createFixture(redacted = false): Fixture {
  const evidence = Buffer.from("synthetic receipt fixture", "utf8");
  const evidenceHash = `0x${computePackageFileHash(evidence)}` as `0x${string}`;
  const evidenceManifest: CanonicalEvidenceManifestV1 = {
    manifestVersion: 1,
    entries: [
      {
        evidenceId: "evidence-fixture-1",
        mimeType: "application/pdf",
        sizeBytes: evidence.length,
        plaintextHash: evidenceHash,
        ciphertextHash: evidenceHash,
        uploadedAt: "2026-09-20T10:00:00Z",
      },
    ],
    previousManifestHash: null,
  };
  const evidenceManifestHash =
    hashCanonicalEvidenceManifestV1(evidenceManifest);
  const record: CanonicalExpenseV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    expenseId: EXPENSE_ID,
    version: 1,
    title: "Synthetic security review",
    businessPurpose: "Verifier test fixture",
    category: "professional_services",
    project: "clario",
    merchant: "Fixture Vendor",
    expenseDate: "2026-09-20",
    claimAmount: "2500000",
    claimAsset: USDC,
    recipient: RECIPIENT,
    paymentSource: "manual",
    sourceChainId: null,
    sourceTransactionHash: null,
    evidenceManifestHash,
    submittedBy: SUBMITTER,
    submittedAt: "2026-09-20T10:05:00Z",
    client: null,
    invoiceNumber: null,
    location: null,
    notes: null,
    tags: ["fixture"],
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
    sourceCommit: "ab".repeat(20),
    chainFamily: "local",
    chainId: CHAIN_ID,
    deployer: SUBMITTER,
    deployedAt: "2026-09-20T09:00:00Z",
    contracts: {
      ClarioRegistry: {
        address: ROOT_REGISTRY,
        deploymentBlock: 1,
        transactionHash: `0x${"aa".repeat(32)}`,
        abiHash: `0x${"bb".repeat(32)}`,
        verifiedSourceUrl: null,
      },
    },
    tokens: { USDC: { address: USDC, decimals: 6 } },
  };
  const policy = {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    policyVersion: 1,
    policyCommitment: `0x${"cc".repeat(32)}`,
    ownerAddress: SUBMITTER,
    roles: [],
    exportedAt: "2026-09-20T11:00:00Z",
  };

  const files = new Map<string, Buffer>();
  const entries: Array<VerificationPackageManifestV1["files"][number]> = [];
  addFile(
    files,
    entries,
    "workspace-policy.json",
    canonicalizeJson(policy),
    "PUBLIC",
  );
  addFile(
    files,
    entries,
    "chain/deployment-manifest.json",
    canonicalizeJson(deployment),
    "PUBLIC",
  );
  addFile(files, entries, "chain/expected-events.json", "[]", "PUBLIC");

  const recordPath = `expenses/${EXPENSE_ID}/v1/record.json`;
  const saltPath = `expenses/${EXPENSE_ID}/v1/salt.txt`;
  const evidenceManifestPath = `expenses/${EXPENSE_ID}/v1/evidence-manifest.json`;
  const evidencePath = "evidence/evidence-fixture-1.pdf";
  if (redacted) {
    for (const [path, mediaType, privacyClass] of [
      [recordPath, "application/json", "WORKSPACE_CONFIDENTIAL"],
      [saltPath, "text/plain", "SECURITY_SENSITIVE"],
      [evidenceManifestPath, "application/json", "WORKSPACE_CONFIDENTIAL"],
      [evidencePath, "application/pdf", "EVIDENCE_CONFIDENTIAL"],
    ] as const) {
      entries.push({
        path,
        sizeBytes: 0,
        sha256: "0".repeat(64),
        mediaType,
        privacyClass,
        isRedacted: true,
      });
    }
  } else {
    addFile(
      files,
      entries,
      recordPath,
      canonicalizeJson(record),
      "WORKSPACE_CONFIDENTIAL",
    );
    addFile(files, entries, saltPath, SALT, "SECURITY_SENSITIVE", "text/plain");
    addFile(
      files,
      entries,
      evidenceManifestPath,
      canonicalizeJson(evidenceManifest),
      "WORKSPACE_CONFIDENTIAL",
    );
    addFile(
      files,
      entries,
      evidencePath,
      evidence,
      "EVIDENCE_CONFIDENTIAL",
      "application/pdf",
    );
  }

  const manifest: VerificationPackageManifestV1 = {
    schemaVersion: 1,
    generator: "clario-verifier-test-fixture",
    createdAt: "2026-09-20T11:00:00Z",
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
    files: entries,
  };

  const chain = new MutableChainSource();
  chain.versionState = {
    registryAddress: EXPENSE_REGISTRY,
    commitment,
    submitter: SUBMITTER,
    submittedAtBlock: 10n,
    isSuperseded: false,
  };
  chain.decisionState = {
    decision: "APPROVE",
    commitment,
    reviewer: REVIEWER,
    policyVersion: 1,
    decidedAtBlock: 11n,
    transactionHash: `0x${"dd".repeat(32)}`,
    reviewerWasAuthorized: true,
    isCurrentApprovalValid: true,
  };
  chain.settlementState = {
    commitment,
    token: USDC,
    recipient: RECIPIENT,
    amount: 2_500_000n,
    paymentReference: `0x${"ee".repeat(32)}`,
    executor: `0x${"ff".repeat(20)}`,
    settledAtBlock: 12n,
    transactionHash: `0x${"12".repeat(32)}`,
    hasMatchingTokenTransfer: true,
    conflictingSettlementCount: 0,
  };

  return {
    bundle: { manifest, files },
    chain,
    recordPath,
    saltPath,
    evidencePath,
  };
}

describe("independent verification package verifier", () => {
  it("verifies a complete package without any authenticated Clario API", async () => {
    const fixture = createFixture();
    const report = await verifyPackage({
      bundle: fixture.bundle,
      chainSource: fixture.chain,
    });
    expect(report.overall).toBe("VERIFIED");
    expect(report.checks.every((check) => check.status === "VERIFIED")).toBe(
      true,
    );
    expect(report.limitations.join(" ")).toMatch(
      /does not prove that evidence is genuine/i,
    );
  });

  it("fails a changed canonical field even when the attacker updates the file hash", async () => {
    const fixture = createFixture();
    const record = JSON.parse(
      fixture.bundle.files.get(fixture.recordPath)!.toString("utf8"),
    );
    record.claimAmount = "2500001";
    replaceDeclaredFile(
      fixture,
      fixture.recordPath,
      Buffer.from(canonicalizeJson(record)),
    );
    const report = await verifyPackage({
      bundle: fixture.bundle,
      chainSource: fixture.chain,
    });
    expect(report.overall).toBe("FAILED");
    expect(
      report.checks.find((check) => check.id.endsWith(".commitment"))?.status,
    ).toBe("FAILED");
  });

  it("fails changed evidence, wrong salt, wrong chain, unauthorized review, stale version, and unmatched settlement", async () => {
    const mutations: Array<(fixture: Fixture) => void> = [
      (fixture) =>
        replaceDeclaredFile(
          fixture,
          fixture.evidencePath,
          Buffer.from("changed evidence"),
        ),
      (fixture) =>
        replaceDeclaredFile(
          fixture,
          fixture.saltPath,
          Buffer.from(`0x${"10".repeat(32)}`),
        ),
      (fixture) => {
        fixture.chain.chainId = 10143;
      },
      (fixture) => {
        Object.assign(fixture.bundle.manifest, {
          registryAddress: `0x${"13".repeat(20)}`,
        });
      },
      (fixture) => {
        fixture.chain.decisionState = {
          ...fixture.chain.decisionState!,
          reviewerWasAuthorized: false,
        };
      },
      (fixture) => {
        fixture.chain.currentVersion = 2;
      },
      (fixture) => {
        fixture.chain.settlementState = {
          ...fixture.chain.settlementState!,
          amount: 2_500_001n,
        };
      },
    ];
    for (const mutate of mutations) {
      const fixture = createFixture();
      mutate(fixture);
      const report = await verifyPackage({
        bundle: fixture.bundle,
        chainSource: fixture.chain,
      });
      expect(report.overall).toBe("FAILED");
    }
  });

  it("reports intentionally redacted cryptographic inputs as unverifiable, never passed", async () => {
    const fixture = createFixture(true);
    const report = await verifyPackage({
      bundle: fixture.bundle,
      chainSource: fixture.chain,
    });
    expect(report.overall).toBe("UNVERIFIABLE");
    expect(report.checks.some((check) => check.status === "UNVERIFIABLE")).toBe(
      true,
    );
    expect(
      report.checks.filter((check) => check.id.includes("private-inputs"))[0]
        ?.status,
    ).toBe("UNVERIFIABLE");
  });

  it("keeps onchain checks unverifiable when no public chain source is supplied", async () => {
    const fixture = createFixture();
    const report = await verifyPackage({ bundle: fixture.bundle });
    expect(report.overall).toBe("UNVERIFIABLE");
    expect(
      report.checks.find((check) => check.id === "chain.source")?.status,
    ).toBe("UNVERIFIABLE");
  });
});
