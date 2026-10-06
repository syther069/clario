/**
 * Privacy classification of Clario protocol fields according to RULES.md and THREAT_MODEL.md.
 */
export type PrivacyClass = "PUBLIC" | "WORKSPACE_CONFIDENTIAL" | "EVIDENCE_CONFIDENTIAL" | "SECURITY_SENSITIVE";
/**
 * Materiality classification for expense version edits.
 * A MATERIAL field edit invalidates previous approvals and requires re-approval (REAPPROVAL_REQUIRED).
 */
export type MaterialityClass = "MATERIAL" | "NON_MATERIAL";
export type PaymentSourceV1 = "imported_transaction" | "transaction_hash" | "manual";
export interface FieldDefinition {
    readonly name: string;
    readonly type: string;
    readonly required: boolean;
    readonly privacy: PrivacyClass;
    readonly materiality: MaterialityClass;
    readonly description: string;
}
/**
 * Evidence Entry within the canonical evidence manifest.
 */
export interface EvidenceEntryV1 {
    readonly evidenceId: string;
    readonly mimeType: "application/pdf" | "image/png" | "image/jpeg";
    readonly sizeBytes: number;
    readonly plaintextHash: `0x${string}`;
    readonly ciphertextHash: `0x${string}`;
    readonly uploadedAt: string;
}
/**
 * Canonical Evidence Manifest v1.
 */
export interface CanonicalEvidenceManifestV1 {
    readonly manifestVersion: 1;
    readonly entries: readonly EvidenceEntryV1[];
    readonly previousManifestHash: `0x${string}` | null;
}
/**
 * Canonical Expense Record v1.
 * Represents the complete business and settlement terms of an expense version.
 */
export interface CanonicalExpenseV1 {
    readonly schemaVersion: 1;
    readonly workspaceId: `0x${string}`;
    readonly expenseId: `0x${string}`;
    readonly version: number;
    readonly title: string;
    readonly businessPurpose: string;
    readonly category: string;
    readonly project: string;
    readonly merchant: string;
    readonly expenseDate: string;
    readonly claimAmount: string;
    readonly claimAsset: `0x${string}`;
    readonly recipient: `0x${string}`;
    readonly paymentSource: PaymentSourceV1;
    readonly sourceChainId: number | null;
    readonly sourceTransactionHash: `0x${string}` | null;
    readonly evidenceManifestHash: `0x${string}`;
    readonly submittedBy: `0x${string}`;
    readonly submittedAt: string;
    readonly client: string | null;
    readonly invoiceNumber: string | null;
    readonly location: string | null;
    readonly notes: string | null;
    readonly tags: readonly string[];
}
export declare const CLARIO_SCHEMA_VERSION_V1: 1;
/**
 * keccak256("CLARIO_EXPENSE_V1")
 */
export declare const CLARIO_EXPENSE_V1_DOMAIN: "0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8";
/**
 * keccak256("CLARIO_EVIDENCE_V1")
 */
export declare const CLARIO_EVIDENCE_V1_DOMAIN: "0x9c3f350cbfcb9eb908d1f855e4bf5e592756041c2c31e780fa9971ee6a22533c";
export declare const SALT_BYTE_LENGTH: 32;
/**
 * Complete metadata table defining privacy and materiality for every field in CanonicalExpenseV1.
 */
export declare const EXPENSE_FIELD_DEFINITIONS_V1: readonly FieldDefinition[];
export declare const MATERIAL_EXPENSE_FIELDS_V1: readonly string[];
//# sourceMappingURL=types.d.ts.map