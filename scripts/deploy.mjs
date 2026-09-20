#!/usr/bin/env node

/**
 * Clario Protocol Deployment CLI
 *
 * Usage:
 *   node scripts/deploy.mjs [options]
 *
 * Options:
 *   --env <local|preview|staging|production>   Target environment (default: local)
 *   --rpc <url>                               RPC endpoint URL (default: http://127.0.0.1:8545)
 *   --out <path>                              Output manifest path (default: deployments/<env>/deployment-manifest.json)
 *   --commit <hex>                            Source commit hash (default: process.env.SOURCE_COMMIT or 40-zero string for local)
 *   --dry-run                                 Simulate deployment and calculate plan without broadcasting
 *   --force                                   Allow overwriting an existing manifest file
 *   --pk <hex>                                Deployer private key (defaults to Anvil #0 for local)
 *   --usdc <address>                          USDC token contract address (required for non-local)
 *   --verified-url <url>                      Verified source URL (required for non-local)
 *   --help                                    Display help message
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deployClarioProtocol,
  saveDeploymentManifest,
} from "../packages/protocol/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs(args) {
  const options = {
    env: "local",
    rpc: "http://127.0.0.1:8545",
    out: null,
    commit: process.env.SOURCE_COMMIT || "0".repeat(40),
    dryRun: false,
    force: false,
    pk: undefined,
    usdc: undefined,
    verifiedUrl: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--env" && i + 1 < args.length) {
      options.env = args[++i];
    } else if (arg === "--rpc" && i + 1 < args.length) {
      options.rpc = args[++i];
    } else if (arg === "--out" && i + 1 < args.length) {
      options.out = args[++i];
    } else if (arg === "--commit" && i + 1 < args.length) {
      options.commit = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--pk" && i + 1 < args.length) {
      options.pk = args[++i];
    } else if (arg === "--usdc" && i + 1 < args.length) {
      options.usdc = args[++i];
    } else if (arg === "--verified-url" && i + 1 < args.length) {
      options.verifiedUrl = args[++i];
    }
  }

  if (!options.out) {
    options.out = path.join(
      ROOT_DIR,
      "deployments",
      options.env,
      "deployment-manifest.json",
    );
  } else if (!path.isAbsolute(options.out)) {
    options.out = path.resolve(process.cwd(), options.out);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`
Clario Protocol Deployment CLI

Usage:
  node scripts/deploy.mjs [options]

Options:
  --env <env>             Target environment: local | preview | staging | production (default: local)
  --rpc <url>             EVM RPC endpoint URL (default: http://127.0.0.1:8545)
  --out <path>            Output path for deployment-manifest.json
  --commit <hex>          40- or 64-char commit hash (default: SOURCE_COMMIT or 40-zero for local)
  --dry-run               Simulate deployment gas and plan without broadcasting
  --force                 Explicitly allow overwriting an existing manifest file
  --pk <hex>              Deployer private key (default: local Anvil key #0)
  --usdc <address>        USDC token address (required for non-local)
  --verified-url <url>    Verified source URL (required for non-local)
  --help, -h              Show this help message
`);
    process.exit(0);
  }

  console.log("==================================================");
  console.log("       Clario Protocol Deployment Tooling         ");
  console.log("==================================================");
  console.log(`Environment:      ${options.env}`);
  console.log(`RPC Endpoint:     ${options.rpc}`);
  console.log(`Source Commit:    ${options.commit}`);
  console.log(
    `Mode:             ${options.dryRun ? "SIMULATION (DRY-RUN)" : "LIVE EXECUTION"}`,
  );
  console.log(`Output Path:      ${options.out}`);
  console.log(
    `Overwrite Guard:  ${options.force ? "FORCE OVERWRITE ENABLED" : "PROTECTED (FAIL IF EXISTS)"}`,
  );
  console.log("--------------------------------------------------");

  const contractsOutDir = path.join(ROOT_DIR, "contracts", "out");

  try {
    const result = await deployClarioProtocol({
      rpcUrl: options.rpc,
      privateKey: options.pk,
      environment: options.env,
      sourceCommit: options.commit,
      dryRun: options.dryRun,
      contractsOutDir,
      usdcAddress: options.usdc,
      verifiedSourceUrl: options.verifiedUrl,
    });

    if (result.isDryRun) {
      console.log("\n[DRY RUN] Deployment plan verified successfully!");
      console.log("Simulated Manifest:");
      console.log(JSON.stringify(result.manifest, null, 2));
      console.log("\nNo transactions were broadcast. No state was mutated.");
    } else {
      console.log("\nDeployment completed successfully! Contract Receipts:");
      for (const [name, receipt] of Object.entries(result.receipts)) {
        console.log(
          `  - ${name.padEnd(28)}: ${receipt.address} (Block: ${receipt.deploymentBlock}, Hash: ${receipt.transactionHash.slice(0, 14)}...)`,
        );
      }

      console.log(`\nSaving deployment manifest to: ${options.out}`);
      saveDeploymentManifest({
        filePath: options.out,
        manifest: result.manifest,
        force: options.force,
      });
      console.log(
        "Manifest saved and verified against schema version 1 successfully.",
      );
    }
  } catch (error) {
    console.error(`\n[ERROR] Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

main();
