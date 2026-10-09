// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IClarioSettlementRegistryV1
/// @notice Interface for Clario onchain expense settlement registry on Monad.
/// @dev Manages atomic ERC-20 token reimbursements tied to approved current expense versions.
interface IClarioSettlementRegistryV1 {
    /// @notice Stored onchain settlement record for an expense version.
    struct SettlementRecord {
        bool settled;
        address token;
        address recipient;
        uint256 amount;
        bytes32 paymentReference;
        address executor;
        uint64 settledAtBlock;
        uint64 settledAtTimestamp;
    }

    /// @notice Emitted when an approved expense claim is reimbursed.
    /// @dev See architecture.md §6.4 and packages/protocol/src/events.ts.
    event SettlementRecorded(
        bytes32 indexed workspaceId,
        bytes32 indexed expenseId,
        uint32 indexed version,
        bytes32 commitment,
        address token,
        address recipient,
        uint256 amount,
        bytes32 paymentReference
    );

    // Custom errors
    error Unauthorized();
    error WorkspaceNotFound();
    error WorkspacePausedError();
    error ExpenseNotFound();
    error VersionNotCurrent();
    error CommitmentMismatch();
    error ApprovalNotValid();
    error DuplicateSettlement();
    error InvalidToken();
    error InvalidRecipient();
    error InvalidAmount();
    error TokenTransferFailed();
    error ReentrancyGuardReentrantCall();
    error SettlementNotFound();

    /// @notice Reimburses an approved expense version with an explicit payment reference.
    /// @param workspaceId Identifier of the workspace.
    /// @param expenseId Identifier of the expense.
    /// @param version Current version being settled.
    /// @param commitment Expected current commitment.
    /// @param token ERC-20 token address used for reimbursement.
    /// @param recipient Checksummed address of the reimbursement recipient.
    /// @param amount Amount in token base units.
    /// @param paymentReference Opaque payment reference identifier.
    function reimburse(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        address token,
        address recipient,
        uint256 amount,
        bytes32 paymentReference
    ) external;

    /// @notice Reimburses an approved expense version with a deterministically generated payment reference.
    /// @param workspaceId Identifier of the workspace.
    /// @param expenseId Identifier of the expense.
    /// @param version Current version being settled.
    /// @param commitment Expected current commitment.
    /// @param token ERC-20 token address used for reimbursement.
    /// @param recipient Checksummed address of the reimbursement recipient.
    /// @param amount Amount in token base units.
    function reimburse(
        bytes32 workspaceId,
        bytes32 expenseId,
        uint32 version,
        bytes32 commitment,
        address token,
        address recipient,
        uint256 amount
    ) external;

    /// @notice Returns true if the expense version has been settled.
    function isSettled(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (bool);

    /// @notice Returns true if the expense has been settled across any version.
    function isExpenseSettled(bytes32 workspaceId, bytes32 expenseId)
        external
        view
        returns (bool);

    /// @notice Returns the full settlement record for an expense version.
    function getSettlementRecord(bytes32 workspaceId, bytes32 expenseId, uint32 version)
        external
        view
        returns (SettlementRecord memory);

    /// @notice Returns the address of the bound workspace registry.
    function workspaceRegistry() external view returns (address);

    /// @notice Returns the address of the bound expense registry.
    function expenseRegistry() external view returns (address);

    /// @notice Returns the address of the bound decision registry.
    function decisionRegistry() external view returns (address);
}
