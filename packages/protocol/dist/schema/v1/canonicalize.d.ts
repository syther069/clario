import type { CanonicalEvidenceManifestV1, CanonicalExpenseV1 } from "./types.js";
/**
 * Deterministically canonicalizes a JSON-compatible value according to RFC 8785 (JCS).
 * - Object properties are sorted by UTF-16 code units (ASCII lexicographical).
 * - Whitespace outside quotes is eliminated.
 * - Standard JSON primitive serialization without locale dependency.
 */
export declare function canonicalizeJson(value: unknown): string;
/**
 * Validates that a string is strictly normalized to Unicode Normalization Form C (NFC).
 */
export declare function assertNfcNormalized(str: string, fieldName: string): void;
/**
 * Validates and normalizes an input object against CanonicalExpenseV1 rules.
 */
export declare function validateCanonicalExpenseV1(input: unknown): CanonicalExpenseV1;
/**
 * Validates and normalizes an input object against CanonicalEvidenceManifestV1 rules.
 */
export declare function validateCanonicalEvidenceManifestV1(input: unknown): CanonicalEvidenceManifestV1;
//# sourceMappingURL=canonicalize.d.ts.map