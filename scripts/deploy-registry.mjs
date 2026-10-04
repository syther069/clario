#!/usr/bin/env node

/**
 * ClarioTransactionRegistry Deployment Script for Monad Testnet
 *
 * Usage:
 *   node scripts/deploy-registry.mjs [options]
 *
 * Options:
 *   --rpc <url>         RPC endpoint URL (default: https://testnet-rpc.monad.xyz)
 *   --pk <hex>          Deployer private key (or set MONAD_DEPLOYER_PRIVATE_KEY env var)
 *   --help              Display help message
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: MONAD_TESTNET_EXPLORER },
  },
  testnet: true,
});

function parseArgs(args) {
  const options = {
    rpc:
      process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC ||
      "https://testnet-rpc.monad.xyz",
    pk: process.env.MONAD_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--rpc" && i + 1 < args.length) {
      options.rpc = args[++i];
    } else if (arg === "--pk" && i + 1 < args.length) {
      options.pk = args[++i];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`
ClarioTransactionRegistry Deployment Script
Targets: Monad Testnet (Chain ID: 10143)

Usage:
  node scripts/deploy-registry.mjs [--rpc <url>] [--pk <private_key>]

Options:
  --rpc <url>   Monad Testnet RPC URL (default: https://testnet-rpc.monad.xyz)
  --pk <hex>    Deployer private key (0x...)
  --help        Show this help message
    `);
    process.exit(0);
  }

  if (!options.pk) {
    console.error(`
Error: Missing deployer private key!
Please provide a funded deployer key on Monad Testnet:
  1. Via CLI flag: --pk 0x...
  2. Via environment variable: MONAD_DEPLOYER_PRIVATE_KEY=0x...

To generate and fund a key on Monad Testnet:
  1. Run: cast wallet new
  2. Request testnet MON from official faucet: https://testnet.monad.xyz
  3. Re-run this script with the funded key.
    `);
    process.exit(1);
  }

  const formattedPk = options.pk.startsWith("0x")
    ? options.pk
    : `0x${options.pk}`;
  const account = privateKeyToAccount(formattedPk);

  console.log("=================================================");
  console.log("  CLARIO TRANSACTION REGISTRY — MONAD TESTNET   ");
  console.log("=================================================");
  console.log(`Network:       Monad Testnet`);
  console.log(`Chain ID:      ${MONAD_TESTNET_CHAIN_ID}`);
  console.log(`RPC Endpoint:  ${options.rpc}`);
  console.log(`Deployer:      ${account.address}`);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(options.rpc),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    console.error(
      `Error: Connected to unexpected chain ID: ${chainId} (expected ${MONAD_TESTNET_CHAIN_ID})`,
    );
    process.exit(1);
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer Bal:  ${(Number(balance) / 1e18).toFixed(4)} MON`);

  if (balance === 0n) {
    console.error(
      `\nDeployer has 0 MON. Please fund ${account.address} at https://testnet.monad.xyz`,
    );
    process.exit(1);
  }

  // Load compiled Foundry artifact
  const artifactPath = path.resolve(
    ROOT_DIR,
    "contracts/out/ClarioTransactionRegistry.sol/ClarioTransactionRegistry.json",
  );

  if (!fs.existsSync(artifactPath)) {
    console.error(
      `Artifact not found at ${artifactPath}. Run 'forge build' first.`,
    );
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  console.log("\nDeploying ClarioTransactionRegistry...");

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(options.rpc),
  });

  const deployTxHash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [],
  });

  console.log(`Deployment transaction submitted: ${deployTxHash}`);
  console.log(`Awaiting confirmation on Monad Testnet...`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployTxHash,
    confirmations: 1,
  });

  const contractAddress = receipt.contractAddress;
  console.log("\n=================================================");
  console.log("  DEPLOYMENT SUCCESSFUL!                         ");
  console.log("=================================================");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployment Tx:    ${deployTxHash}`);
  console.log(`Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`Block Number:     ${receipt.blockNumber.toString()}`);
  console.log(`Explorer URL:     ${MONAD_TESTNET_EXPLORER}/tx/${deployTxHash}`);
  console.log(
    `Contract URL:     ${MONAD_TESTNET_EXPLORER}/address/${contractAddress}`,
  );
  console.log("=================================================\n");
  console.log("Update your apps/web/.env.local with:");
  console.log(`NEXT_PUBLIC_CLARIO_REGISTRY_ADDRESS=${contractAddress}\n`);
}

main().catch((err) => {
  console.error("Fatal deployment error:", err);
  process.exit(1);
});
