// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    IClarioExpenseRegistryV1
} from "../src/protocol/v1/interfaces/IClarioExpenseRegistryV1.sol";
import { ClarioExpenseRegistryV1 } from "../src/protocol/v1/ClarioExpenseRegistryV1.sol";
import { ClarioWorkspaceRegistryV1 } from "../src/protocol/v1/ClarioWorkspaceRegistryV1.sol";

interface Vm {
    function roll(uint256 newHeight) external;
    function expectRevert(bytes4 revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
}

contract ClarioExpenseRegistryV1Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ClarioWorkspaceRegistryV1 internal workspaceRegistry;
    ClarioExpenseRegistryV1 internal expenseRegistry;

    bytes32 internal constant WORKSPACE_A =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 internal constant WORKSPACE_B =
        0x2222222222222222222222222222222222222222222222222222222222222222;
    bytes32 internal constant UNREGISTERED_WS =
        0x3333333333333333333333333333333333333333333333333333333333333333;

    bytes32 internal constant EXPENSE_1 =
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
    bytes32 internal constant EXPENSE_2 =
        0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb;

    bytes32 internal constant COMMITMENT_V1 =
        0x0101010101010101010101010101010101010101010101010101010101010101;
    bytes32 internal constant COMMITMENT_V2 =
        0x0202020202020202020202020202020202020202020202020202020202020202;
    bytes32 internal constant COMMITMENT_V3 =
        0x0303030303030303030303030303030303030303030303030303030303030303;

    bytes32 internal constant POLICY_INIT =
        0x9999999999999999999999999999999999999999999999999999999999999999;

    address internal owner = address(0x1001);
    address internal submitter = address(0x1002);
    address internal stranger = address(0x1009);

    function setUp() public {
        workspaceRegistry = new ClarioWorkspaceRegistryV1();
        expenseRegistry = new ClarioExpenseRegistryV1(address(workspaceRegistry));

        // Register WORKSPACE_A with owner
        vm.prank(owner);
        workspaceRegistry.createWorkspace(WORKSPACE_A, POLICY_INIT);

        // Register WORKSPACE_B with owner
        vm.prank(owner);
        workspaceRegistry.createWorkspace(WORKSPACE_B, POLICY_INIT);
    }

    // ------------------------------------------------------------------------
    // Version 1 Submission Tests
    // ------------------------------------------------------------------------

    function testSubmitVersion1Success() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == 1);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, EXPENSE_1) == COMMITMENT_V1);
        assert(expenseRegistry.getCommitment(WORKSPACE_A, EXPENSE_1, 1) == COMMITMENT_V1);
        assert(expenseRegistry.getSubmitter(WORKSPACE_A, EXPENSE_1, 1) == submitter);
        assert(
            expenseRegistry.getSubmittedAtBlock(WORKSPACE_A, EXPENSE_1, 1) == uint64(block.number)
        );
        assert(expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 1));
        assert(!expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testSubmitVersion1EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IClarioExpenseRegistryV1.ExpenseVersionSubmitted(
            WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, submitter
        );

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));
    }

    function testSubmitVersion1RejectsNonZeroPredecessor() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidPredecessorCommitment.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, COMMITMENT_V2);
    }

    function testSubmitVersion1RejectsReuse() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidVersion.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V2, bytes32(0));
    }

    // ------------------------------------------------------------------------
    // Successor Version Submission & Supersession Tests
    // ------------------------------------------------------------------------

    function testSubmitVersion2SuccessAndSupersession() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        vm.expectEmit(true, true, false, true);
        emit IClarioExpenseRegistryV1.ExpenseVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1, 2);

        vm.expectEmit(true, true, true, true);
        emit IClarioExpenseRegistryV1.ExpenseVersionSubmitted(
            WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, submitter
        );

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, COMMITMENT_V1);

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == 2);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, EXPENSE_1) == COMMITMENT_V2);
        assert(expenseRegistry.getCommitment(WORKSPACE_A, EXPENSE_1, 1) == COMMITMENT_V1);
        assert(expenseRegistry.getCommitment(WORKSPACE_A, EXPENSE_1, 2) == COMMITMENT_V2);

        // Version 1 is superseded, no longer current
        assert(expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1));
        assert(!expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 1));

        // Version 2 is current, not superseded
        assert(!expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 2));
        assert(expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 2));
    }

    function testSubmitVersion2RejectsWrongPredecessor() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        bytes32 wrongPriorCommitment = keccak256("WRONG_COMMITMENT");
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidPredecessorCommitment.selector);
        expenseRegistry.submitVersion(
            WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, wrongPriorCommitment
        );
    }

    function testSubmitVersionRejectsSkippedVersion() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        // Try skipping version 2 and submitting version 3
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidVersion.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 3, COMMITMENT_V3, COMMITMENT_V1);
    }

    function testSubmitVersionChainMonotonic() public {
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, COMMITMENT_V1);

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 3, COMMITMENT_V3, COMMITMENT_V2);

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == 3);
        assert(expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1));
        assert(expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 2));
        assert(!expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 3));
        assert(expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 3));
    }

    // ------------------------------------------------------------------------
    // Validation and Isolation Tests
    // ------------------------------------------------------------------------

    function testRejectsZeroWorkspaceId() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidWorkspaceId.selector);
        expenseRegistry.submitVersion(bytes32(0), EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));
    }

    function testRejectsZeroExpenseId() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidExpenseId.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, bytes32(0), 1, COMMITMENT_V1, bytes32(0));
    }

    function testRejectsZeroCommitment() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidCommitment.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, bytes32(0), bytes32(0));
    }

    function testRejectsUnregisteredWorkspace() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.WorkspaceNotFound.selector);
        expenseRegistry.submitVersion(UNREGISTERED_WS, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));
    }

    function testRejectsZeroVersion() public {
        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.InvalidVersion.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 0, COMMITMENT_V1, bytes32(0));
    }

    function testCrossWorkspaceExpenseIsolation() public {
        // Submit EXPENSE_1 in WORKSPACE_A
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        // Submit EXPENSE_1 in WORKSPACE_B with different commitment
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_B, EXPENSE_1, 1, COMMITMENT_V2, bytes32(0));

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == 1);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, EXPENSE_1) == COMMITMENT_V1);

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_B, EXPENSE_1) == 1);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_B, EXPENSE_1) == COMMITMENT_V2);

        // Advance version in WORKSPACE_A
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V3, COMMITMENT_V1);

        // WORKSPACE_A is version 2; WORKSPACE_B remains version 1
        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == 2);
        assert(expenseRegistry.getCurrentVersion(WORKSPACE_B, EXPENSE_1) == 1);
    }

    // ------------------------------------------------------------------------
    // Pause Behavior Tests
    // ------------------------------------------------------------------------

    function testOwnerCanPauseAndUnpause() public {
        assert(!expenseRegistry.isWorkspacePaused(WORKSPACE_A));

        vm.expectEmit(true, true, false, false);
        emit IClarioExpenseRegistryV1.WorkspacePaused(WORKSPACE_A, owner);

        vm.prank(owner);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);
        assert(expenseRegistry.isWorkspacePaused(WORKSPACE_A));

        vm.expectEmit(true, true, false, false);
        emit IClarioExpenseRegistryV1.WorkspaceUnpaused(WORKSPACE_A, owner);

        vm.prank(owner);
        expenseRegistry.unpauseWorkspace(WORKSPACE_A);
        assert(!expenseRegistry.isWorkspacePaused(WORKSPACE_A));
    }

    function testNonOwnerCannotPause() public {
        vm.prank(stranger);
        vm.expectRevert(IClarioExpenseRegistryV1.Unauthorized.selector);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);

        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.Unauthorized.selector);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);
    }

    function testPausedWorkspaceBlocksSubmissions() public {
        vm.prank(owner);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);

        vm.prank(submitter);
        vm.expectRevert(IClarioExpenseRegistryV1.WorkspacePausedError.selector);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));
    }

    function testPausedWorkspacePreservesHistoricalReads() public {
        // Submit version 1 before pause
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));

        // Record historical query results before pause
        uint32 prePauseVer = expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1);
        bytes32 prePauseCommitment = expenseRegistry.getCurrentCommitment(WORKSPACE_A, EXPENSE_1);
        address prePauseSubmitter = expenseRegistry.getSubmitter(WORKSPACE_A, EXPENSE_1, 1);
        uint64 prePauseBlock = expenseRegistry.getSubmittedAtBlock(WORKSPACE_A, EXPENSE_1, 1);
        bool prePauseSuperseded = expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1);
        bool prePauseCurrent = expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 1);

        // Pause the workspace
        vm.prank(owner);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);

        // Verify historical reads remain completely unchanged and functional during pause
        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, EXPENSE_1) == prePauseVer);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, EXPENSE_1) == prePauseCommitment);
        assert(expenseRegistry.getSubmitter(WORKSPACE_A, EXPENSE_1, 1) == prePauseSubmitter);
        assert(expenseRegistry.getSubmittedAtBlock(WORKSPACE_A, EXPENSE_1, 1) == prePauseBlock);
        assert(expenseRegistry.isVersionSuperseded(WORKSPACE_A, EXPENSE_1, 1) == prePauseSuperseded);
        assert(expenseRegistry.isCurrentVersion(WORKSPACE_A, EXPENSE_1, 1) == prePauseCurrent);
    }

    // ------------------------------------------------------------------------
    // Fuzz Testing
    // ------------------------------------------------------------------------

    function testFuzzVersionProgression(bytes32 expenseId, bytes32 commit1, bytes32 commit2)
        public
    {
        if (expenseId == bytes32(0) || commit1 == bytes32(0) || commit2 == bytes32(0)) {
            return;
        }

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, expenseId, 1, commit1, bytes32(0));

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, expenseId) == 1);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, expenseId) == commit1);

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, expenseId, 2, commit2, commit1);

        assert(expenseRegistry.getCurrentVersion(WORKSPACE_A, expenseId) == 2);
        assert(expenseRegistry.getCurrentCommitment(WORKSPACE_A, expenseId) == commit2);
        assert(expenseRegistry.isVersionSuperseded(WORKSPACE_A, expenseId, 1));
        assert(expenseRegistry.isCurrentVersion(WORKSPACE_A, expenseId, 2));
    }
}
