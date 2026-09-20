// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

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

interface Vm {
    function roll(uint256 newHeight) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes4 revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

contract ClarioDecisionRegistryV1Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ClarioWorkspaceRegistryV1 internal workspaceRegistry;
    ClarioExpenseRegistryV1 internal expenseRegistry;
    ClarioDecisionRegistryV1 internal decisionRegistry;

    bytes32 internal constant WORKSPACE_A = keccak256("WORKSPACE_A");
    bytes32 internal constant WORKSPACE_B = keccak256("WORKSPACE_B");
    bytes32 internal constant EXPENSE_1 = keccak256("EXPENSE_1");
    bytes32 internal constant EXPENSE_2 = keccak256("EXPENSE_2");
    bytes32 internal constant COMMITMENT_V1 = keccak256("COMMITMENT_V1");
    bytes32 internal constant COMMITMENT_V2 = keccak256("COMMITMENT_V2");
    bytes32 internal constant POLICY_V1 = keccak256("POLICY_V1");
    bytes32 internal constant REASON_HASH = keccak256("REASON_REJECT_123");

    bytes32 internal constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;

    uint256 internal constant APPROVER_PK = 0xA11CE;
    address internal approver;
    address internal owner = address(0x1);
    address internal submitter = address(0x2);
    address internal stranger = address(0x999);

    function setUp() public {
        approver = vm.addr(APPROVER_PK);

        workspaceRegistry = new ClarioWorkspaceRegistryV1();
        expenseRegistry = new ClarioExpenseRegistryV1(address(workspaceRegistry));
        decisionRegistry =
            new ClarioDecisionRegistryV1(address(workspaceRegistry), address(expenseRegistry));

        // Setup workspace A
        vm.prank(owner);
        workspaceRegistry.createWorkspace(WORKSPACE_A, POLICY_V1);

        // Grant approver role
        vm.prank(owner);
        workspaceRegistry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));

        // Submit version 1 of EXPENSE_1
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 1, COMMITMENT_V1, bytes32(0));
    }

    // ------------------------------------------------------------------------
    // Direct Decisions (recordDecision)
    // ------------------------------------------------------------------------

    function testDirectRecordDecisionApprove() public {
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        assert(decisionRegistry.hasDecision(WORKSPACE_A, EXPENSE_1, 1));
        assert(
            decisionRegistry.getDecision(WORKSPACE_A, EXPENSE_1, 1)
                == IClarioDecisionRegistryV1.Decision.Approve
        );
        assert(decisionRegistry.getReviewer(WORKSPACE_A, EXPENSE_1, 1) == approver);
        assert(decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));

        IClarioDecisionRegistryV1.DecisionRecord memory rec =
            decisionRegistry.getDecisionRecord(WORKSPACE_A, EXPENSE_1, 1);
        assert(rec.decision == IClarioDecisionRegistryV1.Decision.Approve);
        assert(rec.commitment == COMMITMENT_V1);
        assert(rec.reviewer == approver);
        assert(rec.policyVersion == 1);
        assert(rec.decidedAtBlock == uint64(block.number));
    }

    function testDirectRecordDecisionEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IClarioDecisionRegistryV1.DecisionRecorded(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            approver,
            uint8(IClarioDecisionRegistryV1.Decision.Approve),
            bytes32(0)
        );

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

    function testDirectRecordDecisionRejectRequiresReason() public {
        // Without reason -> reverts
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.ReasonCommitmentRequired.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Reject,
            bytes32(0)
        );

        // With reason -> succeeds
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Reject,
            REASON_HASH
        );

        assert(decisionRegistry.hasDecision(WORKSPACE_A, EXPENSE_1, 1));
        assert(
            decisionRegistry.getDecision(WORKSPACE_A, EXPENSE_1, 1)
                == IClarioDecisionRegistryV1.Decision.Reject
        );
        assert(!decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testDirectRecordDecisionRequestChangesRequiresReason() public {
        // Without reason -> reverts
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.ReasonCommitmentRequired.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.RequestChanges,
            bytes32(0)
        );

        // With reason -> succeeds
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.RequestChanges,
            REASON_HASH
        );

        assert(decisionRegistry.hasDecision(WORKSPACE_A, EXPENSE_1, 1));
        assert(
            decisionRegistry.getDecision(WORKSPACE_A, EXPENSE_1, 1)
                == IClarioDecisionRegistryV1.Decision.RequestChanges
        );
        assert(!decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));
    }

    function testRejectsDecisionNone() public {
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.InvalidDecision.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.None,
            bytes32(0)
        );
    }

    function testRejectsUnauthorizedCaller() public {
        vm.prank(stranger);
        vm.expectRevert(IClarioDecisionRegistryV1.Unauthorized.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testRejectsSelfApproval() public {
        // Submitter is also given APPROVER_ROLE
        vm.prank(owner);
        workspaceRegistry.grantRole(WORKSPACE_A, submitter, APPROVER_ROLE, bytes32(0));

        // Submitter tries to approve own expense
        vm.prank(submitter);
        vm.expectRevert(IClarioDecisionRegistryV1.SelfApprovalNotAllowed.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testRejectsDuplicateDecisionOnSameVersion() public {
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.DecisionAlreadyRecorded.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testRejectsWrongCommitment() public {
        bytes32 wrongCommitment = keccak256("WRONG_COMMITMENT");
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.CommitmentMismatch.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            wrongCommitment,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testRejectsStaleOrWrongVersion() public {
        // Version 0
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.VersionNotCurrent.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            0,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Version 2 (not submitted yet)
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.VersionNotCurrent.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            2,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    function testRejectsNonexistentExpense() public {
        bytes32 nonexistentExpense = keccak256("DOES_NOT_EXIST");
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.ExpenseNotFound.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            nonexistentExpense,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
    }

    // ------------------------------------------------------------------------
    // Supersession & Historical Preservation
    // ------------------------------------------------------------------------

    function testSupersessionInvalidatesApproval() public {
        // Approve version 1
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        assert(decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));

        // Submitter submits version 2
        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, EXPENSE_1, 2, COMMITMENT_V2, COMMITMENT_V1);

        // Version 1 approval immediately becomes invalid for settlement
        assert(!decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));
        // Version 2 is not yet approved
        assert(!decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 2));

        // But historical decision for Version 1 remains intact
        assert(decisionRegistry.hasDecision(WORKSPACE_A, EXPENSE_1, 1));
        assert(
            decisionRegistry.getDecision(WORKSPACE_A, EXPENSE_1, 1)
                == IClarioDecisionRegistryV1.Decision.Approve
        );
        assert(decisionRegistry.getReviewer(WORKSPACE_A, EXPENSE_1, 1) == approver);

        // Cannot record another decision for Version 1
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.VersionNotCurrent.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Approver can now approve Version 2
        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            2,
            COMMITMENT_V2,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );
        assert(decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 2));
    }

    // ------------------------------------------------------------------------
    // Relayed EIP-712 Signatures (recordDecisionBySig)
    // ------------------------------------------------------------------------

    function _buildDigest(
        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth,
        address verifyingContract
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                decisionRegistry.EIP712_DOMAIN_TYPEHASH(),
                keccak256(bytes("ClarioApproval")),
                keccak256(bytes("1")),
                block.chainid,
                verifyingContract
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                decisionRegistry.CLARIO_APPROVAL_TYPEHASH(),
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

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function testRecordDecisionBySigSuccess() public {
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 1 hours;

        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 1,
                nonce: nonce,
                expiration: expiration
            });

        bytes32 digest = _buildDigest(auth, address(decisionRegistry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_PK, digest);

        // Stranger relays the signature
        vm.prank(stranger);
        decisionRegistry.recordDecisionBySig(auth, v, r, s);

        assert(decisionRegistry.hasDecision(WORKSPACE_A, EXPENSE_1, 1));
        assert(decisionRegistry.getReviewer(WORKSPACE_A, EXPENSE_1, 1) == approver);
        assert(decisionRegistry.isApprovalValid(WORKSPACE_A, EXPENSE_1, 1));
        assert(decisionRegistry.nonces(approver) == nonce + 1);
    }

    function testRecordDecisionBySigReplayReverts() public {
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 1 hours;

        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 1,
                nonce: nonce,
                expiration: expiration
            });

        bytes32 digest = _buildDigest(auth, address(decisionRegistry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_PK, digest);

        // First relay succeeds
        decisionRegistry.recordDecisionBySig(auth, v, r, s);

        // Second relay with same nonce must revert
        vm.expectRevert(IClarioDecisionRegistryV1.InvalidNonce.selector);
        decisionRegistry.recordDecisionBySig(auth, v, r, s);
    }

    function testRecordDecisionBySigExpiredReverts() public {
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 100;

        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 1,
                nonce: nonce,
                expiration: expiration
            });

        bytes32 digest = _buildDigest(auth, address(decisionRegistry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_PK, digest);

        // Advance time past expiration
        vm.warp(expiration + 1);

        vm.expectRevert(IClarioDecisionRegistryV1.SignatureExpired.selector);
        decisionRegistry.recordDecisionBySig(auth, v, r, s);
    }

    function testRecordDecisionBySigPolicyVersionMismatchReverts() public {
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 1 hours;

        // Current workspace policy is 1, message specifies 2
        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 2,
                nonce: nonce,
                expiration: expiration
            });

        vm.expectRevert(IClarioDecisionRegistryV1.PolicyVersionMismatch.selector);
        decisionRegistry.recordDecisionBySig(auth, 27, bytes32(0), bytes32(0));
    }

    function testRecordDecisionBySigWrongContractReverts() public {
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 1 hours;

        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 1,
                nonce: nonce,
                expiration: expiration
            });

        // Sign with a different contract address in domain
        bytes32 digest = _buildDigest(auth, address(0xDEAD));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_PK, digest);

        // Recovery produces a different signer address without approver role
        vm.expectRevert(IClarioDecisionRegistryV1.Unauthorized.selector);
        decisionRegistry.recordDecisionBySig(auth, v, r, s);
    }

    // ------------------------------------------------------------------------
    // Workspace Pause Behavior
    // ------------------------------------------------------------------------

    function testPauseWorkspaceBlocksDecisions() public {
        // Owner pauses workspace in expenseRegistry
        vm.prank(owner);
        expenseRegistry.pauseWorkspace(WORKSPACE_A);

        // Direct decision reverts
        vm.prank(approver);
        vm.expectRevert(IClarioDecisionRegistryV1.WorkspacePausedError.selector);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            EXPENSE_1,
            1,
            COMMITMENT_V1,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        // Relayed decision reverts
        uint256 nonce = decisionRegistry.nonces(approver);
        uint256 expiration = block.timestamp + 1 hours;
        IClarioDecisionRegistryV1.ApprovalAuthorization memory auth =
            IClarioDecisionRegistryV1.ApprovalAuthorization({
                workspaceId: WORKSPACE_A,
                expenseId: EXPENSE_1,
                version: 1,
                commitment: COMMITMENT_V1,
                decision: IClarioDecisionRegistryV1.Decision.Approve,
                reasonCommitment: bytes32(0),
                policyVersion: 1,
                nonce: nonce,
                expiration: expiration
            });
        bytes32 digest = _buildDigest(auth, address(decisionRegistry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(APPROVER_PK, digest);

        vm.expectRevert(IClarioDecisionRegistryV1.WorkspacePausedError.selector);
        decisionRegistry.recordDecisionBySig(auth, v, r, s);
    }

    function testGetDecisionRecordRevertsWhenNotFound() public {
        vm.expectRevert(IClarioDecisionRegistryV1.DecisionNotFound.selector);
        decisionRegistry.getDecisionRecord(WORKSPACE_A, EXPENSE_1, 1);
    }

    // ------------------------------------------------------------------------
    // Fuzz Testing
    // ------------------------------------------------------------------------

    function testFuzzDirectApprove(bytes32 expenseId, bytes32 commitVal) public {
        if (expenseId == bytes32(0) || commitVal == bytes32(0)) return;
        if (expenseId == EXPENSE_1) return;

        vm.prank(submitter);
        expenseRegistry.submitVersion(WORKSPACE_A, expenseId, 1, commitVal, bytes32(0));

        vm.prank(approver);
        decisionRegistry.recordDecision(
            WORKSPACE_A,
            expenseId,
            1,
            commitVal,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        assert(decisionRegistry.isApprovalValid(WORKSPACE_A, expenseId, 1));
        assert(decisionRegistry.getReviewer(WORKSPACE_A, expenseId, 1) == approver);
    }
}
