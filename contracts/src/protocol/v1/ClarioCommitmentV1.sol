// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title ClarioCommitmentV1
/// @notice Core pure cryptographic commitment library for Clario Expense Protocol v1.
/// @dev Implements canonical commitment generation and verification as specified in docs/CANONICAL_SCHEMA_V1.md.
library ClarioCommitmentV1 {
    /// @notice keccak256(bytes("CLARIO_EXPENSE_V1"))
    bytes32 public constant CLARIO_EXPENSE_V1_DOMAIN =
        0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8;

    /// @notice Computes the canonical version commitment for an expense version on Monad.
    /// @param chainId The target Monad chain ID
    /// @param registry The canonical Clario registry contract address
    /// @param workspaceId Opaque 32-byte workspace identifier
    /// @param expenseId Opaque 32-byte expense identifier
    /// @param version Monotonic version counter (starts at 1)
    /// @param privateRecordHash keccak256 hash of the canonicalized JCS private expense record
    /// @param evidenceManifestHash keccak256 hash of the canonicalized JCS evidence manifest
    /// @param salt 32-byte cryptographically secure pseudorandom salt
    /// @return The resulting 32-byte commitment digest
    function computeCommitment(
        uint256 chainId,
        address registry,
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 privateRecordHash,
        bytes32 evidenceManifestHash,
        bytes32 salt
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CLARIO_EXPENSE_V1_DOMAIN,
                chainId,
                registry,
                workspaceId,
                expenseId,
                version,
                privateRecordHash,
                evidenceManifestHash,
                salt
            )
        );
    }

    /// @notice Verifies that an expected commitment matches the candidate inputs.
    /// @param chainId The target Monad chain ID
    /// @param registry The canonical Clario registry contract address
    /// @param workspaceId Opaque 32-byte workspace identifier
    /// @param expenseId Opaque 32-byte expense identifier
    /// @param version Monotonic version counter
    /// @param privateRecordHash keccak256 hash of the canonicalized JCS private expense record
    /// @param evidenceManifestHash keccak256 hash of the canonicalized JCS evidence manifest
    /// @param salt 32-byte cryptographically secure pseudorandom salt
    /// @param expectedCommitment The commitment digest registered onchain or provided in export
    /// @return True if the computed commitment equals expectedCommitment, false otherwise
    function verifyCommitment(
        uint256 chainId,
        address registry,
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 privateRecordHash,
        bytes32 evidenceManifestHash,
        bytes32 salt,
        bytes32 expectedCommitment
    ) internal pure returns (bool) {
        return computeCommitment(
            chainId,
            registry,
            workspaceId,
            expenseId,
            version,
            privateRecordHash,
            evidenceManifestHash,
            salt
        ) == expectedCommitment;
    }
}
