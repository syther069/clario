// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IClarioDecisionRegistryV1
/// @notice Interface for Clario onchain expense decision registry.
/// @dev Manages reviewer decisions (Approve, Reject, RequestChanges) bound to an exact current commitment.
/// Supports both direct calls and relayed EIP-712 typed signatures.
interface IClarioDecisionRegistryV1 {
    /// @notice Decision outcomes matching @clario/protocol OnchainDecision enum.
    enum Decision {
        None, // 0
        Approve, // 1
        Reject, // 2
        RequestChanges // 3
    }

    /// @notice Full stored decision record for an expense version.
    struct DecisionRecord {
        Decision decision;
        bytes32 commitment;
        address reviewer;
        bytes32 reasonCommitment;
        uint32 policyVersion;
        uint64 decidedAtBlock;
        uint64 decidedAtTimestamp;
    }

    /// @notice Emitted when an authorized reviewer records a decision for an exact expense version.
    /// @dev See architecture.md §6.4. Contains zero private evidence, merchant, or raw purpose data.
    event DecisionRecorded(
        bytes32 indexed workspaceId,
        bytes32 indexed expenseId,
        uint32 indexed version,
        bytes32 commitment,
        address reviewer,
        uint8 decision,
        bytes32 reasonCommitment
    );

    // Custom errors
    error Unauthorized();
    error WorkspaceNotFound();
    error ExpenseNotFound();
    error VersionNotCurrent();
    error CommitmentMismatch();
    error VersionSuperseded();
    error InvalidDecision();
    error ReasonCommitmentRequired();
    error SelfApprovalNotAllowed();
    error DecisionAlreadyRecorded();
    error DecisionNotFound();
    error InvalidNonce();
    error SignatureExpired();
    error InvalidSignature();
    error PolicyVersionMismatch();
    error WorkspacePausedError();

    /// @notice Authorization message payload for relayed EIP-712 typed signatures.
    /// @dev Matches ClarioApproval EIP-712 struct and @clario/protocol ClarioApprovalMessage.
    struct ApprovalAuthorization {
        bytes32 workspaceId;
        bytes32 expenseId;
        uint32 version;
        bytes32 commitment;
        Decision decision;
        bytes32 reasonCommitment;
        uint32 policyVersion;
        uint256 nonce;
        uint256 expiration;
    }

    /// @notice Direct invocation to record a decision by an authorized reviewer.
    /// @param workspaceId Identifier of the workspace.
    /// @param expenseId Identifier of the expense.
    /// @param version Version being reviewed (must equal current version).
    /// @param commitment Expected commitment of the current version.
    /// @param decision Decision outcome (Approve, Reject, or RequestChanges).
    /// @param reasonCommitment Hash of reason (required for Reject and RequestChanges, optional for Approve).
    function recordDecision(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        Decision decision,
        bytes32 reasonCommitment
    ) external;

    /// @notice Relayed EIP-712 typed signature invocation to record a decision.
    /// @param auth Complete typed authorization struct.
    /// @param v ECDSA recovery byte.
    /// @param r ECDSA r parameter.
    /// @param s ECDSA s parameter.
    function recordDecisionBySig(ApprovalAuthorization calldata auth, uint8 v, bytes32 r, bytes32 s)
        external;

    /// @notice Returns true if the expense version has an active, unsuperseded Approve decision.
    /// @dev In accordance with architecture.md §6.5 invariant 7, if the expense version has been superseded
    /// by a newer version, this returns false even though the historical approval record remains intact.
    function isApprovalValid(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns the recorded decision outcome for an expense version.
    function getDecision(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (Decision);

    /// @notice Returns the complete decision record for an expense version.
    function getDecisionRecord(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (DecisionRecord memory);

    /// @notice Returns the reviewer address that signed/recorded the decision.
    function getReviewer(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (address);

    /// @notice Returns true if a decision has already been recorded for this expense version.
    function hasDecision(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns the next expected replay-protection nonce for an approver.
    function nonces(address signer) external view returns (uint256);

    /// @notice Returns the EIP-712 domain separator used for relayed approvals.
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns the address of the bound workspace registry.
    function workspaceRegistry() external view returns (address);

    /// @notice Returns the address of the bound expense registry.
    function expenseRegistry() external view returns (address);
}
