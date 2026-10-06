import { type Hex } from "viem";
import { type DeploymentEnvironment, type DeploymentManifest } from "./manifest.js";
export interface ArtifactJson {
    readonly abi: readonly unknown[];
    readonly bytecode: {
        readonly object: Hex;
    };
}
export interface DeploymentOptions {
    readonly rpcUrl: string;
    readonly privateKey?: Hex;
    readonly environment: DeploymentEnvironment;
    readonly sourceCommit: string;
    readonly dryRun?: boolean;
    readonly contractsOutDir?: string;
    readonly usdcAddress?: string;
    readonly verifiedSourceUrl?: string | null;
}
export interface DeployedContractReceipt {
    readonly name: string;
    readonly address: string;
    readonly deploymentBlock: number;
    readonly transactionHash: string;
    readonly abiHash: string;
}
export interface DeploymentResult {
    readonly manifest: DeploymentManifest;
    readonly receipts: Record<string, DeployedContractReceipt>;
    readonly isDryRun: boolean;
}
export declare function deployClarioProtocol(options: DeploymentOptions): Promise<DeploymentResult>;
//# sourceMappingURL=deploy.d.ts.map