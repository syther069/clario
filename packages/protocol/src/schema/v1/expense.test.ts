import { describe, expect, it } from "vitest";

import {
  CLARIO_EVIDENCE_V1_DOMAIN,
  CLARIO_EXPENSE_V1_DOMAIN,
  CLARIO_SCHEMA_VERSION_V1,
  EXPENSE_FIELD_DEFINITIONS_V1,
  MATERIAL_EXPENSE_FIELDS_V1,
  canonicalizeJson,
  validateCanonicalEvidenceManifestV1,
  validateCanonicalExpenseV1,
  type CanonicalEvidenceManifestV1,
  type CanonicalExpenseV1,
} from "../../index";

describe("PRO-001 Canonical Expense Schema v1 Specification", () => {
  const sampleValidExpense: CanonicalExpenseV1 = {
    schemaVersion: 1,
    workspaceId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    expenseId:
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    version: 1,
    title: "Offsite flight ticket",
    businessPurpose: "Travel to core engineering offsite in Lisbon",
    category: "travel",
    project: "infrastructure",
    merchant: "TAP Air Portugal",
    expenseDate: "2026-09-15",
    claimAmount: "450000000", // 450.00 USDC (6 decimals)
    claimAsset: "0x0000000000000000000000000000000000001001",
    recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    paymentSource: "imported_transaction",
    sourceChainId: 1,
    sourceTransactionHash:
      "0x3333333333333333333333333333333333333333333333333333333333333333",
    evidenceManifestHash:
      "0x4444444444444444444444444444444444444444444444444444444444444444",
    submittedBy: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    submittedAt: "2026-09-15T12:00:00Z",
    client: null,
    invoiceNumber: "INV-2026-0901",
    location: "Lisbon, Portugal",
    notes: "Approved in advance during budget planning",
    tags: ["engineering", "travel"],
  };

  const sampleValidManifest: CanonicalEvidenceManifestV1 = {
    manifestVersion: 1,
    entries: [
      {
        evidenceId: "ev-001",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
        plaintextHash:
          "0x5555555555555555555555555555555555555555555555555555555555555555",
        ciphertextHash:
          "0x6666666666666666666666666666666666666666666666666666666666666666",
        uploadedAt: "2026-09-15T11:55:00Z",
      },
    ],
    previousManifestHash: null,
  };

  describe("field classifications & materiality rules", () => {
    it("classifies all fields with valid privacy and materiality enums", () => {
      expect(EXPENSE_FIELD_DEFINITIONS_V1.length).toBeGreaterThan(15);
      for (const field of EXPENSE_FIELD_DEFINITIONS_V1) {
        expect([
          "PUBLIC",
          "WORKSPACE_CONFIDENTIAL",
          "EVIDENCE_CONFIDENTIAL",
          "SECURITY_SENSITIVE",
        ]).toContain(field.privacy);
        expect(["MATERIAL", "NON_MATERIAL"]).toContain(field.materiality);
      }
    });

    it("ensures all core approval fields are strictly designated as MATERIAL", () => {
      const requiredMaterials = [
        "claimAmount",
        "claimAsset",
        "recipient",
        "businessPurpose",
        "category",
        "project",
        "merchant",
        "expenseDate",
        "paymentSource",
        "sourceChainId",
        "sourceTransactionHash",
        "evidenceManifestHash",
      ];
      for (const required of requiredMaterials) {
        expect(MATERIAL_EXPENSE_FIELDS_V1).toContain(required);
      }
    });

    it("verifies protocol domain constants are versioned and immutable", () => {
      expect(CLARIO_SCHEMA_VERSION_V1).toBe(1);
      expect(CLARIO_EXPENSE_V1_DOMAIN).toMatch(/^0x[0-9a-f]{64}$/);
      expect(CLARIO_EVIDENCE_V1_DOMAIN).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("RFC 8785 JCS canonicalization", () => {
    it("sorts object keys deterministically regardless of property insertion order", () => {
      const objA = { z: 1, a: "hello", m: [3, 2, 1] };
      const objB = { a: "hello", m: [3, 2, 1], z: 1 };

      const canonA = canonicalizeJson(objA);
      const canonB = canonicalizeJson(objB);

      expect(canonA).toBe(canonB);
      expect(canonA).toBe('{"a":"hello","m":[3,2,1],"z":1}');
    });

    it("eliminates unnecessary whitespace outside string quotes", () => {
      const canon = canonicalizeJson({ key: " value with space " });
      expect(canon).toBe('{"key":" value with space "}');
    });

    it("produces identical canonical bytes for differently keyed records", () => {
      const shuffled = {
        tags: sampleValidExpense.tags,
        version: sampleValidExpense.version,
        title: sampleValidExpense.title,
        workspaceId: sampleValidExpense.workspaceId,
        schemaVersion: sampleValidExpense.schemaVersion,
        claimAmount: sampleValidExpense.claimAmount,
        expenseId: sampleValidExpense.expenseId,
        recipient: sampleValidExpense.recipient,
        claimAsset: sampleValidExpense.claimAsset,
        businessPurpose: sampleValidExpense.businessPurpose,
        category: sampleValidExpense.category,
        project: sampleValidExpense.project,
        merchant: sampleValidExpense.merchant,
        expenseDate: sampleValidExpense.expenseDate,
        paymentSource: sampleValidExpense.paymentSource,
        sourceChainId: sampleValidExpense.sourceChainId,
        sourceTransactionHash: sampleValidExpense.sourceTransactionHash,
        evidenceManifestHash: sampleValidExpense.evidenceManifestHash,
        submittedBy: sampleValidExpense.submittedBy,
        submittedAt: sampleValidExpense.submittedAt,
        client: sampleValidExpense.client,
        invoiceNumber: sampleValidExpense.invoiceNumber,
        location: sampleValidExpense.location,
        notes: sampleValidExpense.notes,
      };

      expect(canonicalizeJson(sampleValidExpense)).toBe(
        canonicalizeJson(shuffled),
      );
    });
  });

  describe("schema validation rules", () => {
    it("validates a compliant canonical expense record", () => {
      const validated = validateCanonicalExpenseV1(sampleValidExpense);
      expect(validated.schemaVersion).toBe(1);
      expect(validated.claimAmount).toBe("450000000");
    });

    it("rejects non-integer or float claimAmount", () => {
      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          claimAmount: "450.50",
        }),
      ).toThrow(/unsigned integer decimal string/);

      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          claimAmount: "-100",
        }),
      ).toThrow(/unsigned integer decimal string/);

      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          claimAmount: "0123",
        }),
      ).toThrow(/unsigned integer decimal string/);
    });

    it("rejects non-lowercase addresses", () => {
      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          claimAsset: "0x000000000000000000000000000000000000100A",
        }),
      ).toThrow(/lowercase hex address/);
    });

    it("rejects non-NFC normalized strings", () => {
      // "e\u0301" is decomposed "é" (NFD)
      const decomposed = "Cafe\u0301";
      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          title: decomposed,
        }),
      ).toThrow(/Normalization Form C/);
    });

    it("rejects unsorted or duplicate tags", () => {
      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          tags: ["travel", "engineering"], // unsorted
        }),
      ).toThrow(/sorted lexicographically and deduplicated/);

      expect(() =>
        validateCanonicalExpenseV1({
          ...sampleValidExpense,
          tags: ["travel", "travel"], // duplicate
        }),
      ).toThrow(/sorted lexicographically and deduplicated/);
    });

    it("validates compliant evidence manifest", () => {
      const validated =
        validateCanonicalEvidenceManifestV1(sampleValidManifest);
      expect(validated.manifestVersion).toBe(1);
      expect(validated.entries.length).toBe(1);
    });

    it("rejects unsorted evidence entries in manifest", () => {
      const unsortedManifest = {
        manifestVersion: 1,
        entries: [
          {
            ...sampleValidManifest.entries[0],
            evidenceId: "ev-002",
          },
          {
            ...sampleValidManifest.entries[0],
            evidenceId: "ev-001",
          },
        ],
        previousManifestHash: null,
      };

      expect(() =>
        validateCanonicalEvidenceManifestV1(unsortedManifest),
      ).toThrow(/strictly sorted by ascending evidenceId/);
    });
  });

  describe("independent secondary runtime comparison", () => {
    it("produces exact byte parity between recursive serializer and alternative key-sorting routine", () => {
      // Independent implementation: non-recursive flat key-sorting serialization for testing
      function independentSerialize(data: CanonicalExpenseV1): string {
        const sortedKeys = Object.keys(data).sort();
        const parts: string[] = [];
        for (const k of sortedKeys) {
          const v = (data as unknown as Record<string, unknown>)[k];
          if (Array.isArray(v)) {
            parts.push(`"${k}":[${v.map((x) => `"${x}"`).join(",")}]`);
          } else if (v === null) {
            parts.push(`"${k}":null`);
          } else if (typeof v === "number") {
            parts.push(`"${k}":${v}`);
          } else {
            parts.push(`"${k}":${JSON.stringify(v)}`);
          }
        }
        return `{${parts.join(",")}}`;
      }

      const primary = canonicalizeJson(sampleValidExpense);
      const secondary = independentSerialize(sampleValidExpense);
      expect(primary).toBe(secondary);
    });
  });

  describe("cryptographic commitment hardening", () => {
    it("rejects insecure all-zero salt in computeExpenseCommitmentV1", async () => {
      const { computeExpenseCommitmentV1 } = await import("../../index.js");
      expect(() =>
        computeExpenseCommitmentV1({
          monadChainId: 10143,
          registryAddress: "0x00000000000000000000000000000000000000aa",
          workspaceId:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          expenseId:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
          version: 1,
          privateRecordHash:
            "0x3333333333333333333333333333333333333333333333333333333333333333",
          evidenceManifestHash:
            "0x4444444444444444444444444444444444444444444444444444444444444444",
          salt: `0x${"00".repeat(32)}` as `0x${string}`,
        }),
      ).toThrow(/salt must not be all zeros/);
    });
  });
});
