export const CLARIO_SCHEMA_VERSION_V1 = 1;
/**
 * keccak256("CLARIO_EXPENSE_V1")
 */
export const CLARIO_EXPENSE_V1_DOMAIN = "0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8";
/**
 * keccak256("CLARIO_EVIDENCE_V1")
 */
export const CLARIO_EVIDENCE_V1_DOMAIN = "0x9c3f350cbfcb9eb908d1f855e4bf5e592756041c2c31e780fa9971ee6a22533c";
export const SALT_BYTE_LENGTH = 32;
/**
 * Complete metadata table defining privacy and materiality for every field in CanonicalExpenseV1.
 */
export const EXPENSE_FIELD_DEFINITIONS_V1 = [
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
];
export const MATERIAL_EXPENSE_FIELDS_V1 = EXPENSE_FIELD_DEFINITIONS_V1.filter((f) => f.materiality === "MATERIAL").map((f) => f.name);
//# sourceMappingURL=types.js.map