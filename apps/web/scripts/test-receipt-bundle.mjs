import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Monad Testnet configuration
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
  {
    type: "function",
    name: "getReceipts",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
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
];

function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item));
    return `[${items.join(",")}]`;
  }
  const obj = value;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    const encodedKey = JSON.stringify(key);
    const encodedVal = canonicalizeJson(obj[key]);
    return `${encodedKey}:${encodedVal}`;
  });
  return `{${pairs.join(",")}}`;
}

function toBytes32Id(id) {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return id.toLowerCase();
  }
  return keccak256(stringToBytes(id));
}

async function runTests() {
  console.log("=== CLARIO MULTI-TRANSACTION RECEIPT BUNDLE VALIDATION ===");

  const account = privateKeyToAccount(DEPLOYER_PK);
  console.log(`Deployer Account: ${account.address}`);
  console.log(`Registry Contract: ${REGISTRY_ADDRESS}`);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(MONAD_TESTNET_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(MONAD_TESTNET_RPC),
  });

  // 1. Test 3 Clario Transactions
  const rawTransactions = [
    {
      id: "tx-mon-1",
      amount: 1.59,
      currency: "USD",
      merchant: "MON TRANSFER (0xdb8...50f3)",
      category: "crypto_ops",
      date: "2026-07-20",
      type: "expense",
    },
    {
      id: "tx-mon-2",
      amount: 0.45,
      currency: "USD",
      merchant: "MON TRANSFER (0x380...e368)",
      category: "crypto_ops",
      date: "2026-09-24",
      type: "expense",
    },
    {
      id: "tx-eth-3",
      amount: 8.2,
      currency: "USD",
      merchant: "ETH TRANSFER (0x742...d35e)",
      category: "crypto_ops",
      date: "2026-09-26",
      type: "expense",
    },
  ];

  const receiptId = `receipt_test_${Date.now()}`;
  const receiptNumber = "CR-2026-0001";
  const receiptName = "September Crypto Expenses";
  const createdAt = "2026-10-01T12:00:00.000Z";

  const canonicalBundle = {
    receiptId,
    receiptNumber,
    receiptName,
    createdAt,
    owner: account.address.toLowerCase(),
    transactionCount: rawTransactions.length,
    totalAmount: 10.24,
    currency: "USD",
    transactionIds: ["tx-eth-3", "tx-mon-1", "tx-mon-2"].sort(),
    transactions: [...rawTransactions].sort((a, b) => a.id.localeCompare(b.id)),
    version: 1,
  };

  const canonicalJson = canonicalizeJson(canonicalBundle);
  const receiptHash = keccak256(stringToBytes(canonicalJson));
  const receiptIdBytes32 = toBytes32Id(receiptId);

  console.log(`Receipt ID: ${receiptId}`);
  console.log(`Receipt Number: ${receiptNumber}`);
  console.log(`Receipt Name: "${receiptName}"`);
  console.log(`Receipt Hash (keccak256): ${receiptHash}`);
  console.log(`Total Amount: $${canonicalBundle.totalAmount}`);
  console.log(`Transaction Count: ${canonicalBundle.transactionCount}`);

  // Test Determinism: reordered keys must produce same hash
  const reorderedBundle = {
    version: 1,
    transactions: canonicalBundle.transactions,
    transactionIds: canonicalBundle.transactionIds,
    totalAmount: 10.24,
    receiptName,
    transactionCount: 3,
    owner: account.address.toLowerCase(),
    createdAt,
    receiptNumber,
    receiptId,
    currency: "USD",
  };
  const reorderedHash = keccak256(stringToBytes(canonicalizeJson(reorderedBundle)));
  if (reorderedHash !== receiptHash) {
    throw new Error("Determinism check failed: reordered keys produced different hash!");
  }
  console.log("✓ Deterministic Canonical Hashing: PASS");

  // Test Name Sensitivity: altering receipt name must produce a different hash
  const renamedBundle = {
    ...canonicalBundle,
    receiptName: "October Crypto Expenses",
  };
  const renamedHash = keccak256(stringToBytes(canonicalizeJson(renamedBundle)));
  if (renamedHash === receiptHash) {
    throw new Error("Name sensitivity failed: altered name produced same hash!");
  }
  console.log("✓ Receipt Name Cryptographic Binding: PASS (Renamed bundle hash differs)");

  // Test Tampering: changing an amount alters hash
  const tamperedBundle = {
    ...canonicalBundle,
    totalAmount: 10.25,
  };
  const tamperedHash = keccak256(stringToBytes(canonicalizeJson(tamperedBundle)));
  if (tamperedHash === receiptHash) {
    throw new Error("Tampering check failed: tampered amount produced same hash!");
  }
  console.log("✓ Tampering Detection: PASS (Tampered hash differs)");

  // 2. Submit ONE Monad Testnet Transaction
  console.log("\nSubmitting ONE Monad Testnet transaction for 3 bundled transactions...");
  const txHash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: ABI,
    functionName: "saveReceipt",
    args: [receiptIdBytes32, receiptHash, BigInt(3)],
  });

  console.log(`Monad Tx Hash: ${txHash}`);
  console.log(`Explorer Link: https://testnet.monadexplorer.com/tx/${txHash}`);

  console.log("Waiting for confirmation on Monad Testnet...");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  if (receipt.status !== "success") {
    throw new Error(`Monad transaction reverted! Status: ${receipt.status}`);
  }
  console.log(`✓ Monad Confirmation: Block #${receipt.blockNumber}, Status: ${receipt.status}`);

  // 3. Verify Onchain State & Query
  console.log("\nQuerying onchain registry for verification...");
  const onchainReceipt = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: ABI,
    functionName: "getReceipt",
    args: [account.address, receiptIdBytes32],
  });

  console.log("Onchain Record Retrieved:");
  console.log(`  - receiptId: ${onchainReceipt.receiptId}`);
  console.log(`  - receiptHash: ${onchainReceipt.receiptHash}`);
  console.log(`  - transactionCount: ${onchainReceipt.transactionCount}`);
  console.log(`  - timestamp: ${onchainReceipt.timestamp}`);
  console.log(`  - owner: ${onchainReceipt.owner}`);

  if (onchainReceipt.receiptHash.toLowerCase() !== receiptHash.toLowerCase()) {
    throw new Error("Hash mismatch! Onchain hash != generated hash");
  }
  if (Number(onchainReceipt.transactionCount) !== 3) {
    throw new Error("Transaction count mismatch!");
  }
  console.log("✓ Cryptographic Hash Verification on Monad: MATCH (VERIFIED)");

  // 4. Test Single Receipt vs Multi Bundle Count
  const totalCount = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: ABI,
    functionName: "getReceiptCount",
    args: [account.address],
  });
  console.log(`Total Receipts onchain for account: ${totalCount}`);

  console.log("\n==========================================");
  console.log("ALL REAL ON-CHAIN TESTS PASSED SUCCESSFULLY!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
