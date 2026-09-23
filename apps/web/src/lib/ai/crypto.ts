import {
  decryptEvidence,
  encryptEvidence,
  generateDataEncryptionKey,
  unwrapKey,
  wrapKey,
} from "../evidence/crypto";

interface EncryptedAiPayload {
  version: number;
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: string;
  kekIv: string;
  kekAuthTag: string;
  keyId: string;
}

function context(
  workspaceId: string,
  expenseId: string,
  analysisId: string,
  version: number,
) {
  return {
    workspaceId,
    expenseId,
    evidenceId: `ai-analysis:${analysisId}`,
    version,
  };
}

export function encryptAiPayload(
  payload: unknown,
  kek: Buffer,
  ids: {
    workspaceId: string;
    expenseId: string;
    analysisId: string;
    version: number;
  },
): string {
  const dek = generateDataEncryptionKey();
  const encrypted = encryptEvidence(
    Buffer.from(JSON.stringify(payload), "utf8"),
    dek,
    context(ids.workspaceId, ids.expenseId, ids.analysisId, ids.version),
  );
  const wrapped = wrapKey(dek, kek, "kek-v1");
  const stored: EncryptedAiPayload = {
    version: ids.version,
    ciphertext: encrypted.ciphertext.toString("hex"),
    iv: encrypted.iv.toString("hex"),
    authTag: encrypted.authTag.toString("hex"),
    wrappedKey: wrapped.wrappedKey.toString("hex"),
    kekIv: wrapped.iv.toString("hex"),
    kekAuthTag: wrapped.authTag.toString("hex"),
    keyId: wrapped.keyId,
  };
  return JSON.stringify(stored);
}

export function decryptAiPayload<T>(
  storedJson: string,
  kek: Buffer,
  ids: { workspaceId: string; expenseId: string; analysisId: string },
): T {
  const stored = JSON.parse(storedJson) as EncryptedAiPayload;
  const dek = unwrapKey(
    {
      wrappedKey: Buffer.from(stored.wrappedKey, "hex"),
      iv: Buffer.from(stored.kekIv, "hex"),
      authTag: Buffer.from(stored.kekAuthTag, "hex"),
      keyId: stored.keyId,
    },
    kek,
  );
  const plaintext = decryptEvidence(
    Buffer.from(stored.ciphertext, "hex"),
    dek,
    Buffer.from(stored.iv, "hex"),
    Buffer.from(stored.authTag, "hex"),
    context(ids.workspaceId, ids.expenseId, ids.analysisId, stored.version),
  );
  return JSON.parse(plaintext.toString("utf8")) as T;
}
