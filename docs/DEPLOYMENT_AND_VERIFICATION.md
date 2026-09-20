# Clario Protocol Deployment and Source-Verification Runbook

**Status:** Authoritative protocol tooling runbook  
**Target Chains:** Monad (Local Anvil, Preview/Testnet, Staging, Production)  
**Governing Documents:** [RULES.md](../RULES.md) · [architecture.md](../architecture.md) · [TASKS.md](../TASKS.md)

---

## 1. Overview

Clario on Monad consists of four modular registries coordinated by a single anchor directory, `ClarioRegistry`:

```text
ClarioWorkspaceRegistryV1 (Roles, Policy History)
         │
         ├─── ClarioExpenseRegistryV1 (Immutable Versions, Supersession)
         │           │
         │           ├─── ClarioDecisionRegistryV1 (Exact-Version Approval, EIP-712)
         │           │           │
         └───────────┴───────────┴─── ClarioSettlementRegistryV1 (Reimbursement, Duplicate Guard)
                                                 │
                                                 ▼
                                        ClarioRegistry (Coordinator & Manifest Anchor)
```

The runtime configuration and web application consume contract addresses solely through a frozen `DeploymentManifest` conforming to schema version 1 (`apps/web/src/config/schema.ts`). Direct or raw address environment variables are strictly forbidden (`RULES.md` R-010, Section 14).

---

## 2. Compiler Settings & Reproducibility Baseline

All contracts are compiled using Foundry with pinned compiler parameters defined in `contracts/foundry.toml`:

- **Solidity Compiler Version:** `0.8.30`
- **Optimizer:** Enabled (`true`)
- **Optimizer Runs:** `200`
- **EVM Target:** Default (`osaka` / Monad-compatible)

To compile all contract artifacts:
```bash
forge build --root contracts
```
Compiled artifacts are output to `contracts/out/`.

---

## 3. Dry-Run / Simulation Mode

Before executing any deployment, operators can run a simulation that verifies contract bytecodes, estimates deployment gas, computes ABI hashes, and outputs a simulated deployment manifest without broadcasting transactions or mutating onchain state:

```bash
pnpm deploy:contracts --dry-run
```
Or with custom parameters:
```bash
node scripts/deploy.mjs --env local --rpc http://127.0.0.1:8545 --dry-run
```

The tool reports:
- Bytecode availability and integrity.
- Estimated gas for each deployment step.
- Simulated `DeploymentManifest` validated against schema version 1.
- Confirmation that no state was mutated.

---

## 4. Local EVM Deployment & Manifest Generation

### Step 1: Start Local Anvil Node
In a separate terminal or service runner:
```bash
anvil --port 8545
```

### Step 2: Run Deployment
```bash
pnpm deploy:contracts --env local --out deployments/local/deployment-manifest.json
```

### Step 3: Deployment Sequence
The tool deterministically deploys contracts in strict dependency order:
1. `ClarioWorkspaceRegistryV1`
2. `ClarioExpenseRegistryV1` (bound to `WorkspaceRegistry`)
3. `ClarioDecisionRegistryV1` (bound to `WorkspaceRegistry` and `ExpenseRegistry`)
4. `ClarioSettlementRegistryV1` (bound to `WorkspaceRegistry`, `ExpenseRegistry`, and `DecisionRegistry`)
5. `ClarioRegistry` (binding all four registries as immutable module pointers)
6. `MockUSDC` (6-decimal token deployed automatically for local test environments)

### Step 4: Receipt Capture and Manifest Writing
The deployment tool captures actual receipts:
- Real contract addresses.
- Real deployment block numbers.
- Real transaction hashes.
- Exact 32-byte keccak256 ABI hash computed via RFC 8785 canonical JSON.

The manifest is validated against `parseDeploymentManifest` before being written to disk.

---

## 5. Silent Overwrite Protection

Per `RULES.md` Section 15.2 ("Never overwrite a previous deployment record"), the deployment tool prevents accidental erasure of existing deployment records:

- If the output manifest file already exists, re-running the deployment tool **fails immediately** with:
  ```text
  Deployment manifest already exists at: <path>. Re-running will not overwrite an existing manifest silently. Pass --force to overwrite.
  ```
- To intentionally overwrite an existing manifest (e.g. during fresh local development iteration), the operator must supply the explicit `--force` flag:
  ```bash
  node scripts/deploy.mjs --env local --force
  ```

---

## 6. Monad Network Deployment (Non-Local Environments)

> [!CAUTION]
> **Explicit Human Authorization Required**  
> Per `RULES.md` Section 15.2 and `AGENTS.md`, no agent or automated script may deploy, sign, broadcast, or move funds on public or live networks without explicit human founder authorization.

When authorized by a human founder for preview, staging, or production:

1. Confirm target network, chain ID, and RPC URL from official Monad documentation.
2. Confirm the deployer address and funding.
3. Confirm the official verified USDC address on the target network.
4. Confirm git source commit is clean.
5. Execute deployment:
   ```bash
   node scripts/deploy.mjs \
     --env preview \
     --rpc https://testnet-rpc.monad.xyz \
     --pk <DEPLOYER_PRIVATE_KEY> \
     --usdc <VERIFIED_USDC_ADDRESS> \
     --commit <40_HEX_COMMIT_HASH> \
     --verified-url https://testnet.monadexplorer.com/address/<REGISTRY_ADDRESS> \
     --out deployments/preview/deployment-manifest.json
   ```

---

## 7. Source Verification Runbook

### Inspecting Deployment and Generating Verification Commands
Use `scripts/verify.mjs` to inspect a manifest and generate reproducible `forge verify-contract` commands:

```bash
node scripts/verify.mjs --manifest deployments/local/deployment-manifest.json
```

Or for a live network (checking onchain bytecode and targeting Sourcify or Monad Explorer):
```bash
node scripts/verify.mjs \
  --manifest deployments/preview/deployment-manifest.json \
  --rpc https://testnet-rpc.monad.xyz \
  --verifier sourcify
```

### Manual Verification Commands

For each deployed contract, execute `forge verify-contract` using the exact compiler settings:

#### 1. ClarioWorkspaceRegistryV1
```bash
forge verify-contract --root contracts \
  <WORKSPACE_REGISTRY_ADDRESS> \
  src/protocol/v1/ClarioWorkspaceRegistryV1.sol:ClarioWorkspaceRegistryV1 \
  --compiler-version 0.8.30 \
  --num-of-optimizations 200 \
  --verifier sourcify \
  --chain-id <CHAIN_ID>
```

#### 2. ClarioExpenseRegistryV1
```bash
forge verify-contract --root contracts \
  <EXPENSE_REGISTRY_ADDRESS> \
  src/protocol/v1/ClarioExpenseRegistryV1.sol:ClarioExpenseRegistryV1 \
  --compiler-version 0.8.30 \
  --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(address)" <WORKSPACE_REGISTRY_ADDRESS>) \
  --verifier sourcify \
  --chain-id <CHAIN_ID>
```

#### 3. ClarioDecisionRegistryV1
```bash
forge verify-contract --root contracts \
  <DECISION_REGISTRY_ADDRESS> \
  src/protocol/v1/ClarioDecisionRegistryV1.sol:ClarioDecisionRegistryV1 \
  --compiler-version 0.8.30 \
  --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(address,address)" <WORKSPACE_REGISTRY_ADDRESS> <EXPENSE_REGISTRY_ADDRESS>) \
  --verifier sourcify \
  --chain-id <CHAIN_ID>
```

#### 4. ClarioSettlementRegistryV1
```bash
forge verify-contract --root contracts \
  <SETTLEMENT_REGISTRY_ADDRESS> \
  src/protocol/v1/ClarioSettlementRegistryV1.sol:ClarioSettlementRegistryV1 \
  --compiler-version 0.8.30 \
  --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" <WORKSPACE_REGISTRY_ADDRESS> <EXPENSE_REGISTRY_ADDRESS> <DECISION_REGISTRY_ADDRESS>) \
  --verifier sourcify \
  --chain-id <CHAIN_ID>
```

#### 5. ClarioRegistry
```bash
forge verify-contract --root contracts \
  <CLARIO_REGISTRY_ADDRESS> \
  src/protocol/v1/ClarioRegistry.sol:ClarioRegistry \
  --compiler-version 0.8.30 \
  --num-of-optimizations 200 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" <WORKSPACE_REGISTRY_ADDRESS> <EXPENSE_REGISTRY_ADDRESS> <DECISION_REGISTRY_ADDRESS> <SETTLEMENT_REGISTRY_ADDRESS>) \
  --verifier sourcify \
  --chain-id <CHAIN_ID>
```
