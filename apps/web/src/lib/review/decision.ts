import {
  type Abi,
  encodeFunctionData,
  keccak256,
  stringToBytes,
  isAddress,
  isHex,
} from "viem";
import {
  ProtocolError,
  OnchainDecision,
  validateClarioApprovalTypedData,
  type ClarioApprovalTypedData,
  type ClarioApprovalMessage,
  type WorkspaceId,
  type ExpenseId,
  type ExpenseVersion,
  type CommitmentHash,
  type Bytes32,
  type PolicyVersion,
  type ChainId,
  type EvmAddress,
} from "@clario/protocol";

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const DECISION_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordDecision",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "commitment", type: "bytes32" },
      { name: "decision", type: "uint8" },
      { name: "reasonCommitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordDecisionBySig",
    inputs: [
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "workspaceId", type: "bytes32" },
          { name: "expenseId", type: "bytes32" },
          { name: "version", type: "uint32" },
          { name: "commitment", type: "bytes32" },
          { name: "decision", type: "uint8" },
          { name: "reasonCommitment", type: "bytes32" },
          { name: "policyVersion", type: "uint32" },
          { name: "nonce", type: "uint256" },
          { name: "expiration", type: "uint256" },
        ],
      },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isApprovalValid",
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
    name: "getDecision",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasDecision",
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
    name: "getReviewer",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const satisfies Abi;

export type DecisionType = "approve" | "reject" | "request_changes";

/**
 * Maps application decision string to OnchainDecision enum.
 */
export function mapDecisionTypeToOnchain(
  decisionType: DecisionType,
): OnchainDecision {
  switch (decisionType) {
    case "approve":
      return OnchainDecision.Approve;
    case "reject":
      return OnchainDecision.Reject;
    case "request_changes":
      return OnchainDecision.RequestChanges;
  }
}

/**
 * Maps OnchainDecision enum back to application decision string.
 */
export function mapOnchainDecisionToType(
  decision: OnchainDecision | number,
): DecisionType | "none" {
  switch (decision) {
    case OnchainDecision.Approve:
      return "approve";
    case OnchainDecision.Reject:
      return "reject";
    case OnchainDecision.RequestChanges:
      return "request_changes";
    default:
      return "none";
  }
}

/**
 * Computes deterministic reason commitment for decisions.
 * Rejections and change requests require an offchain reason whose hash is anchored onchain.
 */
export function computeReasonCommitment(params: {
  decision: DecisionType;
  reason?: string | undefined | null;
}): `0x${string}` {
  const { decision, reason } = params;
  const trimmed = reason ? reason.trim() : "";

  if (decision === "reject" || decision === "request_changes") {
    if (!trimmed) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `A reason note is strictly required when recording '${decision}'.`,
      });
    }
    return keccak256(stringToBytes(trimmed));
  }

  // For approve, reason is optional
  if (trimmed) {
    return keccak256(stringToBytes(trimmed));
  }
  return ZERO_BYTES32;
}

/**
 * Helper to ensure an identifier is a 32-byte hex string (0x-prefixed 64 hex chars).
 * If a plaintext string is passed (e.g. "ws_finance"), hashes it deterministically.
 */
export function normalizeBytes32(val: string): `0x${string}` {
  if (isHex(val) && val.length === 66) {
    return val.toLowerCase() as `0x${string}`;
  }
  return keccak256(stringToBytes(val));
}

/**
 * Encodes direct onchain call calldata for ClarioDecisionRegistryV1.recordDecision.
 */
export function encodeRecordDecisionCalldata(params: {
  workspaceId: string;
  expenseId: string;
  version: number;
  commitment: `0x${string}`;
  decision: DecisionType;
  reasonCommitment?: `0x${string}` | undefined;
  reason?: string | undefined;
}): `0x${string}` {
  const { version, commitment, decision } = params;

  const workspaceIdHex = normalizeBytes32(params.workspaceId);
  const expenseIdHex = normalizeBytes32(params.expenseId);

  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid version: must be an integer >= 1.",
    });
  }

  if (!isHex(commitment) || commitment.length !== 66) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid commitment: must be a 32-byte hex string.",
    });
  }

  const reasonCommitment =
    params.reasonCommitment ??
    computeReasonCommitment({ decision, reason: params.reason });

  const onchainDecision = mapDecisionTypeToOnchain(decision);

  return encodeFunctionData({
    abi: DECISION_REGISTRY_ABI,
    functionName: "recordDecision",
    args: [
      workspaceIdHex,
      expenseIdHex,
      version,
      commitment,
      onchainDecision,
      reasonCommitment,
    ],
  });
}

export interface ApprovalTypedDataParams {
  monadChainId?: number | undefined;
  chainId?: number | undefined;
  registryAddress?: `0x${string}` | undefined;
  verifyingContract?: `0x${string}` | undefined;
  workspaceId: string;
  expenseId: string;
  version: number | bigint;
  commitment: `0x${string}`;
  decision: DecisionType;
  reviewer?: `0x${string}` | undefined;
  reasonCommitment?: `0x${string}` | undefined;
  reason?: string | undefined;
  policyVersion: number | bigint;
  nonce: bigint | number | string;
  expirationTimestampSec?: bigint | number | string | undefined;
  deadline?: bigint | number | string | undefined;
}

/**
 * Builds and validates an EIP-712 Typed Data envelope for offchain reviewer signing.
 */
export function buildClarioApprovalTypedData(
  params: ApprovalTypedDataParams,
): ClarioApprovalTypedData {
  const chainId = params.monadChainId ?? params.chainId ?? 31337;
  const contractAddress = params.registryAddress ?? params.verifyingContract;

  if (!contractAddress || !isAddress(contractAddress)) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid registryAddress: must be an EVM address.",
    });
  }

  const workspaceIdHex = normalizeBytes32(params.workspaceId);
  const expenseIdHex = normalizeBytes32(params.expenseId);

  const reasonCommitmentHex =
    params.reasonCommitment ??
    computeReasonCommitment({
      decision: params.decision,
      reason: params.reason,
    });

  const onchainDecision = mapDecisionTypeToOnchain(params.decision);

  const expiration =
    params.expirationTimestampSec ??
    params.deadline ??
    Math.floor(Date.now() / 1000) + 3600;

  const rawMessage: ClarioApprovalMessage = {
    workspaceId: workspaceIdHex as WorkspaceId,
    expenseId: expenseIdHex as ExpenseId,
    version: Number(params.version) as ExpenseVersion,
    commitment: params.commitment as CommitmentHash,
    decision: onchainDecision,
    reasonCommitment: reasonCommitmentHex as Bytes32,
    policyVersion: Number(params.policyVersion) as PolicyVersion,
    nonce: BigInt(params.nonce),
    expiration: BigInt(expiration),
  };

  const rawEnvelope = {
    domain: {
      name: "ClarioApproval",
      version: "1",
      chainId: chainId as ChainId,
      verifyingContract: contractAddress.toLowerCase() as EvmAddress,
    },
    primaryType: "ClarioApproval",
    message: rawMessage,
  };

  return validateClarioApprovalTypedData(rawEnvelope);
}
