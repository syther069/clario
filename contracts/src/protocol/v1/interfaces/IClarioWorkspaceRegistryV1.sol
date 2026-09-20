// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IClarioWorkspaceRegistryV1
/// @notice Public interface and events for workspace registration, scoped role authority, and policy history.
/// @dev Conforms to architecture.md §6.1-6.4 and prd.md §9.2.
interface IClarioWorkspaceRegistryV1 {
    // ------------------------------------------------------------------------
    // Events (architecture.md §6.4)
    // ------------------------------------------------------------------------

    /// @notice Emitted when a new workspace is registered.
    event WorkspaceCreated(
        bytes32 indexed workspaceId, address indexed owner, bytes32 policyCommitment
    );

    /// @notice Emitted when a role is granted to an account within a workspace and scope.
    event RoleGranted(
        bytes32 indexed workspaceId, address indexed account, bytes32 indexed role, bytes32 scope
    );

    /// @notice Emitted when a role is revoked from an account within a workspace and scope.
    event RoleRevoked(
        bytes32 indexed workspaceId, address indexed account, bytes32 indexed role, bytes32 scope
    );

    /// @notice Emitted when a workspace authorization policy is updated to a new version.
    event PolicyUpdated(
        bytes32 indexed workspaceId, uint32 policyVersion, bytes32 policyCommitment
    );

    // ------------------------------------------------------------------------
    // Custom Errors
    // ------------------------------------------------------------------------

    error Unauthorized();
    error WorkspaceAlreadyExists();
    error WorkspaceNotFound();
    error InvalidWorkspaceId();
    error InvalidPolicyCommitment();
    error InvalidAccount();
    error InvalidRole();
    error RoleAlreadyActive();
    error RoleNotActive();
    error CannotRevokeLastOwner();

    // ------------------------------------------------------------------------
    // State-Changing Functions (architecture.md §6.3)
    // ------------------------------------------------------------------------

    /// @notice Creates a new workspace with an initial policy commitment at policyVersion 1.
    /// @dev Caller receives OWNER_ROLE with global scope (bytes32(0)).
    /// @param workspaceId Opaque 32-byte workspace identifier.
    /// @param policyCommitment 32-byte commitment digest to the initial approval policy.
    function createWorkspace(bytes32 workspaceId, bytes32 policyCommitment) external;

    /// @notice Grants a scoped role to an account in the given workspace.
    /// @dev Only OWNER can grant OWNER_ROLE or ADMIN_ROLE. OWNER or ADMIN can grant other roles.
    /// @param workspaceId Opaque workspace identifier.
    /// @param account The address receiving the role.
    /// @param role The 32-byte role identifier.
    /// @param scope The 32-byte scope identifier (bytes32(0) denotes global workspace scope).
    function grantRole(bytes32 workspaceId, address account, bytes32 role, bytes32 scope) external;

    /// @notice Revokes an active scoped role from an account in the given workspace.
    /// @dev Only OWNER can revoke OWNER_ROLE or ADMIN_ROLE. OWNER or ADMIN can revoke other roles.
    /// @param workspaceId Opaque workspace identifier.
    /// @param account The address losing the role.
    /// @param role The 32-byte role identifier.
    /// @param scope The 32-byte scope identifier.
    function revokeRole(bytes32 workspaceId, address account, bytes32 role, bytes32 scope) external;

    /// @notice Updates the workspace authorization policy, incrementing policyVersion by 1.
    /// @dev Only OWNER can update policy.
    /// @param workspaceId Opaque workspace identifier.
    /// @param policyCommitment 32-byte commitment digest to the new policy.
    /// @return newPolicyVersion The newly assigned policy version number.
    function updatePolicy(bytes32 workspaceId, bytes32 policyCommitment)
        external
        returns (uint32 newPolicyVersion);

    // ------------------------------------------------------------------------
    // View Queries
    // ------------------------------------------------------------------------

    /// @notice Returns true if the workspace has been registered.
    function isWorkspace(bytes32 workspaceId) external view returns (bool);

    /// @notice Returns the primary creator/owner address of the workspace.
    function getWorkspaceOwner(bytes32 workspaceId) external view returns (address);

    /// @notice Returns the block number at which the workspace was created.
    function getWorkspaceCreatedAtBlock(bytes32 workspaceId) external view returns (uint64);

    /// @notice Returns true if the account currently holds the role with global scope (bytes32(0)).
    function hasRole(bytes32 workspaceId, address account, bytes32 role)
        external
        view
        returns (bool);

    /// @notice Returns true if the account holds the role either globally or for the specified scope.
    function hasRoleScoped(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        view
        returns (bool);

    /// @notice Returns true if the account holds an active grant for the exact specified scope.
    function isRoleActiveExact(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        view
        returns (bool);

    /// @notice Answers whether an account had authority for a role+scope at a specific historical block.
    function wasRoleAuthorizedAtBlock(
        bytes32 workspaceId,
        address account,
        bytes32 role,
        bytes32 scope,
        uint64 targetBlock
    ) external view returns (bool);

    /// @notice Answers whether an account had authority for a role+scope at a specific policy version.
    function wasRoleAuthorizedAtPolicyVersion(
        bytes32 workspaceId,
        address account,
        bytes32 role,
        bytes32 scope,
        uint32 targetPolicyVersion
    ) external view returns (bool);

    /// @notice Returns the current active policy version for the workspace.
    function getPolicyVersion(bytes32 workspaceId) external view returns (uint32);

    /// @notice Returns the policy commitment registered for a specific policy version.
    function getPolicyCommitment(bytes32 workspaceId, uint32 policyVersion)
        external
        view
        returns (bytes32);

    /// @notice Returns the latest policy commitment registered for the workspace.
    function getLatestPolicyCommitment(bytes32 workspaceId) external view returns (bytes32);
}
