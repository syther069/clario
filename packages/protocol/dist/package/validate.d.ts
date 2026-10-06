import { type VerificationPackageManifestV1 } from "./types.js";
/**
 * Computes the SHA-256 hash of a file or string in lowercase hex (64 chars).
 */
export declare function computePackageFileHash(data: Buffer | Uint8Array | string): string;
/**
 * Computes the canonical SHA-256 hash of a package manifest (excluding optional exporterSignature).
 */
export declare function computeCanonicalManifestHash(manifest: VerificationPackageManifestV1): string;
/**
 * Validates a verification package manifest against schema rules.
 * Fails closed on any invalid or missing required field.
 */
export declare function validateVerificationPackageManifestV1(input: unknown): VerificationPackageManifestV1;
//# sourceMappingURL=validate.d.ts.map