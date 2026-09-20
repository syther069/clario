import { describe, expect, it } from "vitest";

import rawSuite from "../../fixtures/golden_vectors_v1.json";

import {
  CLARIO_EXPENSE_V1_DOMAIN,
  computeExpenseCommitmentV1,
  hashCanonicalEvidenceManifestV1,
  hashCanonicalExpenseV1,
  validateCanonicalEvidenceManifestV1,
  validateCanonicalExpenseV1,
  verifyExpenseCommitmentV1,
  type CanonicalEvidenceManifestV1,
  type CanonicalExpenseV1,
  type ExpenseCommitmentParamsV1,
} from "../../index";

interface ValidVector {
  id: string;
  description: string;
  expenseInput: CanonicalExpenseV1;
  manifestInput: CanonicalEvidenceManifestV1;
  commitmentContext: {
    monadChainId: number;
    registryAddress: `0x${string}`;
    salt: `0x${string}`;
  };
  expected: {
    canonicalEvidenceManifestJson: string;
    evidenceManifestHash: `0x${string}`;
    canonicalExpenseJson: string;
    privateRecordHash: `0x${string}`;
    versionCommitment: `0x${string}`;
  };
}

interface TamperedVector {
  id: string;
  baseVectorId: string;
  description: string;
  modifiedExpense?: CanonicalExpenseV1;
  tamperedContext?: {
    monadChainId: number;
    registryAddress: `0x${string}`;
    salt: `0x${string}`;
  };
  expectedChange: string;
}

interface MalformedVector {
  id: string;
  description: string;
  target: "EXPENSE" | "MANIFEST" | "COMMITMENT_CONTEXT";
  input?: unknown;
  context?: unknown;
  expectedErrorPattern: string;
}

interface GoldenVectorSuite {
  version: number;
  domainSeparators: {
    CLARIO_EXPENSE_V1_DOMAIN: `0x${string}`;
    CLARIO_EVIDENCE_V1_DOMAIN: `0x${string}`;
  };
  validVectors: ValidVector[];
  tamperedVectors: TamperedVector[];
  malformedVectors: MalformedVector[];
}

const suite = rawSuite as unknown as GoldenVectorSuite;

describe("PRO-002 Cross-Runtime Golden Commitment Vectors Suite", () => {
  describe("fixture integrity & protocol domain constants", () => {
    it("verifies fixture version and domain separation constants", () => {
      expect(suite.version).toBe(1);
      expect(suite.domainSeparators.CLARIO_EXPENSE_V1_DOMAIN).toBe(
        CLARIO_EXPENSE_V1_DOMAIN,
      );
      expect(suite.validVectors.length).toBeGreaterThanOrEqual(10);
      expect(suite.tamperedVectors.length).toBeGreaterThanOrEqual(8);
      expect(suite.malformedVectors.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("valid golden vectors verification", () => {
    for (const vector of suite.validVectors) {
      it(`matches valid vector: ${vector.id} (${vector.description})`, () => {
        // 1. Evidence Manifest canonicalization and hash
        const computedManifestHash = hashCanonicalEvidenceManifestV1(
          vector.manifestInput,
        );
        expect(computedManifestHash).toBe(vector.expected.evidenceManifestHash);

        // 2. Expense Record canonicalization and private hash
        const computedPrivateHash = hashCanonicalExpenseV1(vector.expenseInput);
        expect(computedPrivateHash).toBe(vector.expected.privateRecordHash);

        // 3. Commitment construction
        const commitmentParams: ExpenseCommitmentParamsV1 = {
          monadChainId: vector.commitmentContext.monadChainId,
          registryAddress: vector.commitmentContext.registryAddress,
          workspaceId: vector.expenseInput.workspaceId,
          expenseId: vector.expenseInput.expenseId,
          version: vector.expenseInput.version,
          privateRecordHash: computedPrivateHash,
          evidenceManifestHash: computedManifestHash,
          salt: vector.commitmentContext.salt,
        };

        const computedCommitment = computeExpenseCommitmentV1(commitmentParams);
        expect(computedCommitment).toBe(vector.expected.versionCommitment);

        // 4. Commitment verification helper
        const isVerified = verifyExpenseCommitmentV1(
          commitmentParams,
          vector.expected.versionCommitment,
        );
        expect(isVerified).toBe(true);
      });
    }
  });

  describe("independent secondary runtime implementation parity", () => {
    // Independent canonical serializer implemented completely independently from canonicalizeJson
    function independentJcs(obj: unknown): string {
      if (obj === null || typeof obj !== "object") {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return `[${obj.map((item) => independentJcs(item)).join(",")}]`;
      }
      const record = obj as Record<string, unknown>;
      const keys = Object.keys(record).sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      const kvs = keys.map((k) => `"${k}":${independentJcs(record[k])}`);
      return `{${kvs.join(",")}}`;
    }

    it("verifies independent serializer against all valid vector JSON bytes", () => {
      for (const vector of suite.validVectors) {
        const primaryExpenseJson = vector.expected.canonicalExpenseJson;
        const secondaryExpenseJson = independentJcs(vector.expenseInput);
        expect(secondaryExpenseJson).toBe(primaryExpenseJson);

        const primaryManifestJson =
          vector.expected.canonicalEvidenceManifestJson;
        const secondaryManifestJson = independentJcs(vector.manifestInput);
        expect(secondaryManifestJson).toBe(primaryManifestJson);
      }
    });
  });

  describe("tampered & negative vectors verification", () => {
    const validVectorsMap = new Map(suite.validVectors.map((v) => [v.id, v]));

    for (const tampered of suite.tamperedVectors) {
      it(`detects tampering in: ${tampered.id} (${tampered.description})`, () => {
        const baseVector = validVectorsMap.get(tampered.baseVectorId);
        if (!baseVector) {
          throw new Error(`Base vector ${tampered.baseVectorId} not found`);
        }

        if (tampered.modifiedExpense) {
          // Material or non-material content edit
          const tamperedPrivateHash = hashCanonicalExpenseV1(
            tampered.modifiedExpense,
          );
          expect(tamperedPrivateHash).not.toBe(
            baseVector.expected.privateRecordHash,
          );

          const tamperedCommitment = computeExpenseCommitmentV1({
            monadChainId: baseVector.commitmentContext.monadChainId,
            registryAddress: baseVector.commitmentContext.registryAddress,
            workspaceId: tampered.modifiedExpense.workspaceId,
            expenseId: tampered.modifiedExpense.expenseId,
            version: tampered.modifiedExpense.version,
            privateRecordHash: tamperedPrivateHash,
            evidenceManifestHash: baseVector.expected.evidenceManifestHash,
            salt: baseVector.commitmentContext.salt,
          });
          expect(tamperedCommitment).not.toBe(
            baseVector.expected.versionCommitment,
          );

          // Verification with original expected commitment must fail
          const isVerified = verifyExpenseCommitmentV1(
            {
              monadChainId: baseVector.commitmentContext.monadChainId,
              registryAddress: baseVector.commitmentContext.registryAddress,
              workspaceId: tampered.modifiedExpense.workspaceId,
              expenseId: tampered.modifiedExpense.expenseId,
              version: tampered.modifiedExpense.version,
              privateRecordHash: tamperedPrivateHash,
              evidenceManifestHash: baseVector.expected.evidenceManifestHash,
              salt: baseVector.commitmentContext.salt,
            },
            baseVector.expected.versionCommitment,
          );
          expect(isVerified).toBe(false);
        } else if (tampered.tamperedContext) {
          // Context tampering (salt, chainId, registry)
          const tamperedCommitment = computeExpenseCommitmentV1({
            monadChainId: tampered.tamperedContext.monadChainId,
            registryAddress: tampered.tamperedContext.registryAddress,
            workspaceId: baseVector.expenseInput.workspaceId,
            expenseId: baseVector.expenseInput.expenseId,
            version: baseVector.expenseInput.version,
            privateRecordHash: baseVector.expected.privateRecordHash,
            evidenceManifestHash: baseVector.expected.evidenceManifestHash,
            salt: tampered.tamperedContext.salt,
          });
          expect(tamperedCommitment).not.toBe(
            baseVector.expected.versionCommitment,
          );

          const isVerified = verifyExpenseCommitmentV1(
            {
              monadChainId: tampered.tamperedContext.monadChainId,
              registryAddress: tampered.tamperedContext.registryAddress,
              workspaceId: baseVector.expenseInput.workspaceId,
              expenseId: baseVector.expenseInput.expenseId,
              version: baseVector.expenseInput.version,
              privateRecordHash: baseVector.expected.privateRecordHash,
              evidenceManifestHash: baseVector.expected.evidenceManifestHash,
              salt: tampered.tamperedContext.salt,
            },
            baseVector.expected.versionCommitment,
          );
          expect(isVerified).toBe(false);
        }
      });
    }

    it("verifies salt variation pair on identical record produces distinct commitments", () => {
      const vectorA = validVectorsMap.get("valid_salt_variation_a");
      const vectorB = validVectorsMap.get("valid_salt_variation_b");
      expect(vectorA).toBeDefined();
      expect(vectorB).toBeDefined();

      // Private hashes are identical because expense inputs are identical
      expect(vectorA?.expected.privateRecordHash).toBe(
        vectorB?.expected.privateRecordHash,
      );
      // But final commitments MUST be distinct
      expect(vectorA?.expected.versionCommitment).not.toBe(
        vectorB?.expected.versionCommitment,
      );
    });

    it("verifies single-byte material modification alters commitment", () => {
      const base = validVectorsMap.get("valid_standard_v1")!;
      // Modify claimAmount from "450000000" to "450000001" (1 byte diff)
      const modified: CanonicalExpenseV1 = {
        ...base.expenseInput,
        claimAmount: "450000001",
      };
      const hash1 = hashCanonicalExpenseV1(base.expenseInput);
      const hash2 = hashCanonicalExpenseV1(modified);
      expect(hash1).not.toBe(hash2);

      const comm1 = computeExpenseCommitmentV1({
        monadChainId: base.commitmentContext.monadChainId,
        registryAddress: base.commitmentContext.registryAddress,
        workspaceId: base.expenseInput.workspaceId,
        expenseId: base.expenseInput.expenseId,
        version: base.expenseInput.version,
        privateRecordHash: hash1,
        evidenceManifestHash: base.expected.evidenceManifestHash,
        salt: base.commitmentContext.salt,
      });
      const comm2 = computeExpenseCommitmentV1({
        monadChainId: base.commitmentContext.monadChainId,
        registryAddress: base.commitmentContext.registryAddress,
        workspaceId: modified.workspaceId,
        expenseId: modified.expenseId,
        version: modified.version,
        privateRecordHash: hash2,
        evidenceManifestHash: base.expected.evidenceManifestHash,
        salt: base.commitmentContext.salt,
      });
      expect(comm1).not.toBe(comm2);
    });
  });

  describe("malformed vectors rejection", () => {
    for (const malformed of suite.malformedVectors) {
      it(`rejects malformed input: ${malformed.id} (${malformed.description})`, () => {
        const regex = new RegExp(malformed.expectedErrorPattern);
        if (malformed.target === "EXPENSE") {
          expect(() => validateCanonicalExpenseV1(malformed.input)).toThrow(
            regex,
          );
        } else if (malformed.target === "MANIFEST") {
          expect(() =>
            validateCanonicalEvidenceManifestV1(malformed.input),
          ).toThrow(regex);
        } else if (malformed.target === "COMMITMENT_CONTEXT") {
          const ctx = malformed.context as ExpenseCommitmentParamsV1;
          const dummyHash =
            "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`;
          expect(() =>
            computeExpenseCommitmentV1({
              monadChainId: ctx.monadChainId,
              registryAddress: ctx.registryAddress,
              workspaceId: dummyHash,
              expenseId: dummyHash,
              version: 1,
              privateRecordHash: dummyHash,
              evidenceManifestHash: dummyHash,
              salt: ctx.salt,
            }),
          ).toThrow(regex);
        }
      });
    }
  });
});
