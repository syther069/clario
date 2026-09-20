import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { canonicalizeJson } from "@clario/protocol";

export const AES_GCM_ALGORITHM = "aes-256-gcm";
export const IV_LENGTH_BYTES = 12;
export const AUTH_TAG_LENGTH_BYTES = 16;
export const KEY_LENGTH_BYTES = 32;

export interface EvidenceAuthContext {
  workspaceId: string;
  expenseId: string;
  version: number;
  evidenceId: string;
}

export interface EncryptionResult {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface WrappedKeyResult {
  wrappedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
}

/**
 * Computes deterministic SHA-256 hash formatted as a 0x-prefixed hex string.
 */
export function computeSha256(data: Buffer): string {
  return "0x" + createHash("sha256").update(data).digest("hex");
}

/**
 * Generates a cryptographically random 256-bit Data Encryption Key (DEK).
 */
export function generateDataEncryptionKey(): Buffer {
  return randomBytes(KEY_LENGTH_BYTES);
}

/**
 * Canonicalizes the evidence authentication context into deterministic AAD bytes.
 */
export function canonicalizeAuthContext(context: EvidenceAuthContext): Buffer {
  if (
    !context.workspaceId ||
    !context.expenseId ||
    !context.evidenceId ||
    typeof context.version !== "number" ||
    !Number.isSafeInteger(context.version) ||
    context.version < 1
  ) {
    throw new Error(
      "Invalid EvidenceAuthContext: workspaceId, expenseId, evidenceId, and version (>= 1) are required.",
    );
  }

  const canonical = canonicalizeJson({
    evidenceId: context.evidenceId,
    expenseId: context.expenseId,
    version: context.version,
    workspaceId: context.workspaceId,
  });

  return Buffer.from(canonical, "utf8");
}

/**
 * Encrypts evidence plaintext using AES-256-GCM with authenticated additional data.
 */
export function encryptEvidence(
  plaintext: Buffer,
  dek: Buffer,
  context: EvidenceAuthContext,
): EncryptionResult {
  if (dek.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `Invalid DEK length: expected ${KEY_LENGTH_BYTES} bytes, got ${dek.length}.`,
    );
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const aad = canonicalizeAuthContext(context);

  const cipher = createCipheriv(AES_GCM_ALGORITHM, dek, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
  };
}

/**
 * Decrypts evidence ciphertext using AES-256-GCM with authenticated additional data.
 * Fails closed if ciphertext, IV, authTag, or context have been tampered with.
 */
export function decryptEvidence(
  ciphertext: Buffer,
  dek: Buffer,
  iv: Buffer,
  authTag: Buffer,
  context: EvidenceAuthContext,
): Buffer {
  if (dek.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `Invalid DEK length: expected ${KEY_LENGTH_BYTES} bytes, got ${dek.length}.`,
    );
  }

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(
      `Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.length}.`,
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTag.length}.`,
    );
  }

  const aad = canonicalizeAuthContext(context);

  const decipher = createDecipheriv(AES_GCM_ALGORITHM, dek, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error(
      `Decryption failed: cryptographic authentication check failed (tampered data or wrong context): ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

/**
 * Wraps a Data Encryption Key (DEK) with a Key Encryption Key (KEK) using AES-256-GCM.
 */
export function wrapKey(
  dek: Buffer,
  kek: Buffer,
  keyId = "kek-v1",
): WrappedKeyResult {
  if (dek.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid DEK length: expected ${KEY_LENGTH_BYTES} bytes.`);
  }

  if (kek.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid KEK length: expected ${KEY_LENGTH_BYTES} bytes.`);
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const aad = Buffer.from(keyId, "utf8");

  const cipher = createCipheriv(AES_GCM_ALGORITHM, kek, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  cipher.setAAD(aad);

  const wrappedKey = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    wrappedKey,
    iv,
    authTag,
    keyId,
  };
}

/**
 * Unwraps a Data Encryption Key (DEK) using a Key Encryption Key (KEK).
 * Fails closed if the key has been tampered with or if the wrong KEK is supplied.
 */
export function unwrapKey(
  wrapped: {
    wrappedKey: Buffer;
    iv: Buffer;
    authTag: Buffer;
    keyId?: string;
  },
  kek: Buffer,
): Buffer {
  if (kek.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid KEK length: expected ${KEY_LENGTH_BYTES} bytes.`);
  }

  const aad = Buffer.from(wrapped.keyId ?? "kek-v1", "utf8");

  const decipher = createDecipheriv(AES_GCM_ALGORITHM, kek, wrapped.iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  decipher.setAAD(aad);
  decipher.setAuthTag(wrapped.authTag);

  try {
    return Buffer.concat([
      decipher.update(wrapped.wrappedKey),
      decipher.final(),
    ]);
  } catch (err) {
    throw new Error(
      `Key unwrap failed: unable to unwrap data encryption key with supplied KEK: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
