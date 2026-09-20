import {
  type Bytes32,
  type ChainId,
  type CommitmentHash,
  type EvmAddress,
  type ExpenseId,
  type ExpenseVersion,
  type PolicyVersion,
  type WorkspaceId,
  parseBytes32,
  parseChainId,
  parseCommitmentHash,
  parseEvmAddress,
  parseExpenseId,
  parseExpenseVersion,
  parsePolicyVersion,
  parseWorkspaceId,
} from "./identifiers.js";
import { OnchainDecision, parseOnchainDecision } from "./lifecycle.js";
import { ProtocolError } from "./errors.js";

export const CLARIO_APPROVAL_PRIMARY_TYPE = "ClarioApproval" as const;
export const CLARIO_APPROVAL_DOMAIN_NAME = "ClarioApproval" as const;
export const CLARIO_APPROVAL_DOMAIN_VERSION = "1" as const;

export const CLARIO_APPROVAL_EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
] as const;

export const CLARIO_APPROVAL_EIP712_MESSAGE_TYPE = [
  { name: "workspaceId", type: "bytes32" },
  { name: "expenseId", type: "bytes32" },
  { name: "version", type: "uint32" },
  { name: "commitment", type: "bytes32" },
  { name: "decision", type: "uint8" },
  { name: "reasonCommitment", type: "bytes32" },
  { name: "policyVersion", type: "uint32" },
  { name: "nonce", type: "uint256" },
  { name: "expiration", type: "uint256" },
] as const;

export const CLARIO_APPROVAL_EIP712_TYPES = {
  EIP712Domain: CLARIO_APPROVAL_EIP712_DOMAIN_TYPE,
  ClarioApproval: CLARIO_APPROVAL_EIP712_MESSAGE_TYPE,
} as const;

/**
 * EIP-712 Domain object for Clario approval authorizations.
 */
export interface ClarioApprovalDomain {
  readonly name: typeof CLARIO_APPROVAL_DOMAIN_NAME;
  readonly version: typeof CLARIO_APPROVAL_DOMAIN_VERSION;
  readonly chainId: ChainId;
  readonly verifyingContract: EvmAddress;
}

/**
 * EIP-712 message payload for reviewer approval / rejection / changes request.
 * See architecture.md §7.3.
 */
export interface ClarioApprovalMessage {
  readonly workspaceId: WorkspaceId;
  readonly expenseId: ExpenseId;
  readonly version: ExpenseVersion;
  readonly commitment: CommitmentHash;
  readonly decision: OnchainDecision;
  readonly reasonCommitment: Bytes32;
  readonly policyVersion: PolicyVersion;
  readonly nonce: bigint;
  readonly expiration: bigint;
}

/**
 * Full EIP-712 Typed Data envelope.
 */
export interface ClarioApprovalTypedData {
  readonly domain: ClarioApprovalDomain;
  readonly types: typeof CLARIO_APPROVAL_EIP712_TYPES;
  readonly primaryType: typeof CLARIO_APPROVAL_PRIMARY_TYPE;
  readonly message: ClarioApprovalMessage;
}

const MAX_UINT256 = (1n << 256n) - 1n;

function parseUint256(val: unknown, fieldName: string): bigint {
  let bi: bigint;
  if (typeof val === "bigint") {
    bi = val;
  } else if (typeof val === "number") {
    if (!Number.isInteger(val) || val < 0) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Invalid ${fieldName}: must be a non-negative integer.`,
      });
    }
    bi = BigInt(val);
  } else if (typeof val === "string") {
    try {
      bi = BigInt(val);
    } catch {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Invalid ${fieldName}: must be a valid integer string.`,
      });
    }
  } else {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid ${fieldName}: expected bigint, number, or string.`,
    });
  }

  if (bi < 0n || bi > MAX_UINT256) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid ${fieldName}: value out of uint256 bounds.`,
    });
  }
  return bi;
}

/**
 * Parses and validates a Clario approval domain object.
 */
export function parseClarioApprovalDomain(
  input: unknown,
): ClarioApprovalDomain {
  if (typeof input !== "object" || input === null) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Approval domain must be an object.",
    });
  }

  const { name, version, chainId, verifyingContract } = input as Record<
    string,
    unknown
  >;

  if (name !== CLARIO_APPROVAL_DOMAIN_NAME) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid domain name: expected '${CLARIO_APPROVAL_DOMAIN_NAME}', got '${String(name)}'.`,
    });
  }

  if (version !== CLARIO_APPROVAL_DOMAIN_VERSION) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid domain version: expected '${CLARIO_APPROVAL_DOMAIN_VERSION}', got '${String(version)}'.`,
    });
  }

  let parsedChainId: ChainId;
  try {
    parsedChainId = parseChainId(chainId);
  } catch (err) {
    throw new ProtocolError("UNSUPPORTED_CHAIN", {
      message: "Invalid domain chainId: must be a positive integer.",
      cause: err,
    });
  }

  let parsedVerifyingContract: EvmAddress;
  try {
    parsedVerifyingContract = parseEvmAddress(verifyingContract);
  } catch (err) {
    throw new ProtocolError("INVALID_IDENTIFIER", {
      message: "Invalid domain verifyingContract: must be a valid EVM address.",
      cause: err,
    });
  }

  return {
    name: CLARIO_APPROVAL_DOMAIN_NAME,
    version: CLARIO_APPROVAL_DOMAIN_VERSION,
    chainId: parsedChainId,
    verifyingContract: parsedVerifyingContract,
  };
}

/**
 * Parses and validates a Clario approval message payload.
 */
export function parseClarioApprovalMessage(
  input: unknown,
): ClarioApprovalMessage {
  if (typeof input !== "object" || input === null) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Approval message must be an object.",
    });
  }

  const msg = input as Record<string, unknown>;

  let workspaceId: WorkspaceId;
  let expenseId: ExpenseId;
  let version: ExpenseVersion;
  let commitment: CommitmentHash;
  let decision: OnchainDecision;
  let reasonCommitment: Bytes32;
  let policyVersion: PolicyVersion;

  try {
    workspaceId = parseWorkspaceId(msg.workspaceId);
    expenseId = parseExpenseId(msg.expenseId);
    version = parseExpenseVersion(msg.version);
    commitment = parseCommitmentHash(msg.commitment);
    decision = parseOnchainDecision(msg.decision);
    reasonCommitment = parseBytes32(msg.reasonCommitment);
    policyVersion = parsePolicyVersion(msg.policyVersion);
  } catch (err) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Invalid identifier or field in approval message.",
      cause: err,
    });
  }

  if (decision === OnchainDecision.None) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Approval decision cannot be None.",
    });
  }

  const nonce = parseUint256(msg.nonce, "nonce");
  const expiration = parseUint256(msg.expiration, "expiration");

  if (expiration === 0n) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Approval expiration must be greater than zero.",
    });
  }

  return {
    workspaceId,
    expenseId,
    version,
    commitment,
    decision,
    reasonCommitment,
    policyVersion,
    nonce,
    expiration,
  };
}

/**
 * Validates a complete EIP-712 typed data structure.
 */
export function validateClarioApprovalTypedData(
  input: unknown,
): ClarioApprovalTypedData {
  if (typeof input !== "object" || input === null) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: "Approval typed data must be an object.",
    });
  }

  const { domain, primaryType, message } = input as Record<string, unknown>;

  if (primaryType !== CLARIO_APPROVAL_PRIMARY_TYPE) {
    throw new ProtocolError("INVALID_TYPED_DATA", {
      message: `Invalid primaryType: expected '${CLARIO_APPROVAL_PRIMARY_TYPE}', got '${String(primaryType)}'.`,
    });
  }

  const parsedDomain = parseClarioApprovalDomain(domain);
  const parsedMessage = parseClarioApprovalMessage(message);

  return {
    domain: parsedDomain,
    types: CLARIO_APPROVAL_EIP712_TYPES,
    primaryType: CLARIO_APPROVAL_PRIMARY_TYPE,
    message: parsedMessage,
  };
}

/**
 * Checks whether an approval message has expired against a reference timestamp (in seconds).
 */
export function isApprovalExpired(
  message: ClarioApprovalMessage,
  currentTimestampSec: bigint | number,
): boolean {
  const current =
    typeof currentTimestampSec === "bigint"
      ? currentTimestampSec
      : BigInt(currentTimestampSec);
  return current >= message.expiration;
}
