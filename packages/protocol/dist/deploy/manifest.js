import * as fs from "node:fs";
import * as path from "node:path";
import { keccak256, stringToBytes } from "viem";
import { canonicalizeJson } from "../schema/v1/canonicalize.js";
export const DEPLOYMENT_ENVIRONMENTS = [
    "local",
    "preview",
    "staging",
    "production",
];
const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const EVM_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
const SOURCE_COMMIT_REGEX = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
/**
 * Computes the deterministic 32-byte keccak256 hash of a contract ABI
 * using RFC 8785 JSON canonicalization.
 */
export function computeAbiHash(abi) {
    if (!Array.isArray(abi)) {
        throw new Error("Invalid ABI: expected array.");
    }
    const canonicalJson = canonicalizeJson(abi);
    return keccak256(stringToBytes(canonicalJson));
}
/**
 * Validates a DeploymentManifest against schema version 1 requirements.
 * Throws an Error if any field is missing, extra, or malformed.
 */
export function validateDeploymentManifest(manifest) {
    if (typeof manifest !== "object" ||
        manifest === null ||
        Array.isArray(manifest)) {
        throw new Error("Invalid manifest: expected object.");
    }
    const record = manifest;
    const expectedKeys = [
        "schemaVersion",
        "environment",
        "sourceCommit",
        "chainFamily",
        "chainId",
        "deployer",
        "deployedAt",
        "contracts",
        "tokens",
    ].sort();
    const actualKeys = Object.keys(record).sort();
    if (actualKeys.length !== expectedKeys.length ||
        actualKeys.some((k, i) => k !== expectedKeys[i])) {
        throw new Error(`Manifest has invalid keys: [${actualKeys.join(", ")}], expected [${expectedKeys.join(", ")}]`);
    }
    if (record.schemaVersion !== 1) {
        throw new Error(`Unsupported schemaVersion: ${record.schemaVersion}`);
    }
    const env = record.environment;
    if (!DEPLOYMENT_ENVIRONMENTS.includes(env)) {
        throw new Error(`Invalid environment: ${env}`);
    }
    const environment = env;
    const expectedFamily = environment === "local" ? "local" : "monad";
    if (record.chainFamily !== expectedFamily) {
        throw new Error(`Network mismatch: environment ${environment} requires chainFamily ${expectedFamily}, got ${record.chainFamily}`);
    }
    const chainFamily = record.chainFamily;
    if (typeof record.chainId !== "number" ||
        !Number.isInteger(record.chainId) ||
        record.chainId < 1) {
        throw new Error(`Invalid chainId: ${record.chainId}`);
    }
    const chainId = record.chainId;
    if (typeof record.sourceCommit !== "string" ||
        !SOURCE_COMMIT_REGEX.test(record.sourceCommit)) {
        throw new Error(`Invalid sourceCommit: ${record.sourceCommit}`);
    }
    const sourceCommit = record.sourceCommit;
    if (typeof record.deployer !== "string" ||
        !EVM_ADDRESS_REGEX.test(record.deployer)) {
        throw new Error(`Invalid deployer address: ${record.deployer}`);
    }
    const deployer = record.deployer.toLowerCase();
    if (typeof record.deployedAt !== "string" ||
        !ISO_TIMESTAMP_REGEX.test(record.deployedAt) ||
        Number.isNaN(Date.parse(record.deployedAt))) {
        throw new Error(`Invalid deployedAt timestamp: ${record.deployedAt}`);
    }
    const deployedAt = record.deployedAt;
    // Contracts
    if (typeof record.contracts !== "object" ||
        record.contracts === null ||
        Array.isArray(record.contracts)) {
        throw new Error("Invalid contracts: expected object.");
    }
    const contractsObj = record.contracts;
    const contractKeys = Object.keys(contractsObj);
    if (contractKeys.length !== 1 || contractKeys[0] !== "ClarioRegistry") {
        throw new Error(`Invalid contracts: exact key ClarioRegistry required, got [${contractKeys.join(", ")}]`);
    }
    const clarioReg = contractsObj.ClarioRegistry;
    const expectedContractKeys = [
        "address",
        "deploymentBlock",
        "transactionHash",
        "abiHash",
        "verifiedSourceUrl",
    ].sort();
    const actualContractKeys = Object.keys(clarioReg).sort();
    if (actualContractKeys.length !== expectedContractKeys.length ||
        actualContractKeys.some((k, i) => k !== expectedContractKeys[i])) {
        throw new Error(`Invalid ClarioRegistry keys: [${actualContractKeys.join(", ")}]`);
    }
    if (typeof clarioReg.address !== "string" ||
        !EVM_ADDRESS_REGEX.test(clarioReg.address)) {
        throw new Error(`Invalid ClarioRegistry address: ${clarioReg.address}`);
    }
    if (typeof clarioReg.deploymentBlock !== "number" ||
        !Number.isInteger(clarioReg.deploymentBlock) ||
        clarioReg.deploymentBlock < 0) {
        throw new Error(`Invalid ClarioRegistry deploymentBlock: ${clarioReg.deploymentBlock}`);
    }
    if (typeof clarioReg.transactionHash !== "string" ||
        !EVM_HASH_REGEX.test(clarioReg.transactionHash)) {
        throw new Error(`Invalid ClarioRegistry transactionHash: ${clarioReg.transactionHash}`);
    }
    if (typeof clarioReg.abiHash !== "string" ||
        !EVM_HASH_REGEX.test(clarioReg.abiHash)) {
        throw new Error(`Invalid ClarioRegistry abiHash: ${clarioReg.abiHash}`);
    }
    const requireHttps = environment !== "local";
    if (requireHttps) {
        if (typeof clarioReg.verifiedSourceUrl !== "string" ||
            !clarioReg.verifiedSourceUrl.startsWith("https://")) {
            throw new Error(`ClarioRegistry.verifiedSourceUrl must be an HTTPS URL in non-local environments`);
        }
    }
    else {
        if (clarioReg.verifiedSourceUrl !== null &&
            typeof clarioReg.verifiedSourceUrl !== "string") {
            throw new Error(`Invalid ClarioRegistry verifiedSourceUrl`);
        }
    }
    // Tokens
    if (typeof record.tokens !== "object" ||
        record.tokens === null ||
        Array.isArray(record.tokens)) {
        throw new Error("Invalid tokens: expected object.");
    }
    const tokensObj = record.tokens;
    const tokenKeys = Object.keys(tokensObj);
    if (tokenKeys.length !== 1 || tokenKeys[0] !== "USDC") {
        throw new Error(`Invalid tokens: exact key USDC required, got [${tokenKeys.join(", ")}]`);
    }
    const usdcObj = tokensObj.USDC;
    const expectedTokenKeys = ["address", "decimals"].sort();
    const actualTokenKeys = Object.keys(usdcObj).sort();
    if (actualTokenKeys.length !== expectedTokenKeys.length ||
        actualTokenKeys.some((k, i) => k !== expectedTokenKeys[i])) {
        throw new Error(`Invalid USDC keys: [${actualTokenKeys.join(", ")}]`);
    }
    if (typeof usdcObj.address !== "string" ||
        !EVM_ADDRESS_REGEX.test(usdcObj.address)) {
        throw new Error(`Invalid USDC address: ${usdcObj.address}`);
    }
    if (typeof usdcObj.decimals !== "number" ||
        !Number.isInteger(usdcObj.decimals) ||
        usdcObj.decimals < 0 ||
        usdcObj.decimals > 255) {
        throw new Error(`Invalid USDC decimals: ${usdcObj.decimals}`);
    }
    return {
        schemaVersion: 1,
        environment,
        sourceCommit,
        chainFamily,
        chainId,
        deployer,
        deployedAt,
        contracts: {
            ClarioRegistry: {
                address: clarioReg.address.toLowerCase(),
                deploymentBlock: clarioReg.deploymentBlock,
                transactionHash: clarioReg.transactionHash.toLowerCase(),
                abiHash: clarioReg.abiHash.toLowerCase(),
                verifiedSourceUrl: clarioReg.verifiedSourceUrl,
            },
        },
        tokens: {
            USDC: {
                address: usdcObj.address.toLowerCase(),
                decimals: usdcObj.decimals,
            },
        },
    };
}
/**
 * Writes the deployment manifest to disk.
 * Enforces overwrite protection: throws an Error if the destination file exists and force is false.
 */
export function saveDeploymentManifest(options) {
    const { filePath, manifest, force = false } = options;
    const validated = validateDeploymentManifest(manifest);
    if (fs.existsSync(filePath) && !force) {
        throw new Error(`Deployment manifest already exists at: ${filePath}. Re-running will not overwrite an existing manifest silently. Pass --force to overwrite.`);
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(validated, null, 2) + "\n", "utf8");
}
//# sourceMappingURL=manifest.js.map