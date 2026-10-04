import {
  createPublicClient,
  defineChain,
  http,
  keccak256,
  stringToBytes,
  type Address,
} from "viem";
import type {
  Transaction,
  CanonicalReceiptBundle,
  CanonicalReceiptTransaction,
} from "@/lib/supabase/types";

// Official Monad Testnet configuration (Chain ID: 10143)
export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC =
  process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC ||
  (process.env.ALCHEMY_API_KEY
    ? `https://monad-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://testnet-rpc.monad.xyz");
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

// Default or configured registry contract address (Monad Testnet official deployment)
export const CLARIO_REGISTRY_ADDRESS: Address = (process.env
  .NEXT_PUBLIC_CLARIO_REGISTRY_ADDRESS ||
  "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87") as Address;

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_TESTNET_RPC] },
    public: { http: [MONAD_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: MONAD_TESTNET_EXPLORER },
  },
  testnet: true,
});

export const CLARIO_REGISTRY_ABI = [
  {
    type: "function",
    name: "saveTransaction",
    inputs: [
      { name: "transactionId", type: "bytes32", internalType: "bytes32" },
      { name: "dataHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTransactions",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ClarioTransactionRegistry.SavedTransaction[]",
        components: [
          { name: "transactionId", type: "bytes32", internalType: "bytes32" },
          { name: "dataHash", type: "bytes32", internalType: "bytes32" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "user", type: "address", internalType: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTransaction",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "transactionId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ClarioTransactionRegistry.SavedTransaction",
        components: [
          { name: "transactionId", type: "bytes32", internalType: "bytes32" },
          { name: "dataHash", type: "bytes32", internalType: "bytes32" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "user", type: "address", internalType: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTransactionCount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TransactionSaved",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      {
        name: "transactionId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "dataHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "timestamp",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "saveReceipt",
    inputs: [
      { name: "receiptId", type: "bytes32", internalType: "bytes32" },
      { name: "receiptHash", type: "bytes32", internalType: "bytes32" },
      { name: "transactionCount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReceipts",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ClarioTransactionRegistry.Receipt[]",
        components: [
          { name: "receiptId", type: "bytes32", internalType: "bytes32" },
          { name: "receiptHash", type: "bytes32", internalType: "bytes32" },
          {
            name: "transactionCount",
            type: "uint256",
            internalType: "uint256",
          },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "owner", type: "address", internalType: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReceipt",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "receiptId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ClarioTransactionRegistry.Receipt",
        components: [
          { name: "receiptId", type: "bytes32", internalType: "bytes32" },
          { name: "receiptHash", type: "bytes32", internalType: "bytes32" },
          {
            name: "transactionCount",
            type: "uint256",
            internalType: "uint256",
          },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "owner", type: "address", internalType: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReceiptCount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ReceiptSaved",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "receiptId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "receiptHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "transactionCount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "timestamp",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "InvalidReceiptId", inputs: [] },
  { type: "error", name: "InvalidReceiptHash", inputs: [] },
  { type: "error", name: "InvalidTransactionCount", inputs: [] },
  {
    type: "error",
    name: "ReceiptAlreadyExists",
    inputs: [{ name: "receiptId", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "error",
    name: "ReceiptNotFound",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "receiptId", type: "bytes32", internalType: "bytes32" },
    ],
  },
  { type: "error", name: "InvalidDataHash", inputs: [] },
  { type: "error", name: "InvalidTransactionId", inputs: [] },
  {
    type: "error",
    name: "TransactionAlreadyExists",
    inputs: [
      { name: "transactionId", type: "bytes32", internalType: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "TransactionNotFound",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "transactionId", type: "bytes32", internalType: "bytes32" },
    ],
  },
] as const;

export interface OnchainSavedTransaction {
  transactionId: `0x${string}`;
  dataHash: `0x${string}`;
  timestamp: bigint;
  user: Address;
}

export interface OnchainReceipt {
  receiptId: `0x${string}`;
  receiptHash: `0x${string}`;
  transactionCount: bigint;
  timestamp: bigint;
  owner: Address;
}

export interface CanonicalTransactionPayload {
  transactionId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  timestamp: string;
  version: number;
}

/**
 * Deterministically canonicalizes a JSON-compatible object (RFC 8785 style sorting).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item));
    return `[${items.join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    const encodedKey = JSON.stringify(key);
    const encodedVal = canonicalizeJson(obj[key]);
    return `${encodedKey}:${encodedVal}`;
  });

  return `{${pairs.join(",")}}`;
}

/**
 * Converts a standard string UUID or ID to a bytes32 hex string.
 * If already 0x followed by 64 hex characters, returns as-is.
 */
export function toBytes32Id(id: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase() as `0x${string}`;
  }
  return keccak256(stringToBytes(id));
}

/**
 * Constructs the canonical, deterministic transaction representation.
 * Explicitly excludes private evidence, receipt files, notes, or user emails.
 */
export function buildCanonicalTransaction(
  tx: Partial<Transaction> & { id: string; amount: number; merchant: string },
): CanonicalTransactionPayload {
  const categoryStr =
    typeof tx.category === "string" ? tx.category : tx.category_id || "other";

  return {
    transactionId: tx.id,
    amount: Number(tx.amount.toFixed(2)),
    currency: (tx.currency || "USD").toUpperCase(),
    merchant: tx.merchant.trim(),
    category: categoryStr.trim(),
    timestamp: tx.timestamp || tx.date || new Date().toISOString(),
    version: tx.version || 1,
  };
}

/**
 * Computes keccak256 cryptographic commitment of canonical transaction data.
 */
export function computeTransactionDataHash(
  tx: Partial<Transaction> & { id: string; amount: number; merchant: string },
): `0x${string}` {
  const canonical = buildCanonicalTransaction(tx);
  const canonicalJson = canonicalizeJson(canonical);
  return keccak256(stringToBytes(canonicalJson));
}

/**
 * Returns a configured Viem public client for querying Monad Testnet.
 */
export function getMonadPublicClient() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(MONAD_TESTNET_RPC),
  });
}

/**
 * Formats a block explorer URL for a transaction hash.
 */
export function getMonadExplorerTxUrl(txHash: string): string {
  return `${MONAD_TESTNET_EXPLORER}/tx/${txHash}`;
}

/**
 * Formats a block explorer URL for an address.
 */
export function getMonadExplorerAddressUrl(address: string): string {
  return `${MONAD_TESTNET_EXPLORER}/address/${address}`;
}

/**
 * Fetches all saved transaction commitments for a user address from the onchain registry.
 */
export async function fetchUserOnchainTransactions(
  userAddress: Address,
  registryAddress: Address = CLARIO_REGISTRY_ADDRESS,
): Promise<OnchainSavedTransaction[]> {
  if (
    !registryAddress ||
    registryAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return [];
  }

  const client = getMonadPublicClient();
  const rawRecords = (await client.readContract({
    address: registryAddress,
    abi: CLARIO_REGISTRY_ABI,
    functionName: "getTransactions",
    args: [userAddress],
  })) as Array<{
    transactionId: `0x${string}`;
    dataHash: `0x${string}`;
    timestamp: bigint;
    user: Address;
  }>;

  return rawRecords.map((r) => ({
    transactionId: r.transactionId,
    dataHash: r.dataHash,
    timestamp: r.timestamp,
    user: r.user,
  }));
}

/**
 * Constructs the canonical, deterministic receipt bundle representation.
 * Follows strict RFC 8785 determinism: sorts transactions by ID, normalizes numbers and strings.
 * Explicitly excludes private notes, images, or personal metadata.
 */
export function buildCanonicalReceiptBundle({
  receiptId,
  receiptNumber,
  receiptName,
  owner,
  transactions,
  createdAt,
}: {
  receiptId: string;
  receiptNumber: string;
  receiptName?: string | undefined;
  owner: string;
  transactions: Transaction[];
  createdAt?: string;
}): CanonicalReceiptBundle {
  const normalizedName =
    (receiptName || "").trim().slice(0, 80) || receiptNumber;
  const sortedTxs = [...transactions].sort((a, b) => a.id.localeCompare(b.id));
  const canonicalTxs: CanonicalReceiptTransaction[] = sortedTxs.map((t) => {
    const categoryStr =
      typeof t.category === "string" ? t.category : t.category_id || "other";
    const dateStr =
      t.date ||
      (t.timestamp
        ? t.timestamp.split("T")[0]!
        : new Date().toISOString().split("T")[0]!);

    return {
      id: t.id,
      amount: Number(Number(t.amount).toFixed(2)),
      currency: (t.currency || "USD").toUpperCase(),
      merchant: t.merchant.trim(),
      category: categoryStr.trim(),
      date: dateStr,
      type: t.type || "expense",
    };
  });

  const totalAmount = Number(
    canonicalTxs.reduce((sum, t) => sum + t.amount, 0).toFixed(2),
  );

  return {
    receiptId,
    receiptNumber,
    receiptName: normalizedName,
    createdAt: createdAt || new Date().toISOString(),
    owner: owner.toLowerCase().trim(),
    transactionCount: canonicalTxs.length,
    totalAmount,
    currency: canonicalTxs[0]?.currency || "USD",
    transactionIds: canonicalTxs.map((t) => t.id),
    transactions: canonicalTxs,
    version: 1,
  };
}

/**
 * Computes keccak256 cryptographic commitment of canonical receipt bundle.
 */
export function computeReceiptHash(
  bundle: CanonicalReceiptBundle,
): `0x${string}` {
  const canonicalJson = canonicalizeJson(bundle);
  return keccak256(stringToBytes(canonicalJson));
}

/**
 * Fetches all saved receipt bundles for a user address from the onchain registry.
 */
export async function fetchUserOnchainReceipts(
  userAddress: Address,
  registryAddress: Address = CLARIO_REGISTRY_ADDRESS,
): Promise<OnchainReceipt[]> {
  if (
    !registryAddress ||
    registryAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return [];
  }

  const client = getMonadPublicClient();
  const rawRecords = (await client.readContract({
    address: registryAddress,
    abi: CLARIO_REGISTRY_ABI,
    functionName: "getReceipts",
    args: [userAddress],
  })) as Array<{
    receiptId: `0x${string}`;
    receiptHash: `0x${string}`;
    transactionCount: bigint;
    timestamp: bigint;
    owner: Address;
  }>;

  return rawRecords.map((r) => ({
    receiptId: r.receiptId,
    receiptHash: r.receiptHash,
    transactionCount: r.transactionCount,
    timestamp: r.timestamp,
    owner: r.owner,
  }));
}

/**
 * Fetches a single receipt bundle for a user address from the onchain registry.
 */
export async function fetchOnchainReceipt(
  userAddress: Address,
  receiptIdBytes32: `0x${string}`,
  registryAddress: Address = CLARIO_REGISTRY_ADDRESS,
): Promise<OnchainReceipt | null> {
  if (
    !registryAddress ||
    registryAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  try {
    const client = getMonadPublicClient();
    const rawRecord = (await client.readContract({
      address: registryAddress,
      abi: CLARIO_REGISTRY_ABI,
      functionName: "getReceipt",
      args: [userAddress, receiptIdBytes32],
    })) as {
      receiptId: `0x${string}`;
      receiptHash: `0x${string}`;
      transactionCount: bigint;
      timestamp: bigint;
      owner: Address;
    };

    return {
      receiptId: rawRecord.receiptId,
      receiptHash: rawRecord.receiptHash,
      transactionCount: rawRecord.transactionCount,
      timestamp: rawRecord.timestamp,
      owner: rawRecord.owner,
    };
  } catch {
    return null;
  }
}
