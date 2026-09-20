// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @dev Foundation-only build probe. This is not a deployable Clario product contract.
library ClarioBuildProbe {
    function initializationState() internal pure returns (string memory) {
        return "uninitialized";
    }
}
