/**
 * Privacy classification of Clario protocol fields according to RULES.md and THREAT_MODEL.md.
 */
export type PrivacyClass =
  | "PUBLIC"
  | "WORKSPACE_CONFIDENTIAL"
  | "EVIDENCE_CONFIDENTIAL"
  | "SECURITY_SENSITIVE";

/**
 * Materiality classification for expense version edits.
 * A MATERIAL field edit invalidates previous approvals and requires re-approval (REAPPROVAL_REQUIRED).
 */
export type MaterialityClass = "MATERIAL" | "NON_MATERIAL";

export type PaymentSourceV1 =
  "imported_transaction" | "transaction_hash" | "manual";

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
  readonly uploadedAt: string; // ISO-8601 UTC YYYY-MM-DDTHH:MM:SSZ
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
  readonly expenseDate: string; // YYYY-MM-DD
  readonly claimAmount: string; // Integer base units as decimal string
  readonly claimAsset: `0x${string}`; // Monad token contract address
  readonly recipient: `0x${string}`; // Payee address
  readonly paymentSource: PaymentSourceV1;
  readonly sourceChainId: number | null;
  readonly sourceTransactionHash: `0x${string}` | null;
  readonly evidenceManifestHash: `0x${string}`;
  readonly submittedBy: `0x${string}`;
  readonly submittedAt: string; // ISO-8601 UTC YYYY-MM-DDTHH:MM:SSZ
  readonly client: string | null;
  readonly invoiceNumber: string | null;
  readonly location: string | null;
  readonly notes: string | null;
  readonly tags: readonly string[];
}

export const CLARIO_SCHEMA_VERSION_V1 = 1 as const;

/**
 * keccak256("CLARIO_EXPENSE_V1")
 */
export const CLARIO_EXPENSE_V1_DOMAIN =
  "0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8" as const;

/**
 * keccak256("CLARIO_EVIDENCE_V1")
 */
export const CLARIO_EVIDENCE_V1_DOMAIN =
  "0x9c3f350cbfcb9eb908d1f855e4bf5e592756041c2c31e780fa9971ee6a22533c" as const;

export const SALT_BYTE_LENGTH = 32 as const;

/**
 * Complete metadata table defining privacy and materiality for every field in CanonicalExpenseV1.
 */
export const EXPENSE_FIELD_DEFINITIONS_V1: readonly FieldDefinition[] = [
  {
    name: "schemaVersion",
    type: "uint32",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Protocol schema version (fixed 1)",
  },
  {
    name: "workspaceId",
    type: "bytes32",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Opaque workspace identifier",
  },
  {
    name: "expenseId",
    type: "bytes32",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Opaque expense identifier",
  },
  {
    name: "version",
    type: "uint32",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Monotonically increasing version number",
  },
  {
    name: "title",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Summary title of the expense",
  },
  {
    name: "businessPurpose",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Business justification for the expenditure",
  },
  {
    name: "category",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Accounting or budget category",
  },
  {
    name: "project",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Project or cost-center code",
  },
  {
    name: "merchant",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Vendor or merchant name",
  },
  {
    name: "expenseDate",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Date of expense in YYYY-MM-DD format",
  },
  {
    name: "claimAmount",
    type: "string",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Amount in integer token base units",
  },
  {
    name: "claimAsset",
    type: "address",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Monad settlement token contract address",
  },
  {
    name: "recipient",
    type: "address",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Payee reimbursement wallet address",
  },
  {
    name: "paymentSource",
    type: "string",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Source type (imported_transaction, transaction_hash, manual)",
  },
  {
    name: "sourceChainId",
    type: "uint64 | null",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Source chain ID if imported, null if manual",
  },
  {
    name: "sourceTransactionHash",
    type: "bytes32 | null",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "MATERIAL",
    description: "Source transaction hash if imported, null if manual",
  },
  {
    name: "evidenceManifestHash",
    type: "bytes32",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Keccak-256 hash of canonical evidence manifest",
  },
  {
    name: "submittedBy",
    type: "address",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Submitter wallet address",
  },
  {
    name: "submittedAt",
    type: "string",
    required: true,
    privacy: "PUBLIC",
    materiality: "MATERIAL",
    description: "Submission timestamp in ISO 8601 UTC format",
  },
  {
    name: "client",
    type: "string | null",
    required: false,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "NON_MATERIAL",
    description: "Optional client identifier",
  },
  {
    name: "invoiceNumber",
    type: "string | null",
    required: false,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "NON_MATERIAL",
    description: "Optional invoice reference number",
  },
  {
    name: "location",
    type: "string | null",
    required: false,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "NON_MATERIAL",
    description: "Optional location metadata",
  },
  {
    name: "notes",
    type: "string | null",
    required: false,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "NON_MATERIAL",
    description: "Optional internal review notes",
  },
  {
    name: "tags",
    type: "array<string>",
    required: true,
    privacy: "WORKSPACE_CONFIDENTIAL",
    materiality: "NON_MATERIAL",
    description: "Lexicographically sorted, deduplicated tags",
  },
] as const;

export const MATERIAL_EXPENSE_FIELDS_V1: readonly string[] =
  EXPENSE_FIELD_DEFINITIONS_V1.filter((f) => f.materiality === "MATERIAL").map(
    (f) => f.name,
  );
