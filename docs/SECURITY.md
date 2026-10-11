# Clario Security & Threat Model

**Status:** Production Security Specification  
**Classification:** Public Security Architecture  
**Target:** Monad Testnet (`chainId: 10143`) & EVM Protocol  

---

## 1. Security Philosophy & Objectives

Clario is engineered to keep private financial evidence confidential while making workflow integrity, reviewer authority, revision history, and settlement independently verifiable.

The primary objective is **not** to place sensitive records on public blockchains. It is to maintain a verifiable proof spine without ever disclosing private invoices, notes, merchant names, or employee data:

```text
Private Record + Evidence
  ──> Deterministic RFC 8785 Canonical Digest
  ──> Salted 32-Byte SHA-256 Commitment
  ──> Authorized EIP-712 Reviewer Signature
  ──> Onchain Monad Registration & Duplicate-Guarded Settlement
  ──> Deterministic Independent Verification
```

---

## 2. Cryptographic Invariants & System Guarantees

Clario enforces five inviolable architectural guarantees:

### 1. Private by Default
Receipts, invoices, merchant names, emails, private notes, salts, and encryption keys **never** appear in public calldata, events, URLs, logs, or unauthenticated query endpoints. Only deterministic 32-byte hashes combined with 256-bit cryptographically secure salts (`crypto.randomBytes(32)`) touch public blockspace.

### 2. Material Edits Create Immutable History
Any change to financial amounts, currencies, evidence attachments, or settlement terms creates a monotonic successor version (`v1`, `v2`, ...). Existing versions and their historical records are never overwritten. Predecessor links cryptographically chain versions together.

### 3. Exact-Version Reviewer Authority
Approvals bind cryptographically to `(workspaceId, expenseId, version, commitment, chainId, contractAddress)`. A modified record cannot inherit a prior version's approval. Any material edit immediately transitions the record to `REAPPROVAL_REQUIRED`.

### 4. Duplicate Reimbursement Prevention
A claim cannot be reimbursed more than once. Double-spend and double-reimbursement protection is enforced:
- **Onchain**: `ClarioSettlementRegistryV1` maintains an immutable `reimbursements` mapping indexed by `(workspaceId, expenseId, version)`. Replay attempts revert with `SettlementAlreadyCompleted`.
- **Database**: Partial unique constraints in PostgreSQL (`reimbursements` table) reject duplicate active settlements.

### 5. AI Has Zero Workflow Authority
AI models (Gemini 2.5 Flash, Groq) are strictly advisory. AI assists with OCR extraction and categorization suggestions. AI **cannot** approve, reject, sign, grant permissions, expose evidence, or initiate blockchain transactions. All financial actions require explicit human authentication and cryptographic signing.

---

## 3. Threat Model & Mitigation Matrix

| Threat ID | Threat Vector | Impact | Mitigation Strategy |
|---|---|---|---|
| **T-01** | Public Blockspace Leakage | High | 32-byte salted SHA-256 commitments. All evidence and plaintext remain offchain. |
| **T-02** | Signature Replay Across Workspaces / Chains | Critical | EIP-712 domain separation binding `chainId`, `verifyingContract`, `workspaceId`, and `nonce`. |
| **T-03** | Stale Approval Exploitation | High | Approval hash explicitly binds to the current version's canonical commitment. Edits invalidate approval. |
| **T-04** | Duplicate Settlement / Double Payout | Critical | Onchain mapping guard in `ClarioSettlementRegistryV1` + PostgreSQL partial unique constraint. |
| **T-05** | Unauthorized Evidence Access | High | AES-256-GCM envelope encryption. DEKs wrapped with server-side KEK; object-level RLS authorization. |
| **T-06** | AI Prompt Injection via Invoices | Medium | Fixed tool-free extraction prompts; strict Zod schema validation; zero execution tools granted to model. |
| **T-07** | Client PII Exfiltration to AI Providers | High | Client-side `anonymizeCopilotContext` scrubs names, emails, phones, and wallet addresses before external transmission. |
| **T-08** | RPC & Node Provider Man-in-the-Middle | Medium | Multi-tier RPC fallback; pre-flight simulation; deterministic local commitment calculation. |

---

## 4. Encryption & Key Hierarchy

Private documents (receipts, vendor invoices, tax documents) utilize envelope encryption:

1. **Data Encryption Key (DEK)**: A unique 256-bit AES key generated per evidence object.
2. **Encryption Algorithm**: AES-256-GCM with a 96-bit random initialization vector (IV) and canonicalized associated data (AAD).
3. **Key Encryption Key (KEK)**: The DEK is encrypted using a 256-bit KEK managed via external Key Management Service (KMS).
4. **Ciphertext Storage**: Encrypted bytes are persisted in secured object storage with strict Row Level Security (RLS). Plaintext keys are never written to database tables or logs.

---

## 5. Client-Side Privacy: Context Anonymization

When interacting with the optional AI financial copilot, Clario applies client-side sanitization (`anonymizeCopilotContext` in `apps/web/src/lib/ai/copilot-service.ts`) before any payload leaves the browser sandbox:

- Full names are replaced with deterministic aliases (`[USER]`).
- Email addresses are scrubbed with regex masks (`[EMAIL_REDACTED]`).
- Phone numbers are scrubbed with standard pattern masks (`[PHONE_REDACTED]`).
- EVM hexadecimal addresses (`0x...`) are truncated and obscured (`[WALLET_0x...ABCD]`).

---

## 6. Independent Verification Trust Boundary

The Clario verification package (`@clario/protocol`) is designed for untrusted environments:

- Requires **zero access** to Clario's backend servers, databases, or API keys.
- Reads disclosed evidence bytes, computes SHA-256 digests, and verifies canonical commitment reconstruction.
- Connects directly to any public Monad Testnet RPC endpoint to verify contract commitments, event emissions, and settlement receipts.
- Fails closed: any tampered byte, missing salt, altered amount, or conflicting onchain state yields an immediate `FAILED` result.

---

## 7. Responsible Disclosure

If you discover a security vulnerability within Clario contracts, web applications, or protocol packages, please disclose responsibly to security@useclario.xyz. We acknowledge and address valid security findings promptly.
