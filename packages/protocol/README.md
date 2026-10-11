# @clario/protocol

Shared canonical protocol schemas, cryptographic hashing libraries, golden vectors, and independent export verification engine for the Clario platform.

---

## Capabilities

- **Canonical Schema v1**: Type definitions and JSON normalization adhering to the canonical schema standard.
- **Deterministic Hashing**: RFC 8785 JSON canonicalization (`canonicalize`) and salted SHA-256 commitment generation.
- **EIP-712 Typed Data**: Decision domain separation, signing structures, and hash calculation for exact-version human reviewer approvals.
- **Export Package Verification**: Standalone verification engine capable of validating Clario ZIP packages against Monad onchain state without backend authentication.
- **Cross-Runtime Golden Vectors**: Verified cryptographic test fixtures ensuring parity between TypeScript and Solidity implementations.

---

## Build & Test

```bash
# Build package
pnpm --filter @clario/protocol build

# Run unit and golden vector tests
pnpm --filter @clario/protocol test
```
