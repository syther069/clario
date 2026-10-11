# Clario Smart Contracts

Foundry workspace for the Clario protocol smart contracts, deployed on **Monad Testnet** (`chainId: 10143`).

---

## Architecture Overview

Clario smart contracts provide deterministic onchain anchoring, role-based workspace governance, exact-version approvals, and non-custodial treasury settlements:

### 1. Live Monad Testnet Anchors (`src/`)
- **`ClarioTransactionRegistry.sol`**:
  - Live on Monad Testnet at [`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87).
  - Anchors individual transaction commitments (`saveTransaction`) and canonical multi-transaction receipt bundles (`saveReceipt`).
  - Emits real-time indexed events streamed via Alchemy Monad WebSockets to the web dashboard and cryptographic Proof Center (`/proof`).

### 2. Protocol v1 Governance Suite (`src/protocol/v1/`)
- **`ClarioRegistry.sol`**: Core coordinator anchoring modular protocol manifests and verified registry addresses.
- **`ClarioWorkspaceRegistryV1.sol`**: Workspace membership, role-based access control (`OWNER`, `ADMIN`, `APPROVER`, `TREASURY`, `AUDITOR`), and policy version history.
- **`ClarioExpenseRegistryV1.sol`**: Strictly monotonic immutable versioning (`v1`, `v2`, ...), predecessor commitments, and supersession tracking.
- **`ClarioDecisionRegistryV1.sol`**: EIP-712 human reviewer approval signatures bound to exact canonical version commitments.
- **`ClarioSettlementRegistryV1.sol`**: Non-custodial USDC treasury reimbursement with duplicate settlement protection and reentrancy guards.
- **`ClarioCommitmentV1.sol`**: Cryptographic hashing library implementing RFC 8785 canonical commitment verification.

---

## Build & Test

```bash
# Format check
forge fmt --check --root contracts

# Run all unit, fuzz, and integration tests
forge test --root contracts -vvv

# Compile contracts
forge build --root contracts
```

---

## Deployment & Verification

See the complete deployment runbook in [DEPLOYMENT_AND_VERIFICATION.md](../docs/DEPLOYMENT_AND_VERIFICATION.md).
