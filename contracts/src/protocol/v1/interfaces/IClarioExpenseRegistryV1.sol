// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IClarioExpenseRegistryV1
/// @notice Public interface and events for immutable expense versioning and commitment chains on Monad.
/// @dev Conforms to architecture.md §6.1-6.5 and prd.md §8.1.
interface IClarioExpenseRegistryV1 {
    // ------------------------------------------------------------------------
    // Events (architecture.md §6.4)
    // ------------------------------------------------------------------------

    /// @notice Emitted when an expense version commitment is submitted onchain.
    event ExpenseVersionSubmitted(
        bytes32 indexed workspaceId,
        bytes32 indexed expenseId,
        uint32 indexed version,
        bytes32 commitment,
        address submitter
    );

    /// @notice Emitted when a new version supersedes an existing version of an expense.
    event ExpenseVersionSuperseded(
        bytes32 indexed workspaceId, bytes32 indexed expenseId, uint32 oldVersion, uint32 newVersion
    );

    /// @notice Emitted when write submissions are paused for a workspace.
    event WorkspacePaused(bytes32 indexed workspaceId, address indexed account);

    /// @notice Emitted when write submissions are unpaused for a workspace.
    event WorkspaceUnpaused(bytes32 indexed workspaceId, address indexed account);

    // ------------------------------------------------------------------------
    // Custom Errors
    // ------------------------------------------------------------------------

    error WorkspaceNotFound();
    error InvalidWorkspaceId();
    error InvalidExpenseId();
    error InvalidCommitment();
    error InvalidVersion();
    error InvalidPredecessorCommitment();
    error WorkspacePausedError();
    error Unauthorized();

    // ------------------------------------------------------------------------
    // State-Changing Functions
    // ------------------------------------------------------------------------

    /// @notice Submits a new immutable version for an expense.
    /// @dev Version 1 requires previousCommitment == bytes32(0).
    ///      Version n > 1 requires previousCommitment == commitment of version n-1.
    /// @param workspaceId Opaque workspace identifier.
    /// @param expenseId Opaque expense identifier.
    /// @param version Monotonically increasing version number (starts at 1).
    /// @param commitment 32-byte cryptographic commitment to canonical private expense data.
    /// @param previousCommitment 32-byte commitment of the predecessor version (0 for version 1).
    function submitVersion(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        bytes32 previousCommitment
    ) external;

    /// @notice Pauses new version submissions for a workspace.
    /// @dev Only workspace OWNER can pause. Does not erase or affect historical reads.
    /// @param workspaceId Opaque workspace identifier.
    function pauseWorkspace(bytes32 workspaceId) external;

    /// @notice Unpauses version submissions for a workspace.
    /// @dev Only workspace OWNER can unpause.
    /// @param workspaceId Opaque workspace identifier.
    function unpauseWorkspace(bytes32 workspaceId) external;

    // ------------------------------------------------------------------------
    // View Queries
    // ------------------------------------------------------------------------

    /// @notice Returns the address of the bound workspace registry contract.
    function workspaceRegistry() external view returns (address);

    /// @notice Returns the current active version number for an expense (0 if not submitted).
    function getCurrentVersion(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        returns (uint32);

    /// @notice Returns the commitment digest of the current active version.
    function getCurrentCommitment(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        returns (bytes32);

    /// @notice Returns the commitment digest registered for a specific version.
    function getCommitment(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bytes32);

    /// @notice Returns the submitter address of a specific version.
    function getSubmitter(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (address);

    /// @notice Returns the block number at which a specific version was submitted.
    function getSubmittedAtBlock(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (uint64);

    /// @notice Returns true if a specific version has been superseded by a newer version.
    function isVersionSuperseded(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns true if the version is the current active version for the expense.
    function isCurrentVersion(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns true if version submissions are paused for the workspace.
    function isWorkspacePaused(bytes32 workspaceId) external view returns (bool);
}
