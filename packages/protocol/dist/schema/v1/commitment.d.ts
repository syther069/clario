import { type CanonicalEvidenceManifestV1, type CanonicalExpenseV1 } from "./types.js";
export interface ExpenseCommitmentParamsV1 {
    readonly monadChainId: bigint | number;
    readonly registryAddress: `0x${string}`;
    readonly workspaceId: `0x${string}`;
    readonly expenseId: `0x${string}`;
    readonly version: number;
    readonly privateRecordHash: `0x${string}`;
    readonly evidenceManifestHash: `0x${string}`;
    readonly salt: `0x${string}`;
}
/**
 * Validates and hashes a canonical expense record v1 to produce privateRecordHash.
 */
export declare function hashCanonicalExpenseV1(expense: CanonicalExpenseV1): `0x${string}`;
/**
 * Validates and hashes a canonical evidence manifest v1 to produce evidenceManifestHash.
 */
export declare function hashCanonicalEvidenceManifestV1(manifest: CanonicalEvidenceManifestV1): `0x${string}`;
/**
 * Validates parameters and constructs the canonical versionCommitment for Monad.
 *
 * commitment = keccak256(abi.encode(
 *     CLARIO_EXPENSE_V1_DOMAIN,
 *     monadChainId,
 *     registryAddress,
 *     workspaceId,
 *     expenseId,
 *     version,
 *     privateRecordHash,
 *     evidenceManifestHash,
 *     random32ByteSalt
 * ))
 */
export declare function computeExpenseCommitmentV1(params: ExpenseCommitmentParamsV1): `0x${string}`;
/**
 * Verifies a candidate commitment against expected parameters.
 */
export declare function verifyExpenseCommitmentV1(params: ExpenseCommitmentParamsV1, expectedCommitment: `0x${string}`): boolean;
//# sourceMappingURL=commitment.d.ts.map