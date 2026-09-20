# Clario Canonical Expense Schema v1 Specification

**Status:** Canonical Protocol Specification  
**Version:** 1.0.0  
**Schema Identifier:** `https://clario.xyz/schemas/v1/expense.json`  
**Domain Identifier:** `CLARIO_EXPENSE_V1`  
**Governing Documents:** [RULES.md](../RULES.md) · [architecture.md](../architecture.md) · [prd.md](../prd.md)

---

## 1. Purpose & Scope

This document specifies the canonical byte-level representation, field definitions, normalization rules, and commitment construction for Clario Expense Version 1 records and Evidence Manifests.

Any software generating, storing, reviewing, or verifying Clario expense commitments must adhere to this specification. Two independent implementations given the same inputs must produce the exact same commitment byte-for-byte.

---

## 2. Protocol Constants & Domain Separation

To prevent cross-domain, cross-contract, cross-workspace, and cross-chain replay attacks, all cryptographic digests incorporate explicit domain separators:

| Constant Name | Type | Value / Definition |
|---|---|---|
| `CLARIO_SCHEMA_VERSION_V1` | `uint32` | `1` |
| `CLARIO_EXPENSE_DOMAIN_NAME` | `string` | `"Clario Expense Protocol"` |
| `CLARIO_EXPENSE_DOMAIN_VERSION` | `string` | `"1"` |
| `CLARIO_EXPENSE_V1_DOMAIN` | `bytes32` | `keccak256("CLARIO_EXPENSE_V1")` = `0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8` |
| `CLARIO_EVIDENCE_V1_DOMAIN` | `bytes32` | `keccak256("CLARIO_EVIDENCE_V1")` = `0x9c3f350cbfcb9eb908d1f855e4bf5e592756041c2c31e780fa9971ee6a22533c` |
| `SALT_BYTE_LENGTH` | `integer` | `32` (256 bits of cryptographically secure randomness) |

---

## 3. Data Privacy Classification

Every field in the Clario protocol belongs to one of four strict privacy classes:

1. **`PUBLIC`**: Permitted to cross into public onchain calldata, public events, or unauthenticated query endpoints. Must be opaque or explicitly approved for public settlement.
2. **`WORKSPACE_CONFIDENTIAL`**: Business metadata stored encrypted in the operational database. Accessible only by authenticated, authorized members of the owning workspace. Never emitted in events, public calldata, or indexer entities.
3. **`EVIDENCE_CONFIDENTIAL`**: Private receipts, invoices, attachments, and extracted OCR text. Envelope-encrypted in object storage. Requires object-level authorization for access.
4. **`SECURITY_SENSITIVE`**: Random salts, encryption keys, and session tokens. Must never be logged, published, or stored alongside public commitments. Disclosed only in authorized, intentional audit packages.

---

## 4. Materiality & Supersession Rules

In accordance with Founder Invariant **R-003** and **R-005**:
- A field is marked **`MATERIAL`** if any modification to its value in a successor version invalidates prior approvals and forces the expense into `REAPPROVAL_REQUIRED` state.
- A field is marked **`NON_MATERIAL`** if it provides purely operational, display, or workspace-internal notes that do not alter the financial, evidentiary, or settlement terms approved by the reviewer.

---

## 5. Schema Field Definitions

### 5.1 Canonical Expense Record (`CanonicalExpenseV1`)

The canonical expense record captures the complete business and financial terms of the expense version.

| Field Name | Type | Presence | Privacy Class | Materiality | Description / Constraints |
|---|---|---|---|---|---|
| `schemaVersion` | `uint32` | Required | `PUBLIC` | `MATERIAL` | Fixed value: `1`. |
| `workspaceId` | `bytes32` | Required | `PUBLIC` | `MATERIAL` | Opaque workspace identifier formatted as `0x` followed by 64 lowercase hex characters. |
| `expenseId` | `bytes32` | Required | `PUBLIC` | `MATERIAL` | Opaque expense identifier formatted as `0x` followed by 64 lowercase hex characters. Never derived from private fields. |
| `version` | `uint32` | Required | `PUBLIC` | `MATERIAL` | Monotonically increasing version integer (`1, 2, 3...`). Version 1 has no predecessor. |
| `title` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Plain-text summary title. 1–200 UTF-8 characters. NFC normalized. |
| `businessPurpose` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Justification for the expense. 1–4000 UTF-8 characters. NFC normalized. |
| `category` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Budget/reporting category (e.g., `"travel"`, `"software"`, `"contractor"`). 1–100 characters. |
| `project` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Associated project or cost center code. 1–100 characters. |
| `merchant` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Vendor or merchant name. 1–200 characters. |
| `expenseDate` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Date the expense occurred, in ISO 8601 UTC date format (`YYYY-MM-DD`). |
| `claimAmount` | `string` | Required | `PUBLIC` | `MATERIAL` | Integer amount in token base units represented as an unsigned decimal string (e.g., `"1000000"` for 1.000000 USDC with 6 decimals). No leading zeros except `"0"`. |
| `claimAsset` | `address` | Required | `PUBLIC` | `MATERIAL` | Address of the settlement token contract on Monad. Normalized as `0x` followed by 40 lowercase hex characters. |
| `recipient` | `address` | Required | `PUBLIC` | `MATERIAL` | Checksummed/normalized address of the reimbursement payee. Normalized as `0x` followed by 40 lowercase hex characters. |
| `paymentSource` | `string` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Enum: `"imported_transaction"`, `"transaction_hash"`, or `"manual"`. |
| `sourceChainId` | `uint64` / `null` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Positive integer source chain ID if imported/hash; `null` if manual. |
| `sourceTransactionHash` | `bytes32` / `null` | Required | `WORKSPACE_CONFIDENTIAL` | `MATERIAL` | Hex string `0x...` (64 hex chars) if imported/hash; `null` if manual. |
| `evidenceManifestHash` | `bytes32` | Required | `PUBLIC` | `MATERIAL` | Keccak-256 digest of the canonical evidence manifest. `0x` + 64 lowercase hex characters. |
| `submittedBy` | `address` | Required | `PUBLIC` | `MATERIAL` | Submitter wallet address. `0x` + 40 lowercase hex characters. |
| `submittedAt` | `string` | Required | `PUBLIC` | `MATERIAL` | Submission timestamp in ISO 8601 UTC extended format: `YYYY-MM-DDTHH:MM:SSZ`. |
| `client` | `string` / `null` | Optional | `WORKSPACE_CONFIDENTIAL` | `NON_MATERIAL` | Optional client name or identifier; `null` if absent. |
| `invoiceNumber` | `string` / `null` | Optional | `WORKSPACE_CONFIDENTIAL` | `NON_MATERIAL` | Optional vendor invoice number; `null` if absent. |
| `location` | `string` / `null` | Optional | `WORKSPACE_CONFIDENTIAL` | `NON_MATERIAL` | Optional physical or jurisdictional location; `null` if absent. |
| `notes` | `string` / `null` | Optional | `WORKSPACE_CONFIDENTIAL` | `NON_MATERIAL` | Optional internal notes; `null` if absent. |
| `tags` | `array<string>` | Required | `WORKSPACE_CONFIDENTIAL` | `NON_MATERIAL` | Array of label strings. Must be sorted lexicographically and deduplicated. Empty array `[]` if none. |

---

### 5.2 Canonical Evidence Manifest (`CanonicalEvidenceManifestV1`)

The evidence manifest anchors the set of attached documents, receipts, and invoices without exposing file content or location.

| Field Name | Type | Presence | Description / Constraints |
|---|---|---|---|
| `manifestVersion` | `uint32` | Required | Fixed value: `1`. |
| `entries` | `array<EvidenceEntry>` | Required | Array of evidence entries sorted strictly by ascending `evidenceId`. |
| `previousManifestHash` | `bytes32` / `null` | Required | `0x` + 64 hex characters referencing prior version's manifest hash; `null` for version 1. |

#### Evidence Entry (`EvidenceEntry`)

Each entry in `entries` represents one attached file:

| Field Name | Type | Constraints |
|---|---|---|
| `evidenceId` | `string` | Unique identifier (e.g. UUIDv4). ASCII, lowercase, 1–64 characters. |
| `mimeType` | `string` | Allowed MIME types: `"application/pdf"`, `"image/png"`, `"image/jpeg"`. |
| `sizeBytes` | `uint64` | Positive integer file size in bytes (maximum 25 MB = 26,214,400 bytes). |
| `plaintextHash` | `bytes32` | SHA-256 digest of original unencrypted file: `0x` + 64 lowercase hex characters. |
| `ciphertextHash` | `bytes32` | SHA-256 digest of encrypted storage object: `0x` + 64 lowercase hex characters. |
| `uploadedAt` | `string` | ISO 8601 UTC timestamp: `YYYY-MM-DDTHH:MM:SSZ`. |

---

## 6. Canonical Normalization & Encoding Rules

To ensure exact cross-runtime reproducibility across JavaScript/TypeScript, Solidity, Python, Go, and Rust:

### 6.1 String & Unicode Normalization
- All string values must be normalized using Unicode **Normalization Form C (NFC)** before hashing.
- Strings must be encoded as UTF-8 without byte-order marks (BOM).
- Control characters (U+0000 through U+001F) other than standard whitespace are rejected.

### 6.2 Address Normalization
- Ethereum / EVM addresses must be converted to lowercase hexadecimal strings prefixed with `0x`, exactly 42 characters long (`^0x[0-9a-f]{40}$`).
- When ABI-encoded into Solidity calldata, they are decoded into standard 20-byte `address` types.

### 6.3 Hexadecimal & Byte Normalization
- All hash values and byte sequences (`bytes32`) must be represented as lowercase strings prefixed with `0x`, exactly 66 characters long (`^0x[0-9a-f]{64}$`).

### 6.4 Numeric Representation
- Chain IDs, schema versions, and version counters are represented as unsigned integers.
- Monetary amounts (`claimAmount`) must be represented in **integer base units** as string decimals (e.g., `"1500000"` for $1.50 USDC with 6 decimals). Floating-point numbers are strictly prohibited.

### 6.5 Timestamps
- Dates (`expenseDate`) must use ISO 8601 calendar date format: `YYYY-MM-DD`.
- Timestamps (`submittedAt`, `uploadedAt`) must use ISO 8601 UTC extended format: `YYYY-MM-DDTHH:MM:SSZ` with zero offset (`Z`). Fractional seconds must be omitted.

### 6.6 Arrays & Ordering
- Object keys in canonical JSON must be sorted strictly by UTF-16 code units (ASCII lexicographical order), matching RFC 8785 (JSON Canonicalization Scheme - JCS).
- In the expense record, `tags` must be deduplicated and sorted lexicographically in ascending order.
- In the evidence manifest, `entries` must be sorted strictly by ascending `evidenceId`.

### 6.7 Serialization (RFC 8785 / JCS)
- Canonical JSON strings must omit all unnecessary whitespace (no spaces between keys, colons, commas, or brackets).
- Empty or optional absent fields must use `null`, never an omitted key or empty string unless explicitly typed.

---

## 7. Cryptographic Commitment Construction

The final onchain commitment binds the canonical private expense record, the canonical evidence manifest, the public workflow routing parameters, and a high-entropy secret salt.

### 7.1 Digest Pipeline

```text
1. canonicalExpenseBytes = JCS(CanonicalExpenseV1)
   privateRecordHash     = keccak256(canonicalExpenseBytes)

2. canonicalManifestBytes = JCS(CanonicalEvidenceManifestV1)
   evidenceManifestHash   = keccak256(canonicalManifestBytes)

3. versionCommitment = keccak256(abi.encode(
       CLARIO_EXPENSE_V1_DOMAIN,     // bytes32
       monadChainId,                 // uint256
       registryAddress,              // address
       workspaceId,                  // bytes32
       expenseId,                    // bytes32
       version,                      // uint32
       privateRecordHash,            // bytes32
       evidenceManifestHash,         // bytes32
       random32ByteSalt              // bytes32
   ))
```

### 7.2 Salt Requirements (R-203, R-204)
- `random32ByteSalt` must be generated from a cryptographically secure pseudorandom number generator (CSPRNG).
- Reusing a salt across versions or expenses is a catastrophic security failure.
- Salts must be kept offchain and stored separately from commitments.

---

## 8. Versioning & Backward Compatibility

1. **Schema Version Identifier:** The schema version integer `1` is embedded in the canonical record, manifest, and commitment domain.
2. **Immutability of v1:** Once frozen, this schema specification cannot be modified in place.
3. **Upgrades:** Any structural addition, removal, or reinterpretation of fields requires a new specification (`v2`) with a distinct domain separator (e.g. `CLARIO_EXPENSE_V2_DOMAIN`).
4. **Verifier Compatibility:** Verifiers must inspect `schemaVersion` and route validation to the corresponding canonical specification.

---

## 9. Reference Implementations

### 9.1 TypeScript / Node Reference Implementation

```typescript
export function canonicalizeJson(obj: unknown): string {
  // Deterministic JSON canonicalization adhering to RFC 8785
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}
```

### 9.2 Solidity Verification Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

library ClarioCommitmentV1 {
    bytes32 public constant CLARIO_EXPENSE_V1_DOMAIN =
        keccak256(bytes("CLARIO_EXPENSE_V1"));

    function verifyCommitment(
        uint256 chainId,
        address registry,
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 privateRecordHash,
        bytes32 evidenceManifestHash,
        bytes32 salt,
        bytes32 expectedCommitment
    ) internal pure returns (bool) {
        bytes32 computed = keccak256(
            abi.encode(
                CLARIO_EXPENSE_V1_DOMAIN,
                chainId,
                registry,
                workspaceId,
                expenseId,
                version,
                privateRecordHash,
                evidenceManifestHash,
                salt
            )
        );
        return computed == expectedCommitment;
    }
}
```
