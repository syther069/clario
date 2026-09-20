// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ClarioBuildProbe } from "../src/ClarioBuildProbe.sol";

contract ClarioBuildProbeTest {
    function testProtocolRemainsUninitializedDuringFoundation() public pure {
        assert(
            keccak256(bytes(ClarioBuildProbe.initializationState()))
                == keccak256(bytes("uninitialized"))
        );
    }
}
