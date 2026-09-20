# Clario

Clario is a verifiable expense workflow for crypto-native teams. Private evidence stays encrypted offchain while immutable expense versions, authorized decisions, corrections, and settlement references are independently verifiable on Monad.

The repository is in **Phase 0 — Foundation**. Product workflows, contracts, providers, addresses, and deployments are not implemented yet.

## Read before contributing

1. [Project memory](./MEMORY.md)
2. [Engineering rules](./RULES.md)
3. [MVP threat model](./THREAT_MODEL.md)
4. [Implementation phases](./PHASES.md)
5. [Execution tasks](./TASKS.md)
6. [Product requirements](./prd.md)
7. [System architecture](./architecture.md)
8. [Design system](./DESIGN.md)

## Requirements

- Node.js `24.15.x`
- pnpm `11.19.x`
- Foundry with Forge `1.7.x`

Versions are pinned for reproducible founding work. Change them only through a reviewed dependency/toolchain update.

## Setup

```bash
pnpm install --frozen-lockfile
pnpm check
```

Before starting the app, copy `.env.example` to `.env.local` and replace its angle-bracket values with actual local-EVM values. Hosted environments additionally require a validated deployment manifest; see [System architecture](./architecture.md#183-deployment-manifest).

## Workspace

```text
apps/web/          Next.js PWA
packages/protocol/ Shared public protocol types and canonicalization boundary
contracts/         Foundry smart-contract workspace
```

The protocol package currently contains only a truthful initialization marker. Canonical expense types and commitment logic belong to `PRO-001..003` and must not be invented during foundation work.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the web workspace |
| `pnpm lint` | Lint TypeScript and React |
| `pnpm lint:contracts` | Check Solidity formatting |
| `pnpm typecheck` | Type-check all TypeScript workspaces |
| `pnpm test` | Run Vitest and Forge tests |
| `pnpm build` | Build TypeScript workspaces, Next.js, and contracts |
| `pnpm format:check` | Check code formatting |
| `pnpm check` | Run the full local quality gate |

CI uses the same granular root commands. Its security policy, required checks, and remote activation steps are documented in [`docs/CI.md`](./docs/CI.md).

No command deploys, signs, sends funds, or contacts a production service.

## Configuration

Phase 0 defines only `APP_ENV`. Do not add plausible placeholder addresses or live credentials. Network and provider configuration is owned by `FND-003` and later integration tasks.
# Clario
