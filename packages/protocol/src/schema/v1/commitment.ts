import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  stringToBytes,
} from "viem";

import {
  canonicalizeJson,
  validateCanonicalEvidenceManifestV1,
  validateCanonicalExpenseV1,
} from "./canonicalize.js";
import {
  CLARIO_EXPENSE_V1_DOMAIN,
  type CanonicalEvidenceManifestV1,
  type CanonicalExpenseV1,
} from "./types.js";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

export interface ExpenseCommitmentParamsV1 {
  readonly monadChainId: bigint | number;
  readonly registryAddress: `0x${string}`;
  readonly workspaceId: `0x${string}`;
  readonly expenseId: `0x${string}`;
  readonly version: number;
  readonly privateRecordHash: `0x${string}`;
  readonly evidenceManifestHash: `0x${string}`;
  readonly salt: `0x${string}`;
}

/**
 * Validates and hashes a canonical expense record v1 to produce privateRecordHash.
 */
export function hashCanonicalExpenseV1(
  expense: CanonicalExpenseV1,
): `0x${string}` {
  const validated = validateCanonicalExpenseV1(expense);
  const canonicalJson = canonicalizeJson(validated);
  return keccak256(stringToBytes(canonicalJson));
}

/**
 * Validates and hashes a canonical evidence manifest v1 to produce evidenceManifestHash.
 */
export function hashCanonicalEvidenceManifestV1(
  manifest: CanonicalEvidenceManifestV1,
): `0x${string}` {
  const validated = validateCanonicalEvidenceManifestV1(manifest);
  const canonicalJson = canonicalizeJson(validated);
  return keccak256(stringToBytes(canonicalJson));
}

/**
 * Validates parameters and constructs the canonical versionCommitment for Monad.
 *
 * commitment = keccak256(abi.encode(
 *     CLARIO_EXPENSE_V1_DOMAIN,
 *     monadChainId,
 *     registryAddress,
 *     workspaceId,
 *     expenseId,
 *     version,
 *     privateRecordHash,
 *     evidenceManifestHash,
 *     random32ByteSalt
 * ))
 */
export function computeExpenseCommitmentV1(
  params: ExpenseCommitmentParamsV1,
): `0x${string}` {
  const chainIdBig = BigInt(params.monadChainId);
  if (chainIdBig <= 0n) {
    throw new Error("monadChainId must be a positive integer.");
  }

  if (
    typeof params.registryAddress !== "string" ||
    !ADDRESS_REGEX.test(params.registryAddress)
  ) {
    throw new Error(
      "registryAddress must be a 0x-prefixed 40-character hex address.",
    );
  }

  if (
    typeof params.workspaceId !== "string" ||
    !BYTES32_REGEX.test(params.workspaceId)
  ) {
    throw new Error(
      "workspaceId must be a 0x-prefixed 64-character hex string.",
    );
  }

  if (
    typeof params.expenseId !== "string" ||
    !BYTES32_REGEX.test(params.expenseId)
  ) {
    throw new Error("expenseId must be a 0x-prefixed 64-character hex string.");
  }

  if (
    typeof params.version !== "number" ||
    !Number.isInteger(params.version) ||
    params.version < 1
  ) {
    throw new Error("version must be a positive integer.");
  }

  if (
    typeof params.privateRecordHash !== "string" ||
    !BYTES32_REGEX.test(params.privateRecordHash)
  ) {
    throw new Error(
      "privateRecordHash must be a 0x-prefixed 64-character hex string.",
    );
  }

  if (
    typeof params.evidenceManifestHash !== "string" ||
    !BYTES32_REGEX.test(params.evidenceManifestHash)
  ) {
    throw new Error(
      "evidenceManifestHash must be a 0x-prefixed 64-character hex string.",
    );
  }

  if (typeof params.salt !== "string" || !BYTES32_REGEX.test(params.salt)) {
    throw new Error(
      "salt must be a 0x-prefixed 64-character hex string (32 bytes).",
    );
  }

  const normalizedRegistry = getAddress(params.registryAddress);
  const normalizedWorkspaceId =
    params.workspaceId.toLowerCase() as `0x${string}`;
  const normalizedExpenseId = params.expenseId.toLowerCase() as `0x${string}`;
  const normalizedPrivateHash =
    params.privateRecordHash.toLowerCase() as `0x${string}`;
  const normalizedEvidenceHash =
    params.evidenceManifestHash.toLowerCase() as `0x${string}`;
  const normalizedSalt = params.salt.toLowerCase() as `0x${string}`;

  const encoded = encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "uint256" },
      { type: "address" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint32" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      CLARIO_EXPENSE_V1_DOMAIN,
      chainIdBig,
      normalizedRegistry,
      normalizedWorkspaceId,
      normalizedExpenseId,
      params.version,
      normalizedPrivateHash,
      normalizedEvidenceHash,
      normalizedSalt,
    ],
  );

  return keccak256(encoded);
}

/**
 * Verifies a candidate commitment against expected parameters.
 */
export function verifyExpenseCommitmentV1(
  params: ExpenseCommitmentParamsV1,
  expectedCommitment: `0x${string}`,
): boolean {
  if (
    typeof expectedCommitment !== "string" ||
    !BYTES32_REGEX.test(expectedCommitment)
  ) {
    return false;
  }
  const computed = computeExpenseCommitmentV1(params);
  return computed.toLowerCase() === expectedCommitment.toLowerCase();
}
