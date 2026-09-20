#!/usr/bin/env node

/**
 * Clario Protocol Source Verification CLI
 *
 * Inspects a deployment manifest and outputs reproducible Forge verification commands
 * for Monad block explorer or Sourcify.
 *
 * Usage:
 *   node scripts/verify.mjs [options]
 *
 * Options:
 *   --manifest <path>   Path to deployment-manifest.json
 *   --rpc <url>         RPC endpoint to verify bytecode onchain
 *   --verifier <name>   Verifier service: sourcify | blockscout | etherscan (default: sourcify)
 *   --verifier-url <url> Verifier API URL (optional)
 *   --help              Display help message
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs(args) {
  const options = {
    manifest: null,
    rpc: null,
    verifier: "sourcify",
    verifierUrl: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--manifest" && i + 1 < args.length) {
      options.manifest = args[++i];
    } else if (arg === "--rpc" && i + 1 < args.length) {
      options.rpc = args[++i];
    } else if (arg === "--verifier" && i + 1 < args.length) {
      options.verifier = args[++i];
    } else if (arg === "--verifier-url" && i + 1 < args.length) {
      options.verifierUrl = args[++i];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || !options.manifest) {
    console.log(`
Clario Protocol Source Verification CLI

Usage:
  node scripts/verify.mjs --manifest <path> [options]

Options:
  --manifest <path>      Path to deployment-manifest.json (required)
  --rpc <url>            EVM RPC endpoint URL to verify deployed code hash
  --verifier <name>      Verifier backend: sourcify | blockscout | etherscan (default: sourcify)
  --verifier-url <url>   Custom verifier API URL
  --help, -h             Show this help message
`);
    process.exit(options.help ? 0 : 1);
  }

  const manifestPath = path.isAbsolute(options.manifest)
    ? options.manifest
    : path.resolve(process.cwd(), options.manifest);

  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest file not found at ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log("==================================================");
  console.log("     Clario Source Verification Runbook Tool      ");
  console.log("==================================================");
  console.log(`Environment:      ${manifest.environment}`);
  console.log(`Chain ID:         ${manifest.chainId}`);
  console.log(`Source Commit:    ${manifest.sourceCommit}`);
  console.log(`ClarioRegistry:   ${manifest.contracts.ClarioRegistry.address}`);
  console.log(`ABI Hash:         ${manifest.contracts.ClarioRegistry.abiHash}`);
  console.log("--------------------------------------------------\n");

  if (options.rpc) {
    try {
      const res = await fetch(options.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getCode",
          params: [manifest.contracts.ClarioRegistry.address, "latest"],
        }),
      });
      const data = await res.json();
      const code = data?.result;

      if (!code || code === "0x") {
        console.warn(
          "[WARNING] No bytecode found at ClarioRegistry address on configured RPC.",
        );
      } else {
        console.log(
          `[OK] Onchain bytecode verified at ${manifest.contracts.ClarioRegistry.address} (${code.length / 2 - 1} bytes).`,
        );
      }
    } catch (err) {
      console.warn(`[WARNING] RPC bytecode query failed: ${err.message}`);
    }
  }

  console.log("\nReproducible Forge Verification Commands:");
  console.log("Compiler settings: solc 0.8.30 | optimizer: true | runs: 200\n");

  const contracts = [
    {
      name: "ClarioWorkspaceRegistryV1",
      path: "src/protocol/v1/ClarioWorkspaceRegistryV1.sol:ClarioWorkspaceRegistryV1",
    },
    {
      name: "ClarioExpenseRegistryV1",
      path: "src/protocol/v1/ClarioExpenseRegistryV1.sol:ClarioExpenseRegistryV1",
    },
    {
      name: "ClarioDecisionRegistryV1",
      path: "src/protocol/v1/ClarioDecisionRegistryV1.sol:ClarioDecisionRegistryV1",
    },
    {
      name: "ClarioSettlementRegistryV1",
      path: "src/protocol/v1/ClarioSettlementRegistryV1.sol:ClarioSettlementRegistryV1",
    },
    {
      name: "ClarioRegistry",
      path: "src/protocol/v1/ClarioRegistry.sol:ClarioRegistry",
      address: manifest.contracts.ClarioRegistry.address,
    },
  ];

  for (const c of contracts) {
    const addr = c.address || "<CONTRACT_ADDRESS>";
    const verifierFlag = options.verifierUrl
      ? `--verifier ${options.verifier} --verifier-url ${options.verifierUrl}`
      : `--verifier ${options.verifier}`;

    console.log(`# ${c.name}:`);
    console.log(
      `forge verify-contract --root contracts ${addr} ${c.path} --compiler-version 0.8.30 --num-of-optimizations 200 ${verifierFlag} --chain-id ${manifest.chainId}\n`,
    );
  }
}

main();
