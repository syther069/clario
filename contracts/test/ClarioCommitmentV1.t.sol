// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ClarioCommitmentV1 } from "../src/protocol/v1/ClarioCommitmentV1.sol";

/// @title ClarioCommitmentV1Test
/// @notice Cross-runtime golden commitment vectors validation on EVM/Solidity runtime.
contract ClarioCommitmentV1Test {
    bytes32 internal constant WORKSPACE_ID =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 internal constant EXPENSE_ID =
        0x2222222222222222222222222222222222222222222222222222222222222222;
    address internal constant REGISTRY = 0x00000000000000000000000000000000000000AA;
    bytes32 internal constant DEFAULT_SALT =
        0x7777777777777777777777777777777777777777777777777777777777777777;
    uint256 internal constant MONAD_CHAIN_ID = 10143;

    function testDomainSeparatorMatchesProtocolConstant() public pure {
        assert(
            ClarioCommitmentV1.CLARIO_EXPENSE_V1_DOMAIN
                == 0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8
        );
    }

    /// @notice Vector 1: valid_standard_v1
    function testGoldenVectorValidStandardV1() public pure {
        bytes32 privateHash = 0x9e436dbd88b2b7f82fc5039e6fbf2e0a31df802452226d7ea35bc604b0caca65;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x4a330d1707527cc7108e06dac8bf8439ccd982cb826d1d308fea85fc6125f7c4;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
        assert(
            ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                evidenceHash,
                DEFAULT_SALT,
                expectedCommitment
            )
        );
    }

    /// @notice Vector 2: valid_absent_optionals
    function testGoldenVectorValidAbsentOptionals() public pure {
        bytes32 privateHash = 0x743feba103ced28cd6d2ab0709896e7f8e27e3acbf4b1452c3cc4bf32a29dfbd;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x13eb56986d7a1d527cc4d4ee95cfd20a4b5a409490233d64ac3328ca62f53988;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
        assert(
            ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                evidenceHash,
                DEFAULT_SALT,
                expectedCommitment
            )
        );
    }

    /// @notice Vector 3: valid_empty_arrays
    function testGoldenVectorValidEmptyArrays() public pure {
        bytes32 privateHash = 0xb3d042f382eeb0ba20fc1358d8fe67593cfb90e410b67f54713c5b6dbd786684;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x79c6f2814fb2bc53076ca8933a1ddb7aa1ece77fbc695528ed6a2305ad0ee0c5;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vector 4: valid_zero_claim_amount
    function testGoldenVectorValidZeroClaimAmount() public pure {
        bytes32 privateHash = 0x2f6a581a221465ff56ffd0c5fd42c88b5e552a2468c94dc04607a342315d49cf;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x07d242afdccbd5e0c7c6b9e84dbc6d814206ed9e4753f96e940f858ee11553c4;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vector 5: valid_large_claim_amount
    function testGoldenVectorValidLargeClaimAmount() public pure {
        bytes32 privateHash = 0x3e670449ec2691c285579937be12bd2faa932937b842a2c497dfa44e8df8dcd0;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x097cac31105df7d1158ede77f47dea0bba03d17b6a0ffe6bc6212c914c1bce66;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vector 6: valid_transaction_hash_source
    function testGoldenVectorValidTransactionHashSource() public pure {
        bytes32 privateHash = 0xd84a9d94a1b35d51780aeb8652794a31e23966a2d07ebfab2c2893293341adbd;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0x18c7283e90cad1597b7f87e4c396b496921115ef465152739314506493a0999b;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vector 7: valid_unicode_nfc
    function testGoldenVectorValidUnicodeNfc() public pure {
        bytes32 privateHash = 0x275a6f7f35e052c24e62d9bdccd092e8598410cd3b0bc062bc5b871afcbf0d04;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 expectedCommitment =
            0xf8c9d27eb7994604ed1fb8141832f40eded090fedc6d74eaf76b5ccc5cabbef7;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vector 8: valid_multi_evidence_sorted
    function testGoldenVectorValidMultiEvidenceSorted() public pure {
        bytes32 privateHash = 0xd12af8f9df175e6da6b573c396fe2a3ff342a60858141af646aa6007e8fbc5ae;
        bytes32 evidenceHash = 0x8f95d3c515ca3ef1de179e7675d1d8108e3a8627b033a46551ee1c4f515febb4;
        bytes32 expectedCommitment =
            0xfc101330be9f3b27f44685c5601aa5cafd4d3d305811bdb7a701f8a1eaccab9e;

        bytes32 computed = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID,
            REGISTRY,
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            privateHash,
            evidenceHash,
            DEFAULT_SALT
        );

        assert(computed == expectedCommitment);
    }

    /// @notice Vectors 9 & 10: Salt Variation Pair
    function testGoldenVectorSaltVariations() public pure {
        bytes32 privateHash = 0x9e436dbd88b2b7f82fc5039e6fbf2e0a31df802452226d7ea35bc604b0caca65;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;

        bytes32 saltA = 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
        bytes32 saltB = 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb;

        bytes32 expectedCommitmentA =
            0x166f2d281a7138ed2bb63c44d004708532d7766a81fa9944b27225a5b3a376f3;
        bytes32 expectedCommitmentB =
            0x1dc291024ff3c82426385f2d15ce71925a8c322f906584bf452e1564c11da3bc;

        bytes32 computedA = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID, REGISTRY, WORKSPACE_ID, EXPENSE_ID, 1, privateHash, evidenceHash, saltA
        );
        bytes32 computedB = ClarioCommitmentV1.computeCommitment(
            MONAD_CHAIN_ID, REGISTRY, WORKSPACE_ID, EXPENSE_ID, 1, privateHash, evidenceHash, saltB
        );

        assert(computedA == expectedCommitmentA);
        assert(computedB == expectedCommitmentB);
        assert(computedA != computedB);
    }

    /// @notice Negative / Tamper tests: altering any input alters the commitment and fails verification
    function testTamperedInputsFailVerification() public pure {
        bytes32 privateHash = 0x9e436dbd88b2b7f82fc5039e6fbf2e0a31df802452226d7ea35bc604b0caca65;
        bytes32 evidenceHash = 0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb8;
        bytes32 originalCommitment =
            0x4a330d1707527cc7108e06dac8bf8439ccd982cb826d1d308fea85fc6125f7c4;

        // 1. Tampered private hash (e.g. material field edit)
        bytes32 tamperedPrivateHash =
            0x9e436dbd88b2b7f82fc5039e6fbf2e0a31df802452226d7ea35bc604b0caca66;
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                tamperedPrivateHash,
                evidenceHash,
                DEFAULT_SALT,
                originalCommitment
            )
        );

        // 2. Tampered evidence manifest hash
        bytes32 tamperedEvidenceHash =
            0xf4433d980a212432c9bbeb8f4258d7bee15e4f4c32b7a46098e534280ebbfdb9;
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                tamperedEvidenceHash,
                DEFAULT_SALT,
                originalCommitment
            )
        );

        // 3. Tampered chain ID
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                1,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                evidenceHash,
                DEFAULT_SALT,
                originalCommitment
            )
        );

        // 4. Tampered registry address
        address tamperedRegistry = 0x00000000000000000000000000000000000000bb;
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                tamperedRegistry,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                evidenceHash,
                DEFAULT_SALT,
                originalCommitment
            )
        );

        // 5. Tampered version number
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                2,
                privateHash,
                evidenceHash,
                DEFAULT_SALT,
                originalCommitment
            )
        );

        // 6. Tampered salt
        bytes32 tamperedSalt = 0x9999999999999999999999999999999999999999999999999999999999999999;
        assert(
            !ClarioCommitmentV1.verifyCommitment(
                MONAD_CHAIN_ID,
                REGISTRY,
                WORKSPACE_ID,
                EXPENSE_ID,
                1,
                privateHash,
                evidenceHash,
                tamperedSalt,
                originalCommitment
            )
        );
    }
}
