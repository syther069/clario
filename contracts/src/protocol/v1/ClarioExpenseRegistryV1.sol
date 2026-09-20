// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioExpenseRegistryV1 } from "./interfaces/IClarioExpenseRegistryV1.sol";
import { IClarioWorkspaceRegistryV1 } from "./interfaces/IClarioWorkspaceRegistryV1.sol";

/// @title ClarioExpenseRegistryV1
/// @notice Non-upgradeable registry for ordered, immutable expense commitments and supersession on Monad.
/// @dev Implements IClarioExpenseRegistryV1 as specified in architecture.md §6.1-6.5 and prd.md §8.1.
contract ClarioExpenseRegistryV1 is IClarioExpenseRegistryV1 {
    // ------------------------------------------------------------------------
    // Immutable References
    // ------------------------------------------------------------------------

    IClarioWorkspaceRegistryV1 private immutable _workspaceRegistry;

    bytes32 private constant OWNER_ROLE =
        0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e;

    // ------------------------------------------------------------------------
    // Storage Structures
    // ------------------------------------------------------------------------

    struct VersionRecord {
        bytes32 commitment;
        address submitter;
        uint64 submittedAtBlock;
        bool superseded;
    }

    // ------------------------------------------------------------------------
    // State Variables
    // ------------------------------------------------------------------------

    // workspaceId => expenseId => activeVersion
    mapping(bytes32 => mapping(bytes32 => uint32)) private _currentVersions;

    // workspaceId => expenseId => version => VersionRecord
    mapping(bytes32 => mapping(bytes32 => mapping(uint32 => VersionRecord))) private _versions;

    // workspaceId => isPaused
    mapping(bytes32 => bool) private _workspacePaused;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    constructor(address workspaceRegistryAddress) {
        if (workspaceRegistryAddress == address(0)) revert Unauthorized();
        _workspaceRegistry = IClarioWorkspaceRegistryV1(workspaceRegistryAddress);
    }

    // ------------------------------------------------------------------------
    // External Mutating Functions
    // ------------------------------------------------------------------------

    /// @inheritdoc IClarioExpenseRegistryV1
    function submitVersion(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        bytes32 previousCommitment
    ) external override {
        if (workspaceId == bytes32(0)) revert InvalidWorkspaceId();
        if (expenseId == bytes32(0)) revert InvalidExpenseId();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (_workspacePaused[workspaceId]) revert WorkspacePausedError();
        if (!_workspaceRegistry.isWorkspace(workspaceId)) revert WorkspaceNotFound();

        uint32 currentVer = _currentVersions[workspaceId][expenseId];

        if (version == 1) {
            if (currentVer != 0) revert InvalidVersion();
            if (previousCommitment != bytes32(0)) revert InvalidPredecessorCommitment();
        } else if (version > 1) {
            if (version != currentVer + 1) revert InvalidVersion();
            bytes32 expectedPredecessor = _versions[workspaceId][expenseId][currentVer].commitment;
            if (previousCommitment != expectedPredecessor) revert InvalidPredecessorCommitment();

            _versions[workspaceId][expenseId][currentVer].superseded = true;
            emit ExpenseVersionSuperseded(workspaceId, expenseId, currentVer, version);
        } else {
            revert InvalidVersion();
        }

        _currentVersions[workspaceId][expenseId] = version;
        _versions[workspaceId][expenseId][version] = VersionRecord({
            commitment: commitment,
            submitter: msg.sender,
            submittedAtBlock: uint64(block.number),
            superseded: false
        });

        emit ExpenseVersionSubmitted(workspaceId, expenseId, version, commitment, msg.sender);
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function pauseWorkspace(bytes32 workspaceId) external override {
        if (!_workspaceRegistry.isWorkspace(workspaceId)) revert WorkspaceNotFound();
        if (!_workspaceRegistry.hasRole(workspaceId, msg.sender, OWNER_ROLE)) {
            revert Unauthorized();
        }

        _workspacePaused[workspaceId] = true;
        emit WorkspacePaused(workspaceId, msg.sender);
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function unpauseWorkspace(bytes32 workspaceId) external override {
        if (!_workspaceRegistry.isWorkspace(workspaceId)) revert WorkspaceNotFound();
        if (!_workspaceRegistry.hasRole(workspaceId, msg.sender, OWNER_ROLE)) {
            revert Unauthorized();
        }

        _workspacePaused[workspaceId] = false;
        emit WorkspaceUnpaused(workspaceId, msg.sender);
    }

    // ------------------------------------------------------------------------
    // External View Functions
    // ------------------------------------------------------------------------

    /// @inheritdoc IClarioExpenseRegistryV1
    function workspaceRegistry() external view override returns (address) {
        return address(_workspaceRegistry);
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function getCurrentVersion(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        override
        returns (uint32)
    {
        return _currentVersions[workspaceId][expenseId];
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function getCurrentCommitment(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        override
        returns (bytes32)
    {
        uint32 currentVer = _currentVersions[workspaceId][expenseId];
        return _versions[workspaceId][expenseId][currentVer].commitment;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function getCommitment(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bytes32)
    {
        return _versions[workspaceId][expenseId][version].commitment;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function getSubmitter(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (address)
    {
        return _versions[workspaceId][expenseId][version].submitter;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function getSubmittedAtBlock(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (uint64)
    {
        return _versions[workspaceId][expenseId][version].submittedAtBlock;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function isVersionSuperseded(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        return _versions[workspaceId][expenseId][version].superseded;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function isCurrentVersion(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        uint32 currentVer = _currentVersions[workspaceId][expenseId];
        return version > 0 && version == currentVer;
    }

    /// @inheritdoc IClarioExpenseRegistryV1
    function isWorkspacePaused(bytes32 workspaceId) external view override returns (bool) {
        return _workspacePaused[workspaceId];
    }
}
