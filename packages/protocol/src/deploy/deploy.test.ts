import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import {
  computeAbiHash,
  saveDeploymentManifest,
  validateDeploymentManifest,
  type DeploymentManifest,
} from "./manifest.js";
import { deployClarioProtocol } from "./deploy.js";

const TEST_PORT = 8549;
const RPC_URL = `http://127.0.0.1:${TEST_PORT}`;
const CONTRACTS_OUT = path.resolve(process.cwd(), "../../contracts/out");

describe("Deployment Tooling & Manifest Engine", () => {
  describe("computeAbiHash", () => {
    it("computes deterministic 32-byte keccak256 hash for contract ABI", () => {
      const sampleAbi = [
        {
          type: "function",
          name: "workspaceRegistry",
          inputs: [],
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
        },
      ];

      const hash1 = computeAbiHash(sampleAbi);
      const hash2 = computeAbiHash(sampleAbi);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("throws error for non-array ABI", () => {
      expect(() =>
        computeAbiHash("not an array" as unknown as readonly unknown[]),
      ).toThrow("Invalid ABI: expected array.");
    });
  });

  describe("validateDeploymentManifest", () => {
    const validManifest: DeploymentManifest = {
      schemaVersion: 1,
      environment: "local",
      sourceCommit: "a".repeat(40),
      chainFamily: "local",
      chainId: 31337,
      deployer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      deployedAt: new Date().toISOString(),
      contracts: {
        ClarioRegistry: {
          address: "0x1111111111111111111111111111111111111111",
          deploymentBlock: 1,
          transactionHash: `0x${"2".repeat(64)}`,
          abiHash: `0x${"3".repeat(64)}`,
          verifiedSourceUrl: null,
        },
      },
      tokens: {
        USDC: {
          address: "0x4444444444444444444444444444444444444444",
          decimals: 6,
        },
      },
    };

    it("accepts valid manifest conforming to schema version 1", () => {
      const result = validateDeploymentManifest(validManifest);
      expect(result.schemaVersion).toBe(1);
      expect(result.contracts.ClarioRegistry.address).toBe(
        validManifest.contracts.ClarioRegistry.address.toLowerCase(),
      );

      const validated = validateDeploymentManifest(validManifest);
      expect(validated.chainId).toBe(31337);
      expect(validated.tokens.USDC.decimals).toBe(6);
    });

    it("rejects manifest with extra keys", () => {
      const tampered = { ...validManifest, extraKey: "forbidden" };
      expect(() => validateDeploymentManifest(tampered)).toThrow(
        "Manifest has invalid keys",
      );
    });

    it("rejects manifest with invalid chainFamily for environment", () => {
      const tampered = { ...validManifest, chainFamily: "monad" as const };
      expect(() => validateDeploymentManifest(tampered)).toThrow(
        "Network mismatch: environment local requires chainFamily local",
      );
    });

    it("rejects non-local manifest missing https verifiedSourceUrl", () => {
      const tampered: DeploymentManifest = {
        ...validManifest,
        environment: "preview",
        chainFamily: "monad",
        contracts: {
          ClarioRegistry: {
            ...validManifest.contracts.ClarioRegistry,
            verifiedSourceUrl: null,
          },
        },
      };
      expect(() => validateDeploymentManifest(tampered)).toThrow(
        "ClarioRegistry.verifiedSourceUrl must be an HTTPS URL in non-local environments",
      );
    });
  });

  describe("saveDeploymentManifest & Overwrite Protection", () => {
    const tmpDir = path.resolve(process.cwd(), "tmp_test_manifests");
    const testFile = path.join(tmpDir, "manifest.json");

    const validManifest: DeploymentManifest = {
      schemaVersion: 1,
      environment: "local",
      sourceCommit: "b".repeat(40),
      chainFamily: "local",
      chainId: 31337,
      deployer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      deployedAt: new Date().toISOString(),
      contracts: {
        ClarioRegistry: {
          address: "0x1111111111111111111111111111111111111111",
          deploymentBlock: 1,
          transactionHash: `0x${"2".repeat(64)}`,
          abiHash: `0x${"3".repeat(64)}`,
          verifiedSourceUrl: null,
        },
      },
      tokens: {
        USDC: {
          address: "0x4444444444444444444444444444444444444444",
          decimals: 6,
        },
      },
    };

    afterAll(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("writes manifest to new file successfully", () => {
      saveDeploymentManifest({ filePath: testFile, manifest: validManifest });
      expect(fs.existsSync(testFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testFile, "utf8"));
      expect(content.sourceCommit).toBe("b".repeat(40));
    });

    it("refuses to overwrite existing manifest silently when force is false", () => {
      expect(() =>
        saveDeploymentManifest({
          filePath: testFile,
          manifest: validManifest,
          force: false,
        }),
      ).toThrow(
        /Deployment manifest already exists.*Re-running will not overwrite an existing manifest silently.*Pass --force to overwrite/,
      );
    });

    it("overwrites existing manifest when force is true", () => {
      const updatedManifest = {
        ...validManifest,
        sourceCommit: "c".repeat(40),
      };
      saveDeploymentManifest({
        filePath: testFile,
        manifest: updatedManifest,
        force: true,
      });

      const content = JSON.parse(fs.readFileSync(testFile, "utf8"));
      expect(content.sourceCommit).toBe("c".repeat(40));
    });
  });

  describe("Deterministic Local EVM Deployment & Multi-path Isolation", () => {
    let anvilProcess: ChildProcess | null = null;
    const testOutputDir = path.resolve(process.cwd(), "tmp_anvil_runs");
    const manifestPath1 = path.join(
      testOutputDir,
      "run1",
      "deployment-manifest.json",
    );
    const manifestPath2 = path.join(
      testOutputDir,
      "run2",
      "deployment-manifest.json",
    );

    beforeAll(async () => {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testOutputDir, { recursive: true });

      // Spawn local Anvil process
      anvilProcess = spawn("anvil", ["--port", String(TEST_PORT), "--silent"], {
        stdio: "ignore",
      });

      // Wait up to 3 seconds for Anvil to accept HTTP connections
      let connected = false;
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch(RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_chainId",
              params: [],
              id: 1,
            }),
          });
          if (res.ok) {
            connected = true;
            break;
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!connected) {
        throw new Error("Failed to start or connect to local Anvil node.");
      }
    });

    afterAll(async () => {
      if (anvilProcess) {
        anvilProcess.kill();
      }
      try {
        if (fs.existsSync(testOutputDir)) {
          fs.rmSync(testOutputDir, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 100,
          });
        }
      } catch {
        // Safe ignore if Windows process termination briefly holds file handle
      }
    });

    it("runs dry-run simulation mode without mutating chain state", async () => {
      const result = await deployClarioProtocol({
        rpcUrl: RPC_URL,
        environment: "local",
        sourceCommit: "d".repeat(40),
        dryRun: true,
        contractsOutDir: CONTRACTS_OUT,
      });

      expect(result.isDryRun).toBe(true);
      expect(result.manifest.schemaVersion).toBe(1);
      expect(result.manifest.environment).toBe("local");
      expect(result.manifest.contracts.ClarioRegistry.address).toBe(
        "0x0000000000000000000000000000000000000001",
      );
      expect(result.manifest.contracts.ClarioRegistry.transactionHash).toBe(
        `0x${"0".repeat(64)}`,
      );

      // Verify schema parser accepts simulated manifest
      const webConfig = validateDeploymentManifest(result.manifest);
      expect(webConfig.schemaVersion).toBe(1);
    });

    it("deploys to local EVM under isolated output path 1 and generates schema-valid manifest", async () => {
      const result = await deployClarioProtocol({
        rpcUrl: RPC_URL,
        environment: "local",
        sourceCommit: "e".repeat(40),
        contractsOutDir: CONTRACTS_OUT,
      });

      expect(result.isDryRun).toBe(false);
      expect(result.receipts.ClarioWorkspaceRegistryV1).toBeDefined();
      expect(result.receipts.ClarioExpenseRegistryV1).toBeDefined();
      expect(result.receipts.ClarioDecisionRegistryV1).toBeDefined();
      expect(result.receipts.ClarioSettlementRegistryV1).toBeDefined();
      expect(result.receipts.ClarioRegistry).toBeDefined();
      expect(result.receipts.MockUSDC).toBeDefined();

      const registryAddress = result.manifest.contracts.ClarioRegistry.address;
      expect(registryAddress).toMatch(/^0x[0-9a-f]{40}$/);
      expect(result.manifest.contracts.ClarioRegistry.transactionHash).toMatch(
        /^0x[0-9a-f]{64}$/,
      );
      expect(result.manifest.tokens.USDC.address).toMatch(/^0x[0-9a-f]{40}$/);

      // Validate manifest
      const parsed = validateDeploymentManifest(result.manifest);
      expect(parsed.contracts.ClarioRegistry.address).toBe(registryAddress);
      expect(parsed.tokens.USDC.decimals).toBe(6);

      // Save to path 1
      saveDeploymentManifest({
        filePath: manifestPath1,
        manifest: result.manifest,
      });
      expect(fs.existsSync(manifestPath1)).toBe(true);

      // Assert silent overwrite refusal
      expect(() =>
        saveDeploymentManifest({
          filePath: manifestPath1,
          manifest: result.manifest,
          force: false,
        }),
      ).toThrow(/Deployment manifest already exists/);
    });

    it("deploys to local EVM under isolated output path 2 and produces distinct receipts", async () => {
      const result = await deployClarioProtocol({
        rpcUrl: RPC_URL,
        environment: "local",
        sourceCommit: "f".repeat(40),
        contractsOutDir: CONTRACTS_OUT,
      });

      expect(result.isDryRun).toBe(false);

      // Save to isolated path 2
      saveDeploymentManifest({
        filePath: manifestPath2,
        manifest: result.manifest,
      });
      expect(fs.existsSync(manifestPath2)).toBe(true);

      const manifest1 = JSON.parse(fs.readFileSync(manifestPath1, "utf8"));
      const manifest2 = JSON.parse(fs.readFileSync(manifestPath2, "utf8"));

      expect(manifest1.sourceCommit).toBe("e".repeat(40));
      expect(manifest2.sourceCommit).toBe("f".repeat(40));
      expect(manifest1.contracts.ClarioRegistry.transactionHash).not.toBe(
        manifest2.contracts.ClarioRegistry.transactionHash,
      );

      // Both pass schema validation
      expect(validateDeploymentManifest(manifest1).schemaVersion).toBe(1);
      expect(validateDeploymentManifest(manifest2).schemaVersion).toBe(1);
    });
  });
});
