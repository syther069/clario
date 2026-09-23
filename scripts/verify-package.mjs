#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createRpcVerifierChainSource,
  loadVerificationPackageZip,
  verifyPackage,
} from "../packages/protocol/dist/index.js";

function usage() {
  return "Usage: pnpm verify:package -- <clario-export.zip> [--rpc <MONAD_RPC_URL>]";
}

function parseArguments(argv) {
  let packagePath = null;
  let rpcUrl = null;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--rpc") {
      rpcUrl = argv[++index] ?? null;
      if (!rpcUrl) throw new Error("--rpc requires a URL.\n" + usage());
    } else if (!value.startsWith("-") && !packagePath) {
      packagePath = value;
    } else {
      throw new Error(`Unknown argument: ${value}\n${usage()}`);
    }
  }
  if (!packagePath) throw new Error(usage());
  return { packagePath, rpcUrl };
}

async function main() {
  const { packagePath, rpcUrl } = parseArguments(process.argv.slice(2));
  const archive = await readFile(resolve(packagePath));
  const bundle = loadVerificationPackageZip(archive);
  const chainSource = rpcUrl ? createRpcVerifierChainSource(rpcUrl) : undefined;
  const report = await verifyPackage({ bundle, chainSource });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exitCode = report.overall === "FAILED" ? 1 : 0;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Verification failed."}\n`,
  );
  process.exitCode = 1;
});
