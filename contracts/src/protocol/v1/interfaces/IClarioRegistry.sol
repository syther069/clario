// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IClarioRegistry
/// @notice Root coordinator and directory interface for the Clario protocol on Monad.
/// @dev Holds immutable references to the modular registries and provides top-level discovery and queries.
interface IClarioRegistry {
    /// @notice Thrown when attempting to initialize with a zero address for any registry.
    error InvalidRegistryAddress();

    /// @notice Returns the address of the bound workspace registry.
    function workspaceRegistry() external view returns (address);

    /// @notice Returns the address of the bound expense registry.
    function expenseRegistry() external view returns (address);

    /// @notice Returns the address of the bound decision registry.
    function decisionRegistry() external view returns (address);

    /// @notice Returns the address of the bound settlement registry.
    function settlementRegistry() external view returns (address);

    /// @notice Checks if an approval is currently valid and unsuperseded.
    function isApprovalValid(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Checks if an expense version has already been settled.
    function isSettled(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns the current active version of an expense.
    function getCurrentVersion(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        returns (uint32);

    /// @notice Returns the registered commitment hash for an expense version.
    function getCommitment(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bytes32);

    /// @notice Returns true if the workspace exists.
    function isWorkspace(bytes32 workspaceId) external view returns (bool);

    /// @notice Returns true if the account holds the role in the workspace.
    function hasRole(bytes32 workspaceId, address account, bytes32 role)
        external
        view
        returns (bool);
}
