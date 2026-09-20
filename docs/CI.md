# Continuous Integration Policy

**Status:** Implemented locally; repository enforcement pending remote activation  
**Owner:** Clario founders  
**Workflow:** `.github/workflows/ci.yml`

## Required checks

Configure branch protection or a repository ruleset to require these exact workflow jobs before merge:

- `CI / Static analysis`
- `CI / Unit tests`
- `CI / Contract tests`
- `CI / Production build`
- `CI / Security`

Do not treat the workflow file alone as merge protection. Enforcement becomes active only after the workflow has run on the remote repository and these checks are selected in its protected-branch ruleset.

## Security boundaries

- The workflow has read-only repository contents permission.
- It never uses `pull_request_target`, deployment environments, OIDC, production credentials, or environment dumps.
- Checkout credentials are not persisted.
- Third-party actions are pinned to immutable commit SHAs; their reviewed release labels remain in comments.
- Gitleaks `8.30.1` is downloaded from its release and checked against the published Linux x64 SHA-256 before execution. Findings are redacted and any finding blocks the job.
- The production dependency audit blocks high and critical advisories. Moderate and low advisories are reviewed during dependency maintenance but do not independently block this founding gate.

## Cache policy

Only pnpm's content-addressed dependency store and lockfile verification record may be cached. Never cache `node_modules`, `.env*`, credentials, build output, local databases, uploads, exports, or Foundry broadcast data. Pull-request cache access follows GitHub's restricted defaults; the workflow does not override cache access to make untrusted runs writable.

## Local parity

The CI steps call root scripts rather than branch-specific shell implementations:

```text
pnpm lint
pnpm lint:contracts
pnpm typecheck
pnpm test:unit
pnpm test:contracts
pnpm build:packages
pnpm build:contracts
pnpm format:check:code
pnpm audit:dependencies
```

`pnpm check` composes all non-network quality gates for local use. The dependency audit requires registry access. Gitleaks is intentionally a standalone pinned binary in CI so an organization license or production secret is not required.

## Failure-fixture protocol

When changing a gate, temporarily add one minimal failing fixture for that gate, prove the expected command exits non-zero, remove the fixture, and prove the clean command passes. Never commit a failing fixture or weaken an assertion to obtain a green result.

## Remote activation checklist

- Push the workflow to the intended GitHub repository.
- Confirm all five jobs run without repository or production secrets.
- Add the five exact checks above to the default branch's required ruleset.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion on the protected default branch.
- Record the repository URL, default branch, ruleset reviewer, and first successful workflow run in `MEMORY.md` without copying tokens or private logs.
