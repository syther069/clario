export declare const DEPLOYMENT_ENVIRONMENTS: readonly ["local", "preview", "staging", "production"];
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];
export type DeploymentChainFamily = "local" | "monad";
export interface DeploymentContractInfo {
    readonly address: string;
    readonly deploymentBlock: number;
    readonly transactionHash: string;
    readonly abiHash: string;
    readonly verifiedSourceUrl: string | null;
}
export interface DeploymentTokenInfo {
    readonly address: string;
    readonly decimals: number;
}
export interface DeploymentManifest {
    readonly schemaVersion: 1;
    readonly environment: DeploymentEnvironment;
    readonly sourceCommit: string;
    readonly chainFamily: DeploymentChainFamily;
    readonly chainId: number;
    readonly deployer: string;
    readonly deployedAt: string;
    readonly contracts: {
        readonly ClarioRegistry: DeploymentContractInfo;
    };
    readonly tokens: {
        readonly USDC: DeploymentTokenInfo;
    };
}
/**
 * Computes the deterministic 32-byte keccak256 hash of a contract ABI
 * using RFC 8785 JSON canonicalization.
 */
export declare function computeAbiHash(abi: readonly unknown[]): string;
/**
 * Validates a DeploymentManifest against schema version 1 requirements.
 * Throws an Error if any field is missing, extra, or malformed.
 */
export declare function validateDeploymentManifest(manifest: unknown): DeploymentManifest;
export interface SaveManifestOptions {
    readonly filePath: string;
    readonly manifest: DeploymentManifest;
    readonly force?: boolean;
}
/**
 * Writes the deployment manifest to disk.
 * Enforces overwrite protection: throws an Error if the destination file exists and force is false.
 */
export declare function saveDeploymentManifest(options: SaveManifestOptions): void;
//# sourceMappingURL=manifest.d.ts.map