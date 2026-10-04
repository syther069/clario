# Clario Agent Entry Point

Before changing this repository, read in order:

1. `MEMORY.md`
2. `RULES.md`
3. `PHASES.md`
4. `TASKS.md`
5. The relevant sections of `prd.md`, `architecture.md`, and `DESIGN.md`

Before each build task, also consult `MONAD_HACKATHON_RESOURCES.md` for relevant Monad and ecosystem references. Use those resources only where they fit Clario's approved product scope and founder invariants; the resource catalog does not authorize adding unrelated protocols, providers, wallet flows, or trading features.

Execute one task from `TASKS.md` at a time. Preserve Clario's founder invariants: private evidence remains offchain, material edits create immutable versions, approval binds to an exact current commitment and authorized human, duplicate reimbursement fails, AI has no authority, and verification stays independent.

## Design & UI Standard (Montally Neo-Brutalist)
- All components and pages must follow the Montally Neo-Brutalist design language: `2px` solid black borders (`border-2 border-black`), hard 2D offset box-shadows (`shadow-[4px_4px_0px_#000]`), monospace uppercase badges/labels (`font-mono tracking-wider uppercase`), `.bg-grid` backdrop, high-contrast cards, and Monad electric purple accent (`#836EF9`).

## Multi-Chain Transaction Ingestion Architecture
- Single transaction lookup by hash is active via Viem direct EVM RPC across Monad Testnet (`10143`), Ethereum (`1`), Sepolia (`11155111`), and Base (`8453`).
- Auto-fetching historical wallet transactions is designed around the Alchemy API Free Tier (`alchemy_getAssetTransfers`) or Zerion API via `TransactionImportService`.

Do not deploy, sign, broadcast, move funds, create live infrastructure, or add real addresses without explicit human authorization.
