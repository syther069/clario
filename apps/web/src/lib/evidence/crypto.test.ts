import { describe, expect, it } from "vitest";
import {
  AUTH_TAG_LENGTH_BYTES,
  canonicalizeAuthContext,
  computeSha256,
  decryptEvidence,
  encryptEvidence,
  generateDataEncryptionKey,
  IV_LENGTH_BYTES,
  KEY_LENGTH_BYTES,
  unwrapKey,
  wrapKey,
} from "./crypto";

describe("Evidence Cryptography Module", () => {
  const testContext = {
    workspaceId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    expenseId:
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    version: 1,
    evidenceId: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
  };

  const samplePlaintext = Buffer.from(
    "Sensitive Receipt Data: $120.50 USD at Acme Cloud",
    "utf8",
  );
  const testKek = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex",
  );

  describe("DEK Generation and Properties", () => {
    it("generates a 256-bit (32 bytes) cryptographically random key", () => {
      const dek1 = generateDataEncryptionKey();
      const dek2 = generateDataEncryptionKey();

      expect(dek1.length).toBe(KEY_LENGTH_BYTES);
      expect(dek2.length).toBe(KEY_LENGTH_BYTES);
      expect(dek1.equals(dek2)).toBe(false);
    });
  });

  describe("Context Canonicalization and AAD Binding", () => {
    it("produces deterministic canonical bytes for the same context", () => {
      const aad1 = canonicalizeAuthContext(testContext);
      const aad2 = canonicalizeAuthContext({ ...testContext });

      expect(aad1.equals(aad2)).toBe(true);
      const json = JSON.parse(aad1.toString("utf8"));
      expect(json.workspaceId).toBe(testContext.workspaceId);
      expect(json.expenseId).toBe(testContext.expenseId);
      expect(json.version).toBe(1);
      expect(json.evidenceId).toBe(testContext.evidenceId);
    });

    it("throws when context fields are missing or version is non-positive", () => {
      expect(() =>
        canonicalizeAuthContext({ ...testContext, workspaceId: "" }),
      ).toThrow("Invalid EvidenceAuthContext");

      expect(() =>
        canonicalizeAuthContext({ ...testContext, version: 0 }),
      ).toThrow("Invalid EvidenceAuthContext");

      expect(() =>
        canonicalizeAuthContext({ ...testContext, version: -1 }),
      ).toThrow("Invalid EvidenceAuthContext");
    });
  });

  describe("AES-256-GCM Envelope Encryption and Decryption", () => {
    it("encrypts and decrypts round-trip successfully", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      expect(enc.ciphertext.length).toBe(samplePlaintext.length);
      expect(enc.iv.length).toBe(IV_LENGTH_BYTES);
      expect(enc.authTag.length).toBe(AUTH_TAG_LENGTH_BYTES);

      const decrypted = decryptEvidence(
        enc.ciphertext,
        dek,
        enc.iv,
        enc.authTag,
        testContext,
      );

      expect(decrypted.equals(samplePlaintext)).toBe(true);
      expect(decrypted.toString("utf8")).toBe(samplePlaintext.toString("utf8"));
    });

    it("fails closed when ciphertext is tampered (1-bit change)", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const tamperedCiphertext = Buffer.from(enc.ciphertext);
      tamperedCiphertext[0] = (tamperedCiphertext[0] ?? 0) ^ 0x01;

      expect(() =>
        decryptEvidence(
          tamperedCiphertext,
          dek,
          enc.iv,
          enc.authTag,
          testContext,
        ),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when IV is tampered", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const tamperedIv = Buffer.from(enc.iv);
      tamperedIv[0] = (tamperedIv[0] ?? 0) ^ 0x01;

      expect(() =>
        decryptEvidence(
          enc.ciphertext,
          dek,
          tamperedIv,
          enc.authTag,
          testContext,
        ),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when auth tag is tampered", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const tamperedTag = Buffer.from(enc.authTag);
      tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0x01;

      expect(() =>
        decryptEvidence(enc.ciphertext, dek, enc.iv, tamperedTag, testContext),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when AAD context is modified (wrong workspaceId)", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const wrongContext = {
        ...testContext,
        workspaceId:
          "0x9999999999999999999999999999999999999999999999999999999999999999",
      };

      expect(() =>
        decryptEvidence(enc.ciphertext, dek, enc.iv, enc.authTag, wrongContext),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when AAD context is modified (wrong expenseId)", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const wrongContext = {
        ...testContext,
        expenseId:
          "0x8888888888888888888888888888888888888888888888888888888888888888",
      };

      expect(() =>
        decryptEvidence(enc.ciphertext, dek, enc.iv, enc.authTag, wrongContext),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when AAD context is modified (wrong version)", () => {
      const dek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      const wrongContext = {
        ...testContext,
        version: 2,
      };

      expect(() =>
        decryptEvidence(enc.ciphertext, dek, enc.iv, enc.authTag, wrongContext),
      ).toThrow(/Decryption failed/);
    });

    it("fails closed when wrong DEK is provided", () => {
      const dek = generateDataEncryptionKey();
      const wrongDek = generateDataEncryptionKey();
      const enc = encryptEvidence(samplePlaintext, dek, testContext);

      expect(() =>
        decryptEvidence(
          enc.ciphertext,
          wrongDek,
          enc.iv,
          enc.authTag,
          testContext,
        ),
      ).toThrow(/Decryption failed/);
    });
  });

  describe("Key Wrapping and Unwrapping with KEK", () => {
    it("wraps and unwraps DEK correctly", () => {
      const dek = generateDataEncryptionKey();
      const wrapped = wrapKey(dek, testKek, "kek-v1");

      expect(wrapped.wrappedKey.length).toBe(KEY_LENGTH_BYTES);
      expect(wrapped.iv.length).toBe(IV_LENGTH_BYTES);
      expect(wrapped.authTag.length).toBe(AUTH_TAG_LENGTH_BYTES);
      expect(wrapped.keyId).toBe("kek-v1");

      const unwrapped = unwrapKey(wrapped, testKek);
      expect(unwrapped.equals(dek)).toBe(true);
    });

    it("fails closed if wrapped key is tampered", () => {
      const dek = generateDataEncryptionKey();
      const wrapped = wrapKey(dek, testKek, "kek-v1");

      const tamperedKey = Buffer.from(wrapped.wrappedKey);
      tamperedKey[0] = (tamperedKey[0] ?? 0) ^ 0x01;

      expect(() =>
        unwrapKey({ ...wrapped, wrappedKey: tamperedKey }, testKek),
      ).toThrow(/Key unwrap failed/);
    });

    it("fails closed if wrong KEK is used to unwrap", () => {
      const dek = generateDataEncryptionKey();
      const wrapped = wrapKey(dek, testKek, "kek-v1");

      const wrongKek = Buffer.from(
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        "hex",
      );

      expect(() => unwrapKey(wrapped, wrongKek)).toThrow(/Key unwrap failed/);
    });
  });

  describe("SHA-256 Commitment Computation", () => {
    it("computes 0x-prefixed 64-character hex hash", () => {
      const hash = computeSha256(samplePlaintext);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("produces deterministic output", () => {
      const hash1 = computeSha256(samplePlaintext);
      const hash2 = computeSha256(
        Buffer.from(
          "Sensitive Receipt Data: $120.50 USD at Acme Cloud",
          "utf8",
        ),
      );
      expect(hash1).toBe(hash2);
    });
  });
});
