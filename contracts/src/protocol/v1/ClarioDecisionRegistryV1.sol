// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioDecisionRegistryV1 } from "./interfaces/IClarioDecisionRegistryV1.sol";
import { IClarioWorkspaceRegistryV1 } from "./interfaces/IClarioWorkspaceRegistryV1.sol";
import { IClarioExpenseRegistryV1 } from "./interfaces/IClarioExpenseRegistryV1.sol";

/// @title ClarioDecisionRegistryV1
/// @notice Implements the onchain decision registry for Clario expense claims on Monad.
/// @dev Enforces exact-version binding, reviewer authority under workspace policy, self-approval prevention,
/// single-use replay protection via EIP-712 typed data signatures, and supersession invalidation.
contract ClarioDecisionRegistryV1 is IClarioDecisionRegistryV1 {
    /// @notice Standard role identifier for expense approvers.
    bytes32 public constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;

    /// @notice Global scope for role authorization.
    bytes32 public constant GLOBAL_SCOPE = bytes32(0);

    /// @notice EIP-712 Domain TypeHash.
    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// @notice EIP-712 ClarioApproval struct TypeHash matching @clario/protocol.
    bytes32 public constant CLARIO_APPROVAL_TYPEHASH = keccak256(
        "ClarioApproval(bytes32 workspaceId,bytes32 expenseId,uint32 version,bytes32 commitment,uint8 decision,bytes32 reasonCommitment,uint32 policyVersion,uint256 nonce,uint256 expiration)"
    );

    bytes32 private immutable _NAME_HASH = keccak256(bytes("ClarioApproval"));
    bytes32 private immutable _VERSION_HASH = keccak256(bytes("1"));

    IClarioWorkspaceRegistryV1 private immutable _workspaceRegistry;
    IClarioExpenseRegistryV1 private immutable _expenseRegistry;

    /// @dev workspaceId => expenseId => version => DecisionRecord
    mapping(bytes32 => mapping(bytes32 => mapping(uint32 => DecisionRecord))) private _decisions;

    /// @dev workspaceId => expenseId => version => hasDecisionRecorded
    mapping(bytes32 => mapping(bytes32 => mapping(uint32 => bool))) private _hasDecision;

    /// @notice Signer nonces for EIP-712 replay protection.
    mapping(address => uint256) public override nonces;

    constructor(address workspaceRegistryAddress, address expenseRegistryAddress) {
        if (workspaceRegistryAddress == address(0) || expenseRegistryAddress == address(0)) {
            revert Unauthorized();
        }
        _workspaceRegistry = IClarioWorkspaceRegistryV1(workspaceRegistryAddress);
        _expenseRegistry = IClarioExpenseRegistryV1(expenseRegistryAddress);
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function workspaceRegistry() external view override returns (address) {
        return address(_workspaceRegistry);
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function expenseRegistry() external view override returns (address) {
        return address(_expenseRegistry);
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)
            )
        );
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function recordDecision(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        Decision decision,
        bytes32 reasonCommitment
    ) external override {
        uint32 policyVersion = _workspaceRegistry.getPolicyVersion(workspaceId);
        _recordDecisionInternal(
            workspaceId,
            expenseId,
            version,
            commitment,
            decision,
            reasonCommitment,
            msg.sender,
            policyVersion
        );
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function recordDecisionBySig(ApprovalAuthorization calldata auth, uint8 v, bytes32 r, bytes32 s)
        external
        override
    {
        if (block.timestamp >= auth.expiration) {
            revert SignatureExpired();
        }

        if (auth.policyVersion != _workspaceRegistry.getPolicyVersion(auth.workspaceId)) {
            revert PolicyVersionMismatch();
        }

        // Anti-malleability check
        if (
            uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
                || (v != 27 && v != 28)
        ) {
            revert InvalidSignature();
        }

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), _hashApprovalAuthorization(auth))
        );

        address reviewer = ecrecover(digest, v, r, s);
        if (reviewer == address(0)) {
            revert InvalidSignature();
        }

        if (auth.nonce != nonces[reviewer]) {
            revert InvalidNonce();
        }
        nonces[reviewer] = auth.nonce + 1;

        _recordDecisionInternal(
            auth.workspaceId,
            auth.expenseId,
            auth.version,
            auth.commitment,
            auth.decision,
            auth.reasonCommitment,
            reviewer,
            auth.policyVersion
        );
    }

    function _hashApprovalAuthorization(ApprovalAuthorization calldata auth)
        private
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                CLARIO_APPROVAL_TYPEHASH,
                auth.workspaceId,
                auth.expenseId,
                auth.version,
                auth.commitment,
                uint8(auth.decision),
                auth.reasonCommitment,
                auth.policyVersion,
                auth.nonce,
                auth.expiration
            )
        );
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function isApprovalValid(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        if (!_hasDecision[workspaceId][expenseId][version]) {
            return false;
        }

        DecisionRecord storage rec = _decisions[workspaceId][expenseId][version];
        if (rec.decision != Decision.Approve) {
            return false;
        }

        // In accordance with R-003, R-005, and architecture.md §6.5 invariant 7:
        // A superseded version cannot authorize settlement.
        if (_expenseRegistry.isVersionSuperseded(workspaceId, expenseId, version)) {
            return false;
        }

        if (_expenseRegistry.getCurrentVersion(workspaceId, expenseId) != version) {
            return false;
        }

        if (_expenseRegistry.getCurrentCommitment(workspaceId, expenseId) != rec.commitment) {
            return false;
        }

        return true;
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function getDecision(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (Decision)
    {
        return _decisions[workspaceId][expenseId][version].decision;
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function getDecisionRecord(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (DecisionRecord memory)
    {
        if (!_hasDecision[workspaceId][expenseId][version]) {
            revert DecisionNotFound();
        }
        return _decisions[workspaceId][expenseId][version];
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function getReviewer(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (address)
    {
        return _decisions[workspaceId][expenseId][version].reviewer;
    }

    /// @inheritdoc IClarioDecisionRegistryV1
    function hasDecision(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        override
        returns (bool)
    {
        return _hasDecision[workspaceId][expenseId][version];
    }

    function _recordDecisionInternal(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        Decision decision,
        bytes32 reasonCommitment,
        address reviewer,
        uint32 policyVersion
    ) internal {
        if (_expenseRegistry.isWorkspacePaused(workspaceId)) {
            revert WorkspacePausedError();
        }

        if (decision == Decision.None) {
            revert InvalidDecision();
        }

        if (
            (decision == Decision.Reject || decision == Decision.RequestChanges)
                && reasonCommitment == bytes32(0)
        ) {
            revert ReasonCommitmentRequired();
        }

        uint32 currentVer = _expenseRegistry.getCurrentVersion(workspaceId, expenseId);
        if (currentVer == 0) {
            revert ExpenseNotFound();
        }

        if (version != currentVer) {
            revert VersionNotCurrent();
        }

        if (_expenseRegistry.isVersionSuperseded(workspaceId, expenseId, version)) {
            revert VersionSuperseded();
        }

        bytes32 currentCommit = _expenseRegistry.getCurrentCommitment(workspaceId, expenseId);
        if (commitment != currentCommit) {
            revert CommitmentMismatch();
        }

        if (_hasDecision[workspaceId][expenseId][version]) {
            revert DecisionAlreadyRecorded();
        }

        address submitter = _expenseRegistry.getSubmitter(workspaceId, expenseId, version);
        if (reviewer == submitter && decision == Decision.Approve) {
            revert SelfApprovalNotAllowed();
        }

        if (!_workspaceRegistry.hasRoleScoped(workspaceId, reviewer, APPROVER_ROLE, GLOBAL_SCOPE)) {
            revert Unauthorized();
        }

        _decisions[workspaceId][expenseId][version] = DecisionRecord({
            decision: decision,
            commitment: commitment,
            reviewer: reviewer,
            reasonCommitment: reasonCommitment,
            policyVersion: policyVersion,
            decidedAtBlock: uint64(block.number),
            decidedAtTimestamp: uint64(block.timestamp)
        });
        _hasDecision[workspaceId][expenseId][version] = true;

        emit DecisionRecorded(
            workspaceId, expenseId, version, commitment, reviewer, uint8(decision), reasonCommitment
        );
    }
}
