# Monad Network and Supported Settlement Asset Provenance

**Status:** Verified primary-source provenance reference  
**Last Verified:** 2026-09-19  
**Source Authority:** Official Monad Documentation ([docs.monad.xyz](https://docs.monad.xyz))  
**Governing Rules:** [RULES.md](../RULES.md) §5.1, §10.4, §14 · [architecture.md](../architecture.md) §18 · [CANONICAL_SCHEMA_V1.md](./CANONICAL_SCHEMA_V1.md)

---

## 1. Purpose and Policy

Per `RULES.md` Section 5.1 and Section 10.4:
- "Contract, token, RPC, explorer, and chain values MUST come from validated environment configuration and a versioned deployment manifest."
- "Token addresses and decimals MUST come from verified configuration, not UI input or symbol lookup alone."
- "Current official Monad and issuer documentation MUST be checked before setting network or token addresses."
- Direct hardcoding of addresses or decimals into production product logic is strictly prohibited.

This document records the official primary-source provenance verified for the Monad Testnet settlement environment and its supported USDC token asset. These values are supplied to the deployment pipeline (`scripts/deploy.mjs`) and sealed into the versioned `DeploymentManifest` (`DEPLOYMENT_MANIFEST_JSON`), ensuring end-to-end traceability without embedding live addresses in code.

---

## 2. Monad Testnet Environment Provenance

| Parameter | Official Value | Primary Source |
|---|---|---|
| **Network Name** | Monad Testnet | [docs.monad.xyz](https://docs.monad.xyz) |
| **Chain ID** | `10143` | Official Monad Network Documentation |
| **Chain Family** | `monad` | Clario Architecture §18 |
| **Native Currency** | `MON` | Official Monad Documentation |
| **Primary RPC URL** | `https://testnet-rpc.monad.xyz` | Official Monad RPC Specification |
| **Foundation RPC URL** | `https://rpc-testnet.monadinfra.com` | Official Monad Infrastructure |
| **Block Explorer (Monadscan)** | `https://testnet.monadscan.com` | Official Monad Explorer |
| **Alternative Explorer** | `https://testnet.monadexplorer.com` | Monad Ecosystem Explorer |
| **Faucet** | `https://faucet.monad.xyz` | Official Monad Faucet |

---

## 3. Supported Reimbursement Asset Provenance (USDC)

| Parameter | Verified Value | Primary Source Verification |
|---|---|---|
| **Asset Symbol** | `USDC` | Monad "Tokens and Bridges" Documentation |
| **Asset Name** | USD Coin (Bridged / Native Testnet) | Official Monad Developer Hub |
| **Token Contract Address** | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Official Monad Documentation: Tokens & Bridges |
| **Decimals** | `6` | Standard USDC Implementation (ERC-20) |
| **Base Unit Representation** | Integer `uint256` string (1 USDC = 1,000,000 base units) | RFC 8785 / Canonical Schema v1 |
| **Transfer Method** | ERC-20 `safeTransferFrom` via `ClarioSettlementRegistryV1` | Contracts / `CHN-004` |

---

## 4. Local EVM Development Environment Provenance

For isolated local testing and development where live networks are not used (RULES §15.1):

| Parameter | Local Default Value | Notes |
|---|---|---|
| **Environment** | `local` | `APP_ENV=local` |
| **Chain Family** | `local` | `CHAIN_FAMILY=local` |
| **Chain ID** | `31337` (Anvil) or `1337` | Local EVM simulator |
| **RPC URL** | `http://127.0.0.1:8545` | Standard local node |
| **Settlement Asset** | `MockUSDC` (6 decimals) | Deterministically deployed by `scripts/deploy.mjs` for local environments |
| **Manifest Generation** | `node scripts/deploy.mjs --env local` | Captures local receipts |

---

## 5. Deployment Manifest Binding

To deploy to Monad Testnet and seal this provenance into a verifiable manifest:

```bash
node scripts/deploy.mjs \
  --env preview \
  --rpc https://testnet-rpc.monad.xyz \
  --usdc 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 \
  --commit <SOURCE_COMMIT_SHA> \
  --verified-url https://testnet.monadscan.com/address/<REGISTRY_ADDRESS> \
  --out deployments/preview/deployment-manifest.json
```

The resulting `deployment-manifest.json` is validated at application startup against `parseDeploymentManifest` in `apps/web/src/config/schema.ts`, ensuring that all runtime settlement calls strictly use the verified token address and decimals from the manifest.
