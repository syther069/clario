import * as fs from "node:fs";
import * as path from "node:path";
import { createPublicClient, createWalletClient, http, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { computeAbiHash, validateDeploymentManifest, } from "./manifest.js";
function loadArtifact(outDir, contractName) {
    const filePath = path.join(outDir, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Artifact not found at ${filePath}. Run 'forge build --root contracts' first.`);
    }
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const objectHex = content.bytecode.object.startsWith("0x")
        ? content.bytecode.object
        : `0x${content.bytecode.object}`;
    return {
        abi: content.abi,
        bytecode: { object: objectHex },
    };
}
// Standard default Anvil account #0 for local testing
const LOCAL_ANVIL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export async function deployClarioProtocol(options) {
    const { rpcUrl, environment, sourceCommit, dryRun = false, contractsOutDir = path.resolve(process.cwd(), "contracts", "out"), usdcAddress: configuredUsdc, verifiedSourceUrl = null, } = options;
    const privateKey = options.privateKey ||
        (environment === "local" ? LOCAL_ANVIL_PRIVATE_KEY : undefined);
    if (!privateKey) {
        throw new Error("Private key is required for deployment outside local default environment.");
    }
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({
        transport: http(rpcUrl),
    });
    let chainId;
    try {
        chainId = await publicClient.getChainId();
    }
    catch (err) {
        if (dryRun && environment === "local") {
            chainId = 31337;
        }
        else {
            throw err;
        }
    }
    // Load artifacts
    const workspaceArtifact = loadArtifact(contractsOutDir, "ClarioWorkspaceRegistryV1");
    const expenseArtifact = loadArtifact(contractsOutDir, "ClarioExpenseRegistryV1");
    const decisionArtifact = loadArtifact(contractsOutDir, "ClarioDecisionRegistryV1");
    const settlementArtifact = loadArtifact(contractsOutDir, "ClarioSettlementRegistryV1");
    const registryArtifact = loadArtifact(contractsOutDir, "ClarioRegistry");
    const mockUsdcArtifact = loadArtifact(contractsOutDir, "MockUSDC");
    const registryAbiHash = computeAbiHash(registryArtifact.abi);
    if (dryRun) {
        // In dry-run mode, estimate deployment gas and validate bytecode without broadcasting state changes
        try {
            await publicClient.estimateGas({
                account: account.address,
                data: workspaceArtifact.bytecode.object,
            });
            await publicClient.estimateGas({
                account: account.address,
                data: mockUsdcArtifact.bytecode.object,
            });
        }
        catch {
            // RPC offline or simulation mode without live EVM
        }
        const simulatedManifest = {
            schemaVersion: 1,
            environment,
            sourceCommit,
            chainFamily: environment === "local" ? "local" : "monad",
            chainId,
            deployer: account.address.toLowerCase(),
            deployedAt: new Date().toISOString(),
            contracts: {
                ClarioRegistry: {
                    address: "0x0000000000000000000000000000000000000001",
                    deploymentBlock: 0,
                    transactionHash: `0x${"0".repeat(64)}`,
                    abiHash: registryAbiHash.toLowerCase(),
                    verifiedSourceUrl: verifiedSourceUrl,
                },
            },
            tokens: {
                USDC: {
                    address: configuredUsdc
                        ? configuredUsdc.toLowerCase()
                        : "0x0000000000000000000000000000000000000002",
                    decimals: 6,
                },
            },
        };
        validateDeploymentManifest(simulatedManifest);
        return {
            manifest: simulatedManifest,
            receipts: {
                ClarioWorkspaceRegistryV1: {
                    name: "ClarioWorkspaceRegistryV1",
                    address: "0x0000000000000000000000000000000000000001",
                    deploymentBlock: 0,
                    transactionHash: `0x${"0".repeat(64)}`,
                    abiHash: computeAbiHash(workspaceArtifact.abi),
                },
            },
            isDryRun: true,
        };
    }
    // Real EVM deployment
    const walletClient = createWalletClient({
        account,
        transport: http(rpcUrl),
    });
    const receipts = {};
    async function deployContract(name, artifact, args = []) {
        const hash = await walletClient.deployContract({
            abi: artifact.abi,
            bytecode: artifact.bytecode.object,
            args: args,
            account,
            chain: null,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (!receipt.contractAddress) {
            throw new Error(`Deployment failed for ${name}: no contract address returned.`);
        }
        const abiHash = computeAbiHash(artifact.abi);
        receipts[name] = {
            name,
            address: receipt.contractAddress.toLowerCase(),
            deploymentBlock: Number(receipt.blockNumber),
            transactionHash: receipt.transactionHash.toLowerCase(),
            abiHash: abiHash.toLowerCase(),
        };
        return receipt.contractAddress;
    }
    // 1. Deploy WorkspaceRegistry
    const workspaceAddress = await deployContract("ClarioWorkspaceRegistryV1", workspaceArtifact);
    // 2. Deploy ExpenseRegistry
    const expenseAddress = await deployContract("ClarioExpenseRegistryV1", expenseArtifact, [workspaceAddress]);
    // 3. Deploy DecisionRegistry
    const decisionAddress = await deployContract("ClarioDecisionRegistryV1", decisionArtifact, [workspaceAddress, expenseAddress]);
    // 4. Deploy SettlementRegistry
    const settlementAddress = await deployContract("ClarioSettlementRegistryV1", settlementArtifact, [workspaceAddress, expenseAddress, decisionAddress]);
    // 5. Deploy ClarioRegistry
    const registryAddress = await deployContract("ClarioRegistry", registryArtifact, [workspaceAddress, expenseAddress, decisionAddress, settlementAddress]);
    // 6. Deploy or configure USDC
    let usdcAddress = configuredUsdc;
    if (!usdcAddress) {
        if (environment === "local") {
            usdcAddress = await deployContract("MockUSDC", mockUsdcArtifact);
        }
        else {
            throw new Error("A verified USDC address must be provided for non-local environments.");
        }
    }
    const registryReceipt = receipts["ClarioRegistry"];
    if (!registryReceipt) {
        throw new Error("Missing ClarioRegistry deployment receipt.");
    }
    const manifest = {
        schemaVersion: 1,
        environment,
        sourceCommit,
        chainFamily: environment === "local" ? "local" : "monad",
        chainId,
        deployer: account.address.toLowerCase(),
        deployedAt: new Date().toISOString(),
        contracts: {
            ClarioRegistry: {
                address: registryAddress.toLowerCase(),
                deploymentBlock: registryReceipt.deploymentBlock,
                transactionHash: registryReceipt.transactionHash.toLowerCase(),
                abiHash: registryReceipt.abiHash.toLowerCase(),
                verifiedSourceUrl: verifiedSourceUrl,
            },
        },
        tokens: {
            USDC: {
                address: usdcAddress.toLowerCase(),
                decimals: 6,
            },
        },
    };
    const validatedManifest = validateDeploymentManifest(manifest);
    return {
        manifest: validatedManifest,
        receipts,
        isDryRun: false,
    };
}
//# sourceMappingURL=deploy.js.map