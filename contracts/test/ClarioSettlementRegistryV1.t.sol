// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    IClarioSettlementRegistryV1
} from "../src/protocol/v1/interfaces/IClarioSettlementRegistryV1.sol";
import {
    IClarioDecisionRegistryV1
} from "../src/protocol/v1/interfaces/IClarioDecisionRegistryV1.sol";
import {
    IClarioExpenseRegistryV1
} from "../src/protocol/v1/interfaces/IClarioExpenseRegistryV1.sol";
import {
    IClarioWorkspaceRegistryV1
} from "../src/protocol/v1/interfaces/IClarioWorkspaceRegistryV1.sol";
import { ClarioWorkspaceRegistryV1 } from "../src/protocol/v1/ClarioWorkspaceRegistryV1.sol";
import { ClarioExpenseRegistryV1 } from "../src/protocol/v1/ClarioExpenseRegistryV1.sol";
import { ClarioDecisionRegistryV1 } from "../src/protocol/v1/ClarioDecisionRegistryV1.sol";
import { ClarioSettlementRegistryV1 } from "../src/protocol/v1/ClarioSettlementRegistryV1.sol";

interface Vm {
    function expectRevert(bytes4 revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;
    function prank(address msgSender) external;
}

// ----------------------------------------------------------------------------
// Mock ERC-20 Tokens
// ----------------------------------------------------------------------------

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        virtual
        returns (bool)
    {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

contract MockRevertingERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("transfer reverted");
    }
}

contract MockFalseERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract MockReentrantERC20 {
    ClarioSettlementRegistryV1 internal settlementRegistry;
    bytes32 internal workspaceId;
    bytes32 internal expenseId;
    uint32 internal version;
    bytes32 internal commitment;

    function setAttackContext(address reg, bytes32 wId, bytes32 eId, uint32 ver, bytes32 commit)
        external
    {
        settlementRegistry = ClarioSettlementRegistryV1(reg);
        workspaceId = wId;
        expenseId = eId;
        version = ver;
        commitment = commit;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        // Attempt reentrant call into settlementRegistry
        settlementRegistry.reimburse(
            workspaceId, expenseId, version, commitment, address(this), address(0x123), 100
        );
        return true;
    }
}

// ----------------------------------------------------------------------------
// Test Suite
// ----------------------------------------------------------------------------

contract ClarioSettlementRegistryV1Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ClarioWorkspaceRegistryV1 internal workspaceRegistry;
    ClarioExpenseRegistryV1 internal expenseRegistry;
    ClarioDecisionRegistryV1 internal decisionRegistry;
    ClarioSettlementRegistryV1 internal settlementRegistry;
    MockERC20 internal token;

    bytes32 internal constant WORKSPACE_A = keccak256("WORKSPACE_A");
    bytes32 internal constant EXPENSE_1 = keccak256("EXPENSE_1");
    bytes32 internal constant EXPENSE_2 = keccak256("EXPENSE_2");
    bytes32 internal constant COMMITMENT_V1 = keccak256("COMMITMENT_V1");
    bytes32 internal constant COMMITMENT_V2 = keccak256("COMMITMENT_V2");
    bytes32 internal constant POLICY_V1 = keccak256("POLICY_V1");
    bytes32 internal constant PAYMENT_REF = keccak256("PAYMENT_REF_456");

    bytes32 internal constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;
    bytes32 internal constant TREASURY_ROLE =
        0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9;

    address internal owner = address(0x1);
    address internal submitter = address(0x2);
    address internal approver = address(0x3);
    address internal treasury = address(0x4);
    address internal recipient = address(0x5);
    address internal stranger = address(0x999);

    function setUp() public {
        workspaceRegistry = new ClarioWorkspaceRegistryV1();
        expenseRegistry = new ClarioExpenseRegistryV1(address(workspaceRegistry));
        decisionRegistry =
            new ClarioDecisionRegistryV1(address(workspaceRegistry), address(expenseRegistry));
        settlementRegistry = new ClarioSettlementRegistryV1(
            address(workspaceRegistry), address(expenseRegistry), address(decisionRegistry)
        );

        token = new MockERC20();
        token.mint(treasury, 1_000_000);
        vm.prank(treasury);
        token.approve(address(settlementRegistry), type(uint256).max);

        // Setup workspace A
        vm.prank(owner);
        workspaceRegistry.createWorkspace(WORKSPACE_A, POLICY_V1);

        // Grant roles
        vm.prank(owner);
        workspaceRegistry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));
        vm.prank(owner);
        workspaceRegistry.grantRole(WORKSPACE_A, treasury, TREASURY_ROLE, bytes32(0));

        // Submit version 1 of EXPENSE_1
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        // Approve version 1 of EXPENSE_1
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testReimburseSuccessWithExplicitPaymentReference() public {
        uint256 amount = 50_000;

        vm.expectEmit(true, true, true, true);
        emit IClarioSettlementRegistryV1.SettlementRecorded(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount, PAYMENT_REF
        );

        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount, PAYMENT_REF
        );

        assert(settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
        assert(token.balanceOf(recipient) == amount);
        assert(token.balanceOf(treasury) == 1_000_000 - amount);

        IClarioSettlementRegistryV1.SettlementRecord memory rec =
            settlementRegistry.getSettlementRecord(WORKSPACE_A, EXPENSE_1, 1);
        assert(rec.settled);
        assert(rec.token == address(token));
        assert(rec.recipient == recipient);
        assert(rec.amount == amount);
        assert(rec.paymentReference == PAYMENT_REF);
        assert(rec.executor == treasury);
    }

    function testReimburseSuccessWithDefaultPaymentReference() public {
        uint256 amount = 25_000;

        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount
        );

        assert(settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
        assert(token.balanceOf(recipient) == amount);

        IClarioSettlementRegistryV1.SettlementRecord memory rec =
            settlementRegistry.getSettlementRecord(WORKSPACE_A, EXPENSE_1, 1);
        assert(rec.settled);
        assert(rec.paymentReference != bytes32(0));
    }

    function testRejectsDuplicateSettlement() public {
        uint256 amount = 10_000;

        // First reimbursement succeeds
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount
        );

        // Second reimbursement for same version must revert
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.DuplicateSettlement.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount
        );
        assert(settlementRegistry.isExpenseSettled(WORKSPACE_A, EXPENSE_1));
    }

    function testRejectsDuplicateSettlementAcrossVersions() public {
        uint256 amount = 10_000;
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount
        );
        assert(settlementRegistry.isExpenseSettled(WORKSPACE_A, EXPENSE_1));

        // Submit version 2 for EXPENSE_1
        bytes32 commitmentV2 = keccak256("COMMITMENT_V2");
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, commitmentV2, COMMITMENT_V1);

        // Approver approves version 2
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            2,
            commitmentV2,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Treasury attempting to reimburse version 2 of the ALREADY SETTLED expense must revert!
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.DuplicateSettlement.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 2, commitmentV2, address(token), recipient, amount
        );
    }

    function testSeparateExpenseSucceedsAndIsNotBlocked() public {
        uint256 amount = 10_000;
        // Settle EXPENSE_1
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, amount
        );
        assert(settlementRegistry.isExpenseSettled(WORKSPACE_A, EXPENSE_1));

        // Submit and approve separate EXPENSE_2
        bytes32 commitment2 = keccak256("COMMITMENT_EXPENSE_2");
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_2, 1, commitment2, bytes32(0));

        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_2,
            1,
            commitment2,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Separate expense settlement MUST succeed
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_2, 1, commitment2, address(token), recipient, amount
        );
        assert(settlementRegistry.isExpenseSettled(WORKSPACE_A, EXPENSE_2));
        assert(settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_2, 1));
    }

    function testRejectsUnapprovedExpense() public {
        // Submit expense 2 but do not approve it
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_2, 1, COMMITMENT_V1, bytes32(0));

        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.ApprovalNotValid.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_2, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );
    }

    function testRejectsRejectedExpense() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_2, 1, COMMITMENT_V1, bytes32(0));

        // Approver rejects expense 2
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_2,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Reject,
            keccak256("REASON")
        );

        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.ApprovalNotValid.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_2, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );
    }

    function testSupersededVersionCannotBeSettled() public {
        // Version 1 is approved. Now submit version 2
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, COMMITMENT_V1);

        // Attempting to settle version 1 must revert
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.VersionNotCurrent.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );

        // Attempting to settle version 2 before approval must revert
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.ApprovalNotValid.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, address(token), recipient, 10_000
        );

        // Approve version 2
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            2,
            COMMITMENT_V2,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Settle version 2 succeeds!
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, address(token), recipient, 10_000
        );
        assert(settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 2));
    }

    function testRejectsWrongCommitment() public {
        bytes32 wrongCommit = keccak256("WRONG_COMMIT");
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.CommitmentMismatch.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, wrongCommit, address(token), recipient, 10_000
        );
    }

    function testRejectsUnauthorizedCaller() public {
        vm.prank(stranger);
        vm.expectRevert(IClarioSettlementRegistryV1.Unauthorized.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );
    }

    function testRejectsInvalidInputs() public {
        // Zero token address
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.InvalidToken.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(0), recipient, 10_000
        );

        // Non-contract token address (EOA)
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.InvalidToken.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(0x12345), recipient, 10_000
        );

        // Zero recipient address
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.InvalidRecipient.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), address(0), 10_000
        );

        // Zero amount
        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.InvalidAmount.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, 0
        );
    }

    function testTransferFailureDoesNotMarkSettled() public {
        MockRevertingERC20 badToken = new MockRevertingERC20();

        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.TokenTransferFailed.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(badToken), recipient, 10_000
        );

        // Settlement must remain FALSE
        assert(!settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testFalseReturningTokenReverts() public {
        MockFalseERC20 falseToken = new MockFalseERC20();

        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.TokenTransferFailed.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(falseToken), recipient, 10_000
        );

        assert(!settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testReentrantAttackIsBlocked() public {
        MockReentrantERC20 reentrantToken = new MockReentrantERC20();
        reentrantToken.setAttackContext(
            address(settlementRegistry), WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1
        );

        vm.prank(treasury);
        // During transferFrom, reentrant call into reimburse fails reentrancy check, causing call to fail
        vm.expectRevert(IClarioSettlementRegistryV1.TokenTransferFailed.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(reentrantToken), recipient, 10_000
        );

        assert(!settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testPausedWorkspaceBlocksReimbursement() public {
        vm.prank(owner);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);

        vm.prank(treasury);
        vm.expectRevert(IClarioSettlementRegistryV1.WorkspacePausedError.selector);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );

        // Unpause
        vm.prank(owner);
        expenseRegistry.unpauseWorkspace(WORKSPACE_A);

        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, address(token), recipient, 10_000
        );
        assert(settlementRegistry.isSettled(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testGetSettlementRecordRevertsWhenNotFound() public {
        vm.expectRevert(IClarioSettlementRegistryV1.SettlementNotFound.selector);
        settlementRegistry.getSettlementRecord(WORKSPACE_A, EXPENSE_1, 1);
    }

    // ------------------------------------------------------------------------
    // Fuzz Testing
    // ------------------------------------------------------------------------

    function testFuzzReimburse(uint128 amount, address fuzzedRecipient) public {
        if (amount == 0 || fuzzedRecipient == address(0)) return;

        bytes32 expenseId = keccak256(abi.encode("FUZZ_EXPENSE", amount, fuzzedRecipient));
        bytes32 commitment = keccak256(abi.encode("FUZZ_COMMIT", amount));

        // Submit
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, expenseId, 1, commitment, bytes32(0));

        // Approve
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            expenseId,
            1,
            commitment,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        token.mint(treasury, amount);

        // Reimburse
        vm.prank(treasury);
        settlementRegistry.reimburse(
            WORKSPACE_A, expenseId, 1, commitment, address(token), fuzzedRecipient, amount
        );

        assert(settlementRegistry.isSettled(WORKSPACE_A, expenseId, 1));
    }
}
