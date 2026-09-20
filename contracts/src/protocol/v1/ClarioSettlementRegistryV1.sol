// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioSettlementRegistryV1 } from "./interfaces/IClarioSettlementRegistryV1.sol";
import { IClarioWorkspaceRegistryV1 } from "./interfaces/IClarioWorkspaceRegistryV1.sol";
import { IClarioExpenseRegistryV1 } from "./interfaces/IClarioExpenseRegistryV1.sol";
import { IClarioDecisionRegistryV1 } from "./interfaces/IClarioDecisionRegistryV1.sol";

/// @title ClarioSettlementRegistryV1
/// @notice Implements the onchain settlement registry for Clario expense claims on Monad.
/// @dev Atomically binds ERC-20 reimbursement payments to approved current expense versions,
/// enforces TREASURY_ROLE authorization, safe token handling, non-reentrancy, and duplicate settlement guards.
contract ClarioSettlementRegistryV1 is IClarioSettlementRegistryV1 {
    /// @notice Role identifier for treasury operators authorized to reimburse claims.
    bytes32 public constant TREASURY_ROLE =
        0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9;

    /// @notice Global scope for role authorization.
    bytes32 public constant GLOBAL_SCOPE = bytes32(0);

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus;

    IClarioWorkspaceRegistryV1 private immutable _workspaceRegistry;
    IClarioExpenseRegistryV1 private immutable _expenseRegistry;
    IClarioDecisionRegistryV1 private immutable _decisionRegistry;

    /// @dev workspaceId => expenseId => version => SettlementRecord
    mapping(bytes32 => mapping(bytes32 => mapping(uint32 => SettlementRecord))) private
        _settlements;

    /// @dev workspaceId => expenseId => version => isSettled
    mapping(bytes32 => mapping(bytes32 => mapping(uint32 => bool))) private _isSettled;

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    constructor(
        address workspaceRegistryAddress,
        address expenseRegistryAddress,
        address decisionRegistryAddress
    ) {
        if (
            workspaceRegistryAddress == address(0) || expenseRegistryAddress == address(0)
                || decisionRegistryAddress == address(0)
        ) {
            revert Unauthorized();
        }
        _workspaceRegistry = IClarioWorkspaceRegistryV1(workspaceRegistryAddress);
        _expenseRegistry = IClarioExpenseRegistryV1(expenseRegistryAddress);
        _decisionRegistry = IClarioDecisionRegistryV1(decisionRegistryAddress);
        _reentrancyStatus = _NOT_ENTERED;
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function workspaceRegistry() external view override returns (address) {
        return address(_workspaceRegistry);
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function expenseRegistry() external view override returns (address) {
        return address(_expenseRegistry);
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function decisionRegistry() external view override returns (address) {
        return address(_decisionRegistry);
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function reimburse(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        address token,
        address recipient,
        uint256 amount
    ) external override {
        reimburse(workspaceId, expenseId, version, commitment, token, recipient, amount, bytes32(0));
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function reimburse(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        address token,
        address recipient,
        uint256 amount,
        bytes32 paymentReference
    ) public override nonReentrant {
        if (_expenseRegistry.isWorkspacePaused(workspaceId)) {
            revert WorkspacePausedError();
        }

        if (!_workspaceRegistry.hasRoleScoped(workspaceId, msg.sender, TREASURY_ROLE, GLOBAL_SCOPE))
        {
            revert Unauthorized();
        }

        if (token == address(0) || token.code.length == 0) {
            revert InvalidToken();
        }

        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (_isSettled[workspaceId][expenseId][version]) {
            revert DuplicateSettlement();
        }

        uint32 currentVer = _expenseRegistry.getCurrentVersion(workspaceId, expenseId);
        if (currentVer == 0) {
            revert ExpenseNotFound();
        }

        if (version != currentVer) {
            revert VersionNotCurrent();
        }

        bytes32 currentCommit = _expenseRegistry.getCurrentCommitment(workspaceId, expenseId);
        if (commitment != currentCommit) {
            revert CommitmentMismatch();
        }

        // Must have valid, unsuperseded current approval from decision registry
        if (!_decisionRegistry.isApprovalValid(workspaceId, expenseId, version)) {
            revert ApprovalNotValid();
        }

        bytes32 ref = paymentReference;
        if (ref == bytes32(0)) {
            ref = keccak256(
                abi.encode(
                    workspaceId,
                    expenseId,
                    version,
                    commitment,
                    token,
                    recipient,
                    amount,
                    block.chainid,
                    address(this)
                )
            );
        }

        // Checks-Effects-Interactions: record state before external token transfer
        _settlements[workspaceId][expenseId][version] = SettlementRecord({
            settled: true,
            token: token,
            recipient: recipient,
            amount: amount,
            paymentReference: ref,
            executor: msg.sender,
            settledAtBlock: uint64(block.number),
            settledAtTimestamp: uint64(block.timestamp)
        });
        _isSettled[workspaceId][expenseId][version] = true;

        _safeTransferFrom(token, msg.sender, recipient, amount);

        emit SettlementRecorded(
            workspaceId, expenseId, version, commitment, token, recipient, amount, ref
        );
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function isSettled(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        return _isSettled[workspaceId][expenseId][version];
    }

    /// @inheritdoc IClarioSettlementRegistryV1
    function getSettlementRecord(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (SettlementRecord memory)
    {
        if (!_isSettled[workspaceId][expenseId][version]) {
            revert SettlementNotFound();
        }
        return _settlements[workspaceId][expenseId][version];
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount) // transferFrom(address,address,uint256)
        );
        if (!success) {
            revert TokenTransferFailed();
        }
        if (returndata.length > 0) {
            if (!abi.decode(returndata, (bool))) {
                revert TokenTransferFailed();
            }
        }
    }
}
