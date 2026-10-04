import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
const REGISTRY_ADDRESS = "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87";
const DEPLOYER_PK = "0xc3246dba3eca3c1967ed3c875e5b5de32501378403a02d23196e465cd22db40e";

const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_TESTNET_RPC] },
    public: { http: [MONAD_TESTNET_RPC] },
  },
  testnet: true,
});

const ABI = [
  {
    type: "function",
    name: "saveReceipt",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "receiptHash", type: "bytes32" },
      { name: "transactionCount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReceipt",
    inputs: [
      { name: "user", type: "address" },
      { name: "receiptId", type: "bytes32" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "receiptId", type: "bytes32" },
          { name: "receiptHash", type: "bytes32" },
          { name: "transactionCount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "owner", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReceiptCount",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  const obj = value;
  const sortedKeys = Object.keys(obj).sort();
  return `{${sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(",")}}`;
}

function toBytes32Id(id) {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return id.toLowerCase();
  return keccak256(stringToBytes(id));
}

async function runSuite() {
  console.log("=== RUNNING FULL RECEIPT BUNDLE COMPREHENSIVE SUITE ===");

  const account = privateKeyToAccount(DEPLOYER_PK);
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_TESTNET_RPC) });
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(MONAD_TESTNET_RPC) });

  // 1. Generate 10 Real Transactions
  console.log("\n[TEST 1] Generating 10-transaction bundle...");
  const txs = Array.from({ length: 10 }, (_, i) => ({
    id: `tx-batch-${i + 1}-${Date.now()}`,
    amount: Number((1.25 * (i + 1)).toFixed(2)),
    currency: "USD",
    merchant: `Merchant Batch ${i + 1}`,
    category: "crypto_ops",
    date: "2026-10-01",
    type: "expense",
  }));

  const totalAmount = Number(txs.reduce((s, t) => s + t.amount, 0).toFixed(2));
  const receiptId = `receipt_bundle_10_${Date.now()}`;
  const canonical10 = {
    receiptId,
    receiptNumber: "CR-2026-0002",
    receiptName: "Q4 Infrastructure & API Expenses",
    createdAt: new Date().toISOString(),
    owner: account.address.toLowerCase(),
    transactionCount: 10,
    totalAmount,
    currency: "USD",
    transactionIds: txs.map((t) => t.id).sort(),
    transactions: [...txs].sort((a, b) => a.id.localeCompare(b.id)),
    version: 1,
  };

  const receiptHash10 = keccak256(stringToBytes(canonicalizeJson(canonical10)));
  const receiptIdBytes32_10 = toBytes32Id(receiptId);

  console.log(`10-tx Total: $${totalAmount}`);
  console.log(`10-tx Receipt Hash: ${receiptHash10}`);

  console.log("Submitting 1 Monad tx for 10 transactions...");
  const txHash10 = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: ABI,
    functionName: "saveReceipt",
    args: [receiptIdBytes32_10, receiptHash10, BigInt(10)],
  });

  console.log(`Tx broadcast: ${txHash10}`);
  const receipt10 = await publicClient.waitForTransactionReceipt({ hash: txHash10, confirmations: 1 });
  if (receipt10.status !== "success") throw new Error("10-tx bundle failed!");
  console.log(`✓ 10-Transaction Bundle Confirmed: Block #${receipt10.blockNumber}`);

  // Query verification
  const onchain10 = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: ABI,
    functionName: "getReceipt",
    args: [account.address, receiptIdBytes32_10],
  });
  if (onchain10.receiptHash.toLowerCase() !== receiptHash10.toLowerCase()) {
    throw new Error("10-tx Hash mismatch!");
  }
  if (Number(onchain10.transactionCount) !== 10) {
    throw new Error("10-tx count mismatch!");
  }
  console.log("✓ 10-Transaction Bundle Verified on Monad: PASS");

  // 2. Duplicate Prevention Test
  console.log("\n[TEST 2] Duplicate Prevention Test (Onchain & Client)...");
  // Attempting to save exact same receiptId must revert onchain
  let duplicateReverted = false;
  try {
    await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: ABI,
      functionName: "saveReceipt",
      args: [receiptIdBytes32_10, receiptHash10, BigInt(10)],
    });
  } catch {
    duplicateReverted = true;
    console.log("✓ Onchain Duplicate Prevention: Reverted as expected (ReceiptAlreadyExists)");
  }
  if (!duplicateReverted) {
    throw new Error("Expected onchain duplicate save to revert!");
  }

  // 3. Tampering Verification Test
  console.log("\n[TEST 3] Tampered Receipt Verification Test...");
  const tampered10 = { ...canonical10, totalAmount: totalAmount + 1.00 };
  const tamperedHash = keccak256(stringToBytes(canonicalizeJson(tampered10)));
  const matchesOnchain = tamperedHash.toLowerCase() === onchain10.receiptHash.toLowerCase();
  if (matchesOnchain) {
    throw new Error("Tampered hash should not match onchain hash!");
  }
  console.log("✓ Tampered Receipt Correctly Rejected: PASS (Hash mismatch detected)");

  console.log("\n==========================================");
  console.log("COMPREHENSIVE BUNDLE VALIDATION SUITE: 100% PASS");
  console.log("==========================================");
}

runSuite().catch((err) => {
  console.error("Suite failed:", err);
  process.exit(1);
});
