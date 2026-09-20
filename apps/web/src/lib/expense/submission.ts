import {
  type Abi,
  encodeFunctionData,
  getAddress,
  isAddress,
  type Hex,
} from "viem";
import {
  type CanonicalEvidenceManifestV1,
  type CanonicalExpenseV1,
  type EvidenceEntryV1,
  hashCanonicalEvidenceManifestV1,
  hashCanonicalExpenseV1,
  validateCanonicalEvidenceManifestV1,
  validateCanonicalExpenseV1,
  ProtocolError,
} from "@clario/protocol";
import type { ExpenseDraftPayload } from "./types";
import { parseBaseUnits, findTokenAsset } from "./amount";

export const EXPENSE_REGISTRY_ABI = [
  {
    type: "function",
    name: "submitVersion",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "commitment", type: "bytes32" },
      { name: "previousCommitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCurrentVersion",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentCommitment",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCommitment",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isCurrentVersion",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isVersionSuperseded",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ExpenseVersionSubmitted",
    inputs: [
      { name: "workspaceId", type: "bytes32", indexed: true },
      { name: "expenseId", type: "bytes32", indexed: true },
      { name: "version", type: "uint32", indexed: true },
      { name: "commitment", type: "bytes32", indexed: false },
      { name: "submitter", type: "address", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ExpenseVersionSuperseded",
    inputs: [
      { name: "workspaceId", type: "bytes32", indexed: true },
      { name: "expenseId", type: "bytes32", indexed: true },
      { name: "oldVersion", type: "uint32", indexed: false },
      { name: "newVersion", type: "uint32", indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const SUBMISSION_DISCLAIMER =
  "Only the cryptographic commitment and public identifiers are recorded on Monad. Business purpose, merchant, amount, recipient, and evidence files remain private offchain and envelope-encrypted." as const;

export interface RawEvidenceItem {
  evidenceId: string;
  mimeType: string;
  byteLength: number;
  sha256Hash: string;
  ciphertextHash?: string | undefined;
  createdAt: string;
}

export interface ExpenseSubmissionIntent {
  readonly to: `0x${string}`;
  readonly data: `0x${string}`;
  readonly chainId: number;
  readonly functionName: "submitVersion";
  readonly description: string;
  readonly workspaceId: `0x${string}`;
  readonly expenseId: `0x${string}`;
  readonly version: number;
  readonly commitment: `0x${string}`;
  readonly previousCommitment: `0x${string}`;
  readonly privateRecordHash: `0x${string}`;
  readonly evidenceManifestHash: `0x${string}`;
}

export interface ExpenseSubmissionPreview {
  readonly intent: ExpenseSubmissionIntent;
  readonly publicFields: {
    readonly workspaceId: string;
    readonly expenseId: string;
    readonly version: number;
    readonly commitment: string;
    readonly previousCommitment: string;
    readonly submitter: string;
  };
  readonly privateFields: {
    readonly title: string;
    readonly businessPurpose: string;
    readonly category: string;
    readonly project: string;
    readonly merchant: string;
    readonly expenseDate: string;
    readonly claimAmount: string;
    readonly claimAsset: string;
    readonly recipient: string;
    readonly evidenceCount: number;
    readonly tags: readonly string[];
  };
  readonly disclaimer: string;
}

/**
 * Builds and validates a CanonicalEvidenceManifestV1 strictly sorted by evidenceId.
 */
export function buildCanonicalEvidenceManifest(params: {
  evidenceItems: RawEvidenceItem[];
  previousManifestHash?: `0x${string}` | null | undefined;
}): {
  manifest: CanonicalEvidenceManifestV1;
  manifestHash: `0x${string}`;
} {
  const allowedMime = new Set(["application/pdf", "image/png", "image/jpeg"]);

  const entries: EvidenceEntryV1[] = params.evidenceItems.map((item) => {
    if (!allowedMime.has(item.mimeType)) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Unsupported evidence MIME type: ${item.mimeType}. Allowed: application/pdf, image/png, image/jpeg.`,
      });
    }

    const plaintextHash = (
      item.sha256Hash.startsWith("0x")
        ? item.sha256Hash.toLowerCase()
        : `0x${item.sha256Hash.toLowerCase()}`
    ) as `0x${string}`;

    const ciphertextHash = (
      item.ciphertextHash && item.ciphertextHash.startsWith("0x")
        ? item.ciphertextHash.toLowerCase()
        : plaintextHash
    ) as `0x${string}`;

    // Normalize ISO-8601 timestamp (YYYY-MM-DDTHH:MM:SSZ)
    const dateObj = new Date(item.createdAt);
    const uploadedAt = dateObj.toISOString().slice(0, 19) + "Z";

    return {
      evidenceId: item.evidenceId,
      mimeType: item.mimeType as "application/pdf" | "image/png" | "image/jpeg",
      sizeBytes: item.byteLength,
      plaintextHash,
      ciphertextHash,
      uploadedAt,
    };
  });

  // Strict ascending sort by evidenceId
  entries.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));

  const manifest: CanonicalEvidenceManifestV1 = {
    manifestVersion: 1,
    entries,
    previousManifestHash: params.previousManifestHash ?? null,
  };

  validateCanonicalEvidenceManifestV1(manifest);
  const manifestHash = hashCanonicalEvidenceManifestV1(manifest);

  return { manifest, manifestHash };
}

/**
 * Builds and validates a CanonicalExpenseV1 from draft payload and submitter context.
 */
export function buildCanonicalExpenseRecord(params: {
  workspaceId: `0x${string}`;
  expenseId: `0x${string}`;
  version: number;
  payload: ExpenseDraftPayload;
  evidenceManifestHash: `0x${string}`;
  submittedBy: `0x${string}`;
  submittedAt?: string | undefined;
}): {
  canonicalExpense: CanonicalExpenseV1;
  privateRecordHash: `0x${string}`;
} {
  const {
    workspaceId,
    expenseId,
    version,
    payload,
    evidenceManifestHash,
    submittedBy,
  } = params;

  if (!isAddress(submittedBy)) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid submitter address.",
    });
  }
  const normalizedSubmitter = getAddress(
    submittedBy,
  ).toLowerCase() as `0x${string}`;

  if (!isAddress(payload.claimAsset)) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid claimAsset address.",
    });
  }
  const normalizedClaimAsset = getAddress(
    payload.claimAsset,
  ).toLowerCase() as `0x${string}`;

  if (!isAddress(payload.recipient)) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid recipient address.",
    });
  }
  const normalizedRecipient = getAddress(
    payload.recipient,
  ).toLowerCase() as `0x${string}`;

  // Parse base units for amount
  const tokenMeta = findTokenAsset(payload.claimAsset);
  const decimals = tokenMeta?.decimals ?? 6;
  let claimAmountBaseUnits: string;
  try {
    claimAmountBaseUnits = parseBaseUnits(
      payload.claimAmount,
      decimals,
    ).toString();
  } catch {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid claimAmount '${payload.claimAmount}' for asset with ${decimals} decimals.`,
    });
  }

  // Format submitted timestamp (YYYY-MM-DDTHH:MM:SSZ)
  const submittedAt =
    params.submittedAt ?? new Date().toISOString().slice(0, 19) + "Z";

  // Deduplicate and lexicographically sort tags
  const rawTags = (payload.tags ?? [])
    .map((t) => t.trim().normalize("NFC"))
    .filter((t) => t.length > 0);
  const sortedTags = [...new Set(rawTags)].sort();

  const sourceChainId =
    payload.paymentSource === "manual" ? null : (payload.sourceChainId ?? null);
  const sourceTransactionHash =
    payload.paymentSource === "manual" || !payload.sourceTransactionHash
      ? null
      : (payload.sourceTransactionHash.toLowerCase() as `0x${string}`);

  const canonical: CanonicalExpenseV1 = {
    schemaVersion: 1,
    workspaceId: workspaceId.toLowerCase() as `0x${string}`,
    expenseId: expenseId.toLowerCase() as `0x${string}`,
    version,
    title: payload.title.trim().normalize("NFC"),
    businessPurpose: payload.businessPurpose.trim().normalize("NFC"),
    category: payload.category.trim().normalize("NFC"),
    project: payload.project.trim().normalize("NFC"),
    merchant: payload.merchant.trim().normalize("NFC"),
    expenseDate: payload.expenseDate,
    claimAmount: claimAmountBaseUnits,
    claimAsset: normalizedClaimAsset,
    recipient: normalizedRecipient,
    paymentSource: payload.paymentSource,
    sourceChainId,
    sourceTransactionHash,
    evidenceManifestHash: evidenceManifestHash.toLowerCase() as `0x${string}`,
    submittedBy: normalizedSubmitter,
    submittedAt,
    client: payload.client ? payload.client.trim().normalize("NFC") : null,
    invoiceNumber: payload.invoiceNumber
      ? payload.invoiceNumber.trim().normalize("NFC")
      : null,
    location: payload.location
      ? payload.location.trim().normalize("NFC")
      : null,
    notes: payload.notes ? payload.notes.trim().normalize("NFC") : null,
    tags: sortedTags,
  };

  validateCanonicalExpenseV1(canonical);
  const privateRecordHash = hashCanonicalExpenseV1(canonical);

  return { canonicalExpense: canonical, privateRecordHash };
}

/**
 * Encodes submitVersion calldata for ClarioExpenseRegistryV1.
 */
export function encodeSubmitVersionCalldata(params: {
  workspaceId: `0x${string}`;
  expenseId: `0x${string}`;
  version: number;
  commitment: `0x${string}`;
  previousCommitment: `0x${string}`;
}): Hex {
  return encodeFunctionData({
    abi: EXPENSE_REGISTRY_ABI,
    functionName: "submitVersion",
    args: [
      params.workspaceId,
      params.expenseId,
      params.version,
      params.commitment,
      params.previousCommitment,
    ],
  });
}

/**
 * Automated Calldata Privacy Scanner.
 * Asserts that confidential strings never appear in the encoded calldata hex.
 */
export function assertCalldataPrivacy(
  calldata: string,
  confidentialStrings: string[],
): void {
  const lowerCalldata = calldata.toLowerCase();

  for (const item of confidentialStrings) {
    const trimmed = item.trim();
    if (trimmed.length < 3) continue;

    // Check ASCII/UTF-8 hex encoding of the sensitive string
    const hexRep = Buffer.from(trimmed, "utf8").toString("hex").toLowerCase();
    if (lowerCalldata.includes(hexRep)) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Privacy leak violation: sensitive field content detected in calldata hex: '${trimmed.slice(0, 5)}...'`,
      });
    }
  }
}
