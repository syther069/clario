# Clario Independent Verifier

**Status:** Implemented for verification package schema v1  
**Task:** `VER-002`

The verifier checks a Clario export without an authenticated Clario API or access to Clario's private database. It reads the disclosed package locally and, when an RPC URL is supplied, reads public state directly from the package's configured Clario registry on a compatible Monad RPC endpoint.

## Run

```bash
pnpm verify:package -- ./clario-export.zip --rpc <MONAD_RPC_URL>
```

Omit `--rpc` for an offline integrity-only pass. Public-chain checks will be `UNVERIFIABLE`; they are never silently passed.

The command prints a JSON report and exits with code `1` when the overall result is `FAILED`. `VERIFIED_WITH_WARNINGS` and `UNVERIFIABLE` remain distinct successful command outcomes so callers can apply their own disclosure policy.

## Result meanings

- `VERIFIED` — every applicable disclosed-file and public-chain check matched.
- `VERIFIED_WITH_WARNINGS` — checks matched, but a non-failing condition such as an unapproved/unsettled record needs attention.
- `FAILED` — at least one supplied or independently observed value conflicts with the package claim.
- `UNVERIFIABLE` — an allowed input or public-chain source was unavailable, so the affected claim was not tested.

The report includes a status and plain-language explanation for each check. Missing redacted records, evidence, or salts are `UNVERIFIABLE`, never `VERIFIED`.

## Checked claims

- Package schema, declared file presence, size, and SHA-256 digest.
- No undeclared archive payloads.
- Deployment manifest, chain ID, and root registry consistency.
- Canonical expense and evidence-manifest reconstruction.
- Evidence byte size and SHA-256 digest.
- Salted commitment reconstruction using the discovered expense registry address.
- Onchain version existence, ordering, supersession, and current version.
- Exact-current-version decision, historical reviewer authority, and active approval.
- Settlement commitment, configured token, recipient, amount, ERC-20 transfer, and conflict count.

## Trust and privacy boundaries

- The verifier trusts package bytes only after manifest hash checks.
- `expected-events.json` is a package claim, not chain authority. Critical results come from the supplied public RPC source.
- The verifier does not upload the package or disclosed evidence.
- RPC URLs containing embedded credentials are rejected. Use a locally configured endpoint URL if a provider requires a secret.
- A FULL package contains intentionally disclosed private records, salts, and evidence. Handle it as confidential material.

## Limitations

Verification proves integrity, public authority, ordering, and a matching settlement. It does not prove receipt authenticity, business legitimacy, tax treatment, accounting correctness, or legal compliance. Source-chain transaction claims require their own source-chain verification.

