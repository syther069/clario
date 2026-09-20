# Clario contracts

This is the Foundry workspace for Clario's public protocol.

`ClarioBuildProbe.sol` verifies that the contract toolchain is real during `FND-001`; it is not a product contract and must never be deployed. Workspace, expense, approval, and settlement behavior begins with `CHN-001` after the canonical protocol tasks are complete.

```bash
forge fmt --check --root contracts
forge test --root contracts
forge build --root contracts
```
