import { describe, expect, it } from "vitest";
import {
  computeExpenseCommitmentV1,
  verifyExpenseCommitmentV1,
  validateCanonicalEvidenceManifestV1,
  validateCanonicalExpenseV1,
} from "@clario/protocol";
import {
  assertCalldataPrivacy,
  buildCanonicalEvidenceManifest,
  buildCanonicalExpenseRecord,
  encodeSubmitVersionCalldata,
  ZERO_BYTES32,
  type RawEvidenceItem,
} from "./submission";
import type { ExpenseDraftPayload } from "./types";

describe("Expense Submission & Canonicalization (EXP-003)", () => {
  const samplePayload: ExpenseDraftPayload = {
    title: "Offsite flight ticket",
    businessPurpose: "Travel to core engineering offsite in Lisbon",
    category: "travel",
    project: "infrastructure",
    merchant: "TAP Air Portugal",
    expenseDate: "2026-09-15",
    claimAmount: "450",
    claimAsset: "0x0000000000000000000000000000000000001001",
    recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    paymentSource: "imported_transaction",
    sourceChainId: 1,
    sourceTransactionHash:
      "0x3333333333333333333333333333333333333333333333333333333333333333",
    client: "Acme Corp",
    invoiceNumber: "INV-2026-0901",
    location: "Lisbon, Portugal",
    notes: "Approved in advance during budget planning",
    tags: ["travel", "engineering"], // out of order to verify sorting
  };

  const sampleEvidence: RawEvidenceItem[] = [
    {
      evidenceId: "ev-002",
      mimeType: "image/png",
      byteLength: 524288,
      sha256Hash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      createdAt: "2026-09-15T11:58:00Z",
    },
    {
      evidenceId: "ev-001",
      mimeType: "application/pdf",
      byteLength: 1048576,
      sha256Hash:
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ciphertextHash:
        "0x6666666666666666666666666666666666666666666666666666666666666666",
      createdAt: "2026-09-15T11:55:00Z",
    },
  ];

  it("builds a canonical evidence manifest sorted strictly by ascending evidenceId", () => {
    const { manifest, manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: sampleEvidence,
    });

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.entries.length).toBe(2);
    // Verified ascending order
    expect(manifest.entries[0]!.evidenceId).toBe("ev-001");
    expect(manifest.entries[1]!.evidenceId).toBe("ev-002");
    expect(manifestHash).toMatch(/^0x[0-9a-f]{64}$/);

    // Verifies schema validation passes
    expect(() => validateCanonicalEvidenceManifestV1(manifest)).not.toThrow();
  });

  it("builds an empty canonical evidence manifest when no attachments exist", () => {
    const { manifest, manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: [],
    });

    expect(manifest.entries.length).toBe(0);
    expect(manifest.previousManifestHash).toBeNull();
    expect(manifestHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(() => validateCanonicalEvidenceManifestV1(manifest)).not.toThrow();
  });

  it("builds a canonical expense record and validates schema v1 rules", () => {
    const { manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: sampleEvidence,
    });

    const { canonicalExpense, privateRecordHash } = buildCanonicalExpenseRecord(
      {
        workspaceId:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        expenseId:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
        version: 1,
        payload: samplePayload,
        evidenceManifestHash: manifestHash,
        submittedBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        submittedAt: "2026-09-15T12:00:00Z",
      },
    );

    expect(canonicalExpense.schemaVersion).toBe(1);
    expect(canonicalExpense.title).toBe("Offsite flight ticket");
    // Tags must be sorted and deduplicated
    expect(canonicalExpense.tags).toEqual(["engineering", "travel"]);
    // 450 tokens with 6 decimals = 450000000 base units
    expect(canonicalExpense.claimAmount).toBe("450000000");
    expect(privateRecordHash).toMatch(/^0x[0-9a-f]{64}$/);

    expect(() => validateCanonicalExpenseV1(canonicalExpense)).not.toThrow();
  });

  it("computes deterministic salted commitment verified by verifyExpenseCommitmentV1", () => {
    const workspaceId =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const expenseId =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    const registryAddress = "0x00000000000000000000000000000000000000aa";
    const salt =
      "0x7777777777777777777777777777777777777777777777777777777777777777";

    const { manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: sampleEvidence.slice(1), // single PDF
    });

    const { privateRecordHash } = buildCanonicalExpenseRecord({
      workspaceId,
      expenseId,
      version: 1,
      payload: samplePayload,
      evidenceManifestHash: manifestHash,
      submittedBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      submittedAt: "2026-09-15T12:00:00Z",
    });

    const commitment = computeExpenseCommitmentV1({
      monadChainId: 10143,
      registryAddress,
      workspaceId,
      expenseId,
      version: 1,
      privateRecordHash,
      evidenceManifestHash: manifestHash,
      salt,
    });

    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);

    const isValid = verifyExpenseCommitmentV1(
      {
        monadChainId: 10143,
        registryAddress,
        workspaceId,
        expenseId,
        version: 1,
        privateRecordHash,
        evidenceManifestHash: manifestHash,
        salt,
      },
      commitment,
    );
    expect(isValid).toBe(true);
  });

  it("encodes submitVersion calldata conforming to ClarioExpenseRegistryV1", () => {
    const workspaceId =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const expenseId =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    const commitment =
      "0x4a330d1707527cc7108e06dac8bf8439ccd982cb826d1d308fea85fc6125f7c4";

    const calldata = encodeSubmitVersionCalldata({
      workspaceId,
      expenseId,
      version: 1,
      commitment,
      previousCommitment: ZERO_BYTES32,
    });

    // submitVersion(bytes32,bytes32,uint32,bytes32,bytes32) function selector is 0x06377857
    expect(calldata.startsWith("0x06377857")).toBe(true);
    // Length: 4 bytes selector + 5 * 32 bytes = 164 bytes = 330 hex chars (with 0x)
    expect(calldata.length).toBe(2 + 8 + 5 * 64);
  });

  it("assertCalldataPrivacy passes when calldata contains only public hashes", () => {
    const workspaceId =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const expenseId =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    const commitment =
      "0x4a330d1707527cc7108e06dac8bf8439ccd982cb826d1d308fea85fc6125f7c4";

    const calldata = encodeSubmitVersionCalldata({
      workspaceId,
      expenseId,
      version: 1,
      commitment,
      previousCommitment: ZERO_BYTES32,
    });

    // Confidential fields must NOT appear anywhere in the calldata
    expect(() =>
      assertCalldataPrivacy(calldata, [
        samplePayload.title,
        samplePayload.businessPurpose,
        samplePayload.merchant,
        samplePayload.project,
        samplePayload.notes!,
        samplePayload.client!,
        samplePayload.invoiceNumber!,
      ]),
    ).not.toThrow();
  });

  it("assertCalldataPrivacy detects and throws on confidential leakage in calldata", () => {
    const fakeLeakingCalldata =
      "0x06377857" + Buffer.from("TAP Air Portugal", "utf8").toString("hex");

    expect(() =>
      assertCalldataPrivacy(fakeLeakingCalldata, [
        "TAP Air Portugal",
        "Offsite flight ticket",
      ]),
    ).toThrow(/Privacy leak violation/);
  });

  it("tamper resistance: changing any private field alters the commitment", () => {
    const workspaceId =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const expenseId =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    const registryAddress = "0x00000000000000000000000000000000000000aa";
    const salt =
      "0x7777777777777777777777777777777777777777777777777777777777777777";

    const { manifestHash } = buildCanonicalEvidenceManifest({
      evidenceItems: sampleEvidence,
    });

    const record1 = buildCanonicalExpenseRecord({
      workspaceId,
      expenseId,
      version: 1,
      payload: samplePayload,
      evidenceManifestHash: manifestHash,
      submittedBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    const record2 = buildCanonicalExpenseRecord({
      workspaceId,
      expenseId,
      version: 1,
      payload: { ...samplePayload, merchant: "Different Merchant" },
      evidenceManifestHash: manifestHash,
      submittedBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    const comm1 = computeExpenseCommitmentV1({
      monadChainId: 10143,
      registryAddress,
      workspaceId,
      expenseId,
      version: 1,
      privateRecordHash: record1.privateRecordHash,
      evidenceManifestHash: manifestHash,
      salt,
    });

    const comm2 = computeExpenseCommitmentV1({
      monadChainId: 10143,
      registryAddress,
      workspaceId,
      expenseId,
      version: 1,
      privateRecordHash: record2.privateRecordHash,
      evidenceManifestHash: manifestHash,
      salt,
    });

    expect(comm1).not.toBe(comm2);
  });
});
