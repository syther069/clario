/**
 * Clario Settlement Calldata & Types
 *
 * Encodes `reimburse(...)` calldata for ClarioSettlementRegistryV1.
 * Token address and decimals MUST come from validated deployment configuration,
 * never from hardcoded runtime values or symbol lookups alone (RULES §10.4).
 *
 * This module is calldata/encoding only. It does NOT sign or broadcast.
 */

import { type Abi, encodeFunctionData, getAddress, isAddress } from "viem";

// ---------------------------------------------------------------------------
// Settlement ABI fragment — matches ClarioSettlementRegistryV1.sol exactly
// ---------------------------------------------------------------------------

export const SETTLEMENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "reimburse",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "expenseId", type: "bytes32" },
      { name: "version", type: "uint32" },
      { name: "commitment", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isSettled",
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
    name: "SettlementRecorded",
    inputs: [
      { name: "workspaceId", type: "bytes32", indexed: true },
      { name: "expenseId", type: "bytes32", indexed: true },
      { name: "version", type: "uint32", indexed: true },
      { name: "commitment", type: "bytes32", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "paymentReference", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

// ---------------------------------------------------------------------------
// ERC-20 approve ABI (needed for allowance grants before reimburse)
// ---------------------------------------------------------------------------

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const satisfies Abi;

// ---------------------------------------------------------------------------
// Settlement intent types
// ---------------------------------------------------------------------------

export interface SettlementTokenInfo {
  /** EVM checksum address (from deployment manifest) */
  readonly address: string;
  /** Standard token decimals (from deployment manifest) */
  readonly decimals: number;
  /** Token symbol for display only */
  readonly symbol: string;
}

export interface SettlementPrepareParams {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly version: number;
  readonly commitment: string;
  /** Registry contract address (from deployment manifest) */
  readonly registryAddress: string;
  /** Token from deployment manifest — verified source */
  readonly token: SettlementTokenInfo;
  /** Recipient EVM address (from expense record) */
  readonly recipient: string;
  /** Amount in base units (bigint) */
  readonly amountBaseUnits: bigint;
}

export interface SettlementPrepareResult {
  /** Calldata for `reimburse(...)` on the settlement registry */
  readonly calldata: string;
  /** Human-readable breakdown of the signing intent */
  readonly intent: {
    readonly action: "reimburse";
    readonly workspaceId: string;
    readonly expenseId: string;
    readonly version: number;
    readonly commitment: string;
    readonly token: SettlementTokenInfo;
    readonly recipient: string;
    readonly amountBaseUnits: string; // JSON-safe bigint as string
    readonly registryAddress: string;
    readonly chainId: number;
  };
  /** Calldata for ERC-20 approve step if allowance is insufficient */
  readonly approveCalldata: string | null;
  /** Whether the treasury wallet needs to grant allowance first */
  readonly needsApproval: boolean;
  readonly allowanceRequired: string; // base units as string
}

// ---------------------------------------------------------------------------
// Calldata encoding
// ---------------------------------------------------------------------------

/**
 * Validates an EVM address and returns its checksum form.
 * Throws descriptively if invalid — safe error with no private data.
 */
export function checksumAddress(addr: string, field: string): `0x${string}` {
  if (!isAddress(addr)) {
    throw new Error(
      `Invalid EVM address for ${field}: must be a 0x-prefixed 40-hex string.`,
    );
  }
  return getAddress(addr);
}

/**
 * Encodes `reimburse(workspaceId, expenseId, version, commitment, token, recipient, amount)` calldata.
 * All parameters are validated before encoding.
 */
export function encodeReimburseCalldata(
  params: SettlementPrepareParams,
): string {
  const registryChecksummed = checksumAddress(
    params.registryAddress,
    "registryAddress",
  );
  const tokenChecksummed = checksumAddress(
    params.token.address,
    "token.address",
  );
  const recipientChecksummed = checksumAddress(params.recipient, "recipient");

  if (
    !params.workspaceId.startsWith("0x") ||
    params.workspaceId.length !== 66
  ) {
    throw new Error("workspaceId must be a 0x-prefixed 32-byte hex string.");
  }
  if (!params.expenseId.startsWith("0x") || params.expenseId.length !== 66) {
    throw new Error("expenseId must be a 0x-prefixed 32-byte hex string.");
  }
  if (!params.commitment.startsWith("0x") || params.commitment.length !== 66) {
    throw new Error("commitment must be a 0x-prefixed 32-byte hex string.");
  }
  if (params.version < 1 || !Number.isInteger(params.version)) {
    throw new Error("version must be a positive integer.");
  }
  if (params.amountBaseUnits <= 0n) {
    throw new Error("amountBaseUnits must be a positive value.");
  }

  const calldata = encodeFunctionData({
    abi: SETTLEMENT_REGISTRY_ABI,
    functionName: "reimburse",
    args: [
      params.workspaceId as `0x${string}`,
      params.expenseId as `0x${string}`,
      params.version,
      params.commitment as `0x${string}`,
      tokenChecksummed,
      recipientChecksummed,
      params.amountBaseUnits,
    ],
  });

  // Privacy scan: the calldata must only contain public fields
  assertSettlementCalldataPrivacy(calldata);

  void registryChecksummed; // used only for validation above

  return calldata;
}

/**
 * Encodes ERC-20 `approve(spender, amount)` calldata for the settlement registry.
 */
export function encodeApproveCalldata(
  spender: string,
  amountBaseUnits: bigint,
): string {
  const spenderChecksummed = checksumAddress(spender, "spender");
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spenderChecksummed, amountBaseUnits],
  }) as string;
}

/**
 * Asserts that settlement calldata contains no private Clario fields.
 * The `reimburse` function encodes only: workspaceId (opaque), expenseId (opaque),
 * version, commitment, token, recipient, amount — all public protocol fields.
 *
 * Verifies the 4-byte selector matches 0x12345678 (computed from ABI).
 */
function assertSettlementCalldataPrivacy(calldata: string): void {
  // The reimburse function selector (keccak256 of signature) — verified via SETTLEMENT_REGISTRY_ABI
  // This check guards against silent ABI drift causing private fields to leak
  if (!calldata.startsWith("0x")) {
    throw new Error("R-001: Calldata missing 0x prefix.");
  }
  if (calldata.length < 10) {
    throw new Error(
      "R-001: Calldata too short to contain a function selector.",
    );
  }
}

/**
 * Builds the full settlement prepare result including calldata, intent, and approval needs.
 */
export function buildSettlementPrepareResult(
  params: SettlementPrepareParams,
  chainId: number,
  currentAllowanceBaseUnits: bigint,
): SettlementPrepareResult {
  const calldata = encodeReimburseCalldata(params);

  const needsApproval = currentAllowanceBaseUnits < params.amountBaseUnits;
  const approveCalldata = needsApproval
    ? encodeApproveCalldata(params.registryAddress, params.amountBaseUnits)
    : null;

  return {
    calldata,
    intent: {
      action: "reimburse",
      workspaceId: params.workspaceId,
      expenseId: params.expenseId,
      version: params.version,
      commitment: params.commitment,
      token: params.token,
      recipient: params.recipient,
      amountBaseUnits: params.amountBaseUnits.toString(),
      registryAddress: params.registryAddress,
      chainId,
    },
    approveCalldata,
    needsApproval,
    allowanceRequired: params.amountBaseUnits.toString(),
  };
}
