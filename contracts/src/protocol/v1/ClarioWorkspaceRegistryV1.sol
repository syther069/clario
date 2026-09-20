// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioWorkspaceRegistryV1 } from "./interfaces/IClarioWorkspaceRegistryV1.sol";

/// @title ClarioWorkspaceRegistryV1
/// @notice Non-upgradeable registry for workspace creation, scoped roles, and policy history on Monad.
/// @dev Implements IClarioWorkspaceRegistryV1 as specified in architecture.md §6.1-6.5 and prd.md §9.2.
contract ClarioWorkspaceRegistryV1 is IClarioWorkspaceRegistryV1 {
    // ------------------------------------------------------------------------
    // Role Constants (matched to packages/protocol/src/lifecycle.ts)
    // ------------------------------------------------------------------------

    bytes32 public constant OWNER_ROLE =
        0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e;
    bytes32 public constant ADMIN_ROLE =
        0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775;
    bytes32 public constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;
    bytes32 public constant TREASURY_ROLE =
        0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9;
    bytes32 public constant AUDITOR_ROLE =
        0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5;

    bytes32 public constant GLOBAL_SCOPE = bytes32(0);

    // ------------------------------------------------------------------------
    // Storage Structures
    // ------------------------------------------------------------------------

    struct Workspace {
        bool exists;
        address owner;
        uint64 createdAtBlock;
        uint32 currentPolicyVersion;
        uint32 activeOwnerCount;
    }

    struct RoleGrantRecord {
        uint64 grantedAtBlock;
        uint32 grantedAtPolicyVersion;
        uint64 revokedAtBlock;
        uint32 revokedAtPolicyVersion;
    }

    // ------------------------------------------------------------------------
    // State Variables
    // ------------------------------------------------------------------------

    // workspaceId => Workspace metadata
    mapping(bytes32 => Workspace) private _workspaces;

    // workspaceId => account => role => scope => isCurrentlyActive
    mapping(bytes32 => mapping(address => mapping(bytes32 => mapping(bytes32 => bool)))) private
        _activeRoles;

    // workspaceId => account => role => scope => historical records
    mapping(
        bytes32 => mapping(address => mapping(bytes32 => mapping(bytes32 => RoleGrantRecord[])))
    ) private _grantHistory;

    // workspaceId => policyVersion => policyCommitment
    mapping(bytes32 => mapping(uint32 => bytes32)) private _policyCommitments;

    // workspaceId => policyVersion => blockNumber
    mapping(bytes32 => mapping(uint32 => uint64)) private _policyUpdatedBlocks;

    // ------------------------------------------------------------------------
    // External Mutating Functions
    // ------------------------------------------------------------------------

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function createWorkspace(bytes32 workspaceId, bytes32 policyCommitment) external override {
        if (workspaceId == bytes32(0)) revert InvalidWorkspaceId();
        if (policyCommitment == bytes32(0)) revert InvalidPolicyCommitment();
        if (_workspaces[workspaceId].exists) revert WorkspaceAlreadyExists();

        _workspaces[workspaceId] = Workspace({
            exists: true,
            owner: msg.sender,
            createdAtBlock: uint64(block.number),
            currentPolicyVersion: 1,
            activeOwnerCount: 1
        });

        _policyCommitments[workspaceId][1] = policyCommitment;
        _policyUpdatedBlocks[workspaceId][1] = uint64(block.number);

        _activeRoles[workspaceId][msg.sender][OWNER_ROLE][GLOBAL_SCOPE] = true;
        _grantHistory[workspaceId][msg.sender][OWNER_ROLE][GLOBAL_SCOPE].push(
            RoleGrantRecord({
                grantedAtBlock: uint64(block.number),
                grantedAtPolicyVersion: 1,
                revokedAtBlock: 0,
                revokedAtPolicyVersion: 0
            })
        );

        emit WorkspaceCreated(workspaceId, msg.sender, policyCommitment);
        emit RoleGranted(workspaceId, msg.sender, OWNER_ROLE, GLOBAL_SCOPE);
        emit PolicyUpdated(workspaceId, 1, policyCommitment);
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function grantRole(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        override
    {
        if (!_workspaces[workspaceId].exists) revert WorkspaceNotFound();
        if (account == address(0)) revert InvalidAccount();
        if (!_isValidRole(role)) revert InvalidRole();
        if (!_canManageRole(workspaceId, msg.sender, role)) revert Unauthorized();
        if (_activeRoles[workspaceId][account][role][scope]) revert RoleAlreadyActive();

        _activeRoles[workspaceId][account][role][scope] = true;
        uint32 currentVer = _workspaces[workspaceId].currentPolicyVersion;

        _grantHistory[workspaceId][account][role][scope].push(
            RoleGrantRecord({
                grantedAtBlock: uint64(block.number),
                grantedAtPolicyVersion: currentVer,
                revokedAtBlock: 0,
                revokedAtPolicyVersion: 0
            })
        );

        if (role == OWNER_ROLE && scope == GLOBAL_SCOPE) {
            _workspaces[workspaceId].activeOwnerCount++;
        }

        emit RoleGranted(workspaceId, account, role, scope);
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function revokeRole(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        override
    {
        if (!_workspaces[workspaceId].exists) revert WorkspaceNotFound();
        if (account == address(0)) revert InvalidAccount();
        if (!_isValidRole(role)) revert InvalidRole();
        if (!_canManageRole(workspaceId, msg.sender, role)) revert Unauthorized();
        if (!_activeRoles[workspaceId][account][role][scope]) revert RoleNotActive();

        if (role == OWNER_ROLE && scope == GLOBAL_SCOPE) {
            if (_workspaces[workspaceId].activeOwnerCount <= 1) {
                revert CannotRevokeLastOwner();
            }
            _workspaces[workspaceId].activeOwnerCount--;
        }

        _activeRoles[workspaceId][account][role][scope] = false;

        uint32 currentVer = _workspaces[workspaceId].currentPolicyVersion;
        RoleGrantRecord[] storage history = _grantHistory[workspaceId][account][role][scope];
        if (history.length > 0) {
            RoleGrantRecord storage lastRecord = history[history.length - 1];
            lastRecord.revokedAtBlock = uint64(block.number);
            lastRecord.revokedAtPolicyVersion = currentVer;
        }

        emit RoleRevoked(workspaceId, account, role, scope);
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function updatePolicy(bytes32 workspaceId, bytes32 policyCommitment)
        external
        override
        returns (uint32 newPolicyVersion)
    {
        if (!_workspaces[workspaceId].exists) revert WorkspaceNotFound();
        if (policyCommitment == bytes32(0)) revert InvalidPolicyCommitment();
        if (!_activeRoles[workspaceId][msg.sender][OWNER_ROLE][GLOBAL_SCOPE]) {
            revert Unauthorized();
        }

        newPolicyVersion = _workspaces[workspaceId].currentPolicyVersion + 1;
        _workspaces[workspaceId].currentPolicyVersion = newPolicyVersion;
        _policyCommitments[workspaceId][newPolicyVersion] = policyCommitment;
        _policyUpdatedBlocks[workspaceId][newPolicyVersion] = uint64(block.number);

        emit PolicyUpdated(workspaceId, newPolicyVersion, policyCommitment);
    }

    // ------------------------------------------------------------------------
    // External View Functions
    // ------------------------------------------------------------------------

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function isWorkspace(bytes32 workspaceId) external view override returns (bool) {
        return _workspaces[workspaceId].exists;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function getWorkspaceOwner(bytes32 workspaceId) external view override returns (address) {
        return _workspaces[workspaceId].owner;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function getWorkspaceCreatedAtBlock(bytes32 workspaceId)
        external
        view
        override
        returns (uint64)
    {
        return _workspaces[workspaceId].createdAtBlock;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function hasRole(bytes32 workspaceId, address account, bytes32 role)
        external
        view
        override
        returns (bool)
    {
        return _activeRoles[workspaceId][account][role][GLOBAL_SCOPE];
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function hasRoleScoped(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        view
        override
        returns (bool)
    {
        if (_activeRoles[workspaceId][account][role][scope]) {
            return true;
        }
        if (scope != GLOBAL_SCOPE && _activeRoles[workspaceId][account][role][GLOBAL_SCOPE]) {
            return true;
        }
        return false;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function isRoleActiveExact(bytes32 workspaceId, address account, bytes32 role, bytes32 scope)
        external
        view
        override
        returns (bool)
    {
        return _activeRoles[workspaceId][account][role][scope];
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function wasRoleAuthorizedAtBlock(
        bytes32 workspaceId,
        address account,
        bytes32 role,
        bytes32 scope,
        uint64 targetBlock
    ) external view override returns (bool) {
        if (!_workspaces[workspaceId].exists) return false;
        if (_wasRecordAuthorizedAtBlock(
                _grantHistory[workspaceId][account][role][scope], targetBlock
            )) {
            return true;
        }
        if (scope != GLOBAL_SCOPE) {
            return _wasRecordAuthorizedAtBlock(
                _grantHistory[workspaceId][account][role][GLOBAL_SCOPE], targetBlock
            );
        }
        return false;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function wasRoleAuthorizedAtPolicyVersion(
        bytes32 workspaceId,
        address account,
        bytes32 role,
        bytes32 scope,
        uint32 targetPolicyVersion
    ) external view override returns (bool) {
        if (!_workspaces[workspaceId].exists) return false;
        if (targetPolicyVersion == 0) return false;
        if (_wasRecordAuthorizedAtPolicyVersion(
                _grantHistory[workspaceId][account][role][scope], targetPolicyVersion
            )) {
            return true;
        }
        if (scope != GLOBAL_SCOPE) {
            return _wasRecordAuthorizedAtPolicyVersion(
                _grantHistory[workspaceId][account][role][GLOBAL_SCOPE], targetPolicyVersion
            );
        }
        return false;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function getPolicyVersion(bytes32 workspaceId) external view override returns (uint32) {
        return _workspaces[workspaceId].currentPolicyVersion;
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function getPolicyCommitment(bytes32 workspaceId, uint32 policyVersion)
        external
        view
        override
        returns (bytes32)
    {
        return _policyCommitments[workspaceId][policyVersion];
    }

    /// @inheritdoc IClarioWorkspaceRegistryV1
    function getLatestPolicyCommitment(bytes32 workspaceId)
        external
        view
        override
        returns (bytes32)
    {
        uint32 currentVer = _workspaces[workspaceId].currentPolicyVersion;
        return _policyCommitments[workspaceId][currentVer];
    }

    // ------------------------------------------------------------------------
    // Internal Helper Functions
    // ------------------------------------------------------------------------

    function _isValidRole(bytes32 role) internal pure returns (bool) {
        return role == OWNER_ROLE || role == ADMIN_ROLE || role == APPROVER_ROLE
            || role == TREASURY_ROLE || role == AUDITOR_ROLE;
    }

    function _canManageRole(bytes32 workspaceId, address caller, bytes32 targetRole)
        internal
        view
        returns (bool)
    {
        bool isCallerOwner = _activeRoles[workspaceId][caller][OWNER_ROLE][GLOBAL_SCOPE];
        if (targetRole == OWNER_ROLE || targetRole == ADMIN_ROLE) {
            return isCallerOwner;
        }
        bool isCallerAdmin = _activeRoles[workspaceId][caller][ADMIN_ROLE][GLOBAL_SCOPE];
        return isCallerOwner || isCallerAdmin;
    }

    function _wasRecordAuthorizedAtBlock(RoleGrantRecord[] storage records, uint64 targetBlock)
        internal
        view
        returns (bool)
    {
        uint256 len = records.length;
        for (uint256 i = 0; i < len; ++i) {
            RoleGrantRecord storage r = records[i];
            if (targetBlock >= r.grantedAtBlock) {
                if (r.revokedAtBlock == 0 || targetBlock < r.revokedAtBlock) {
                    return true;
                }
            }
        }
        return false;
    }

    function _wasRecordAuthorizedAtPolicyVersion(
        RoleGrantRecord[] storage records,
        uint32 targetPolicyVersion
    ) internal view returns (bool) {
        uint256 len = records.length;
        for (uint256 i = 0; i < len; ++i) {
            RoleGrantRecord storage r = records[i];
            if (targetPolicyVersion >= r.grantedAtPolicyVersion) {
                if (r.revokedAtPolicyVersion == 0 || targetPolicyVersion < r.revokedAtPolicyVersion)
                {
                    return true;
                }
            }
        }
        return false;
    }
}
