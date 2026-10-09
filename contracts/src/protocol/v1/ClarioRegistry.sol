// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioRegistry } from "./interfaces/IClarioRegistry.sol";
import { IClarioWorkspaceRegistryV1 } from "./interfaces/IClarioWorkspaceRegistryV1.sol";
import { IClarioExpenseRegistryV1 } from "./interfaces/IClarioExpenseRegistryV1.sol";
import { IClarioDecisionRegistryV1 } from "./interfaces/IClarioDecisionRegistryV1.sol";
import { IClarioSettlementRegistryV1 } from "./interfaces/IClarioSettlementRegistryV1.sol";

/// @title ClarioRegistry
/// @notice Implements the central coordinator and directory for the Clario protocol on Monad.
/// @dev Holds immutable references to the modular registries and provides top-level discovery and queries.
contract ClarioRegistry is IClarioRegistry {
    IClarioWorkspaceRegistryV1 private immutable _workspaceRegistry;
    IClarioExpenseRegistryV1 private immutable _expenseRegistry;
    IClarioDecisionRegistryV1 private immutable _decisionRegistry;
    IClarioSettlementRegistryV1 private immutable _settlementRegistry;

    constructor(
        address workspaceRegistryAddress,
        address expenseRegistryAddress,
        address decisionRegistryAddress,
        address settlementRegistryAddress
    ) {
        if (
            workspaceRegistryAddress == address(0) || expenseRegistryAddress == address(0)
                || decisionRegistryAddress == address(0) || settlementRegistryAddress == address(0)
        ) {
            revert InvalidRegistryAddress();
        }

        _workspaceRegistry = IClarioWorkspaceRegistryV1(workspaceRegistryAddress);
        _expenseRegistry = IClarioExpenseRegistryV1(expenseRegistryAddress);
        _decisionRegistry = IClarioDecisionRegistryV1(decisionRegistryAddress);
        _settlementRegistry = IClarioSettlementRegistryV1(settlementRegistryAddress);
    }

    /// @inheritdoc IClarioRegistry
    function workspaceRegistry() external view override returns (address) {
        return address(_workspaceRegistry);
    }

    /// @inheritdoc IClarioRegistry
    function expenseRegistry() external view override returns (address) {
        return address(_expenseRegistry);
    }

    /// @inheritdoc IClarioRegistry
    function decisionRegistry() external view override returns (address) {
        return address(_decisionRegistry);
    }

    /// @inheritdoc IClarioRegistry
    function settlementRegistry() external view override returns (address) {
        return address(_settlementRegistry);
    }

    /// @inheritdoc IClarioRegistry
    function isApprovalValid(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        return _decisionRegistry.isApprovalValid(workspaceId, expenseId, version);
    }

    /// @inheritdoc IClarioRegistry
    function isSettled(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        return _settlementRegistry.isSettled(workspaceId, expenseId, version);
    }

    /// @inheritdoc IClarioRegistry
    function isExpenseSettled(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        override
        returns (bool)
    {
        return _settlementRegistry.isExpenseSettled(workspaceId, expenseId);
    }

    /// @inheritdoc IClarioRegistry
    function getCurrentVersion(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        override
        returns (uint32)
    {
        return _expenseRegistry.getCurrentVersion(workspaceId, expenseId);
    }

    /// @inheritdoc IClarioRegistry
    function getCommitment(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bytes32)
    {
        return _expenseRegistry.getCommitment(workspaceId, expenseId, version);
    }

    /// @inheritdoc IClarioRegistry
    function isWorkspace(bytes32 workspaceId) external view override returns (bool) {
        return _workspaceRegistry.isWorkspace(workspaceId);
    }

    /// @inheritdoc IClarioRegistry
    function hasRole(bytes32 workspaceId, address account, bytes32 role)
        external
        view
        override
        returns (bool)
    {
        return _workspaceRegistry.hasRole(workspaceId, account, role);
    }
}
