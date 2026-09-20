// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    IClarioWorkspaceRegistryV1
} from "../src/protocol/v1/interfaces/IClarioWorkspaceRegistryV1.sol";
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

contract ClarioWorkspaceRegistryV1Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ClarioWorkspaceRegistryV1 internal registry;

    bytes32 internal constant OWNER_ROLE =
        0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e;
    bytes32 internal constant ADMIN_ROLE =
        0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775;
    bytes32 internal constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;
    bytes32 internal constant TREASURY_ROLE =
        0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9;
    bytes32 internal constant AUDITOR_ROLE =
        0x59a1c48e5837ad7a7f3dcedcbe129bf3249ec4fbf651fd4f5e2600ead39fe2f5;

    bytes32 internal constant WORKSPACE_A =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 internal constant WORKSPACE_B =
        0x2222222222222222222222222222222222222222222222222222222222222222;
    bytes32 internal constant POLICY_A1 =
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
    bytes32 internal constant POLICY_A2 =
        0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb;

    bytes32 internal constant SCOPE_DEPT1 =
        0x0000000000000000000000000000000000000000000000000000000000000001;
    bytes32 internal constant SCOPE_DEPT2 =
        0x0000000000000000000000000000000000000000000000000000000000000002;

    address internal owner = address(0x1001);
    address internal admin = address(0x1002);
    address internal approver = address(0x1003);
    address internal treasury = address(0x1004);
    address internal auditor = address(0x1005);
    address internal stranger = address(0x1009);

    function setUp() public {
        registry = new ClarioWorkspaceRegistryV1();
    }

    // ------------------------------------------------------------------------
    // Role Hash Consistency
    // ------------------------------------------------------------------------

    function testRoleConstantsMatchProtocolHashes() public view {
        assert(registry.OWNER_ROLE() == OWNER_ROLE);
        assert(registry.ADMIN_ROLE() == ADMIN_ROLE);
        assert(registry.APPROVER_ROLE() == APPROVER_ROLE);
        assert(registry.TREASURY_ROLE() == TREASURY_ROLE);
        assert(registry.AUDITOR_ROLE() == AUDITOR_ROLE);
    }

    // ------------------------------------------------------------------------
    // Workspace Creation Tests
    // ------------------------------------------------------------------------

    function testCreateWorkspaceSuccess() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        assert(registry.isWorkspace(WORKSPACE_A));
        assert(registry.getWorkspaceOwner(WORKSPACE_A) == owner);
        assert(registry.getPolicyVersion(WORKSPACE_A) == 1);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 1) == POLICY_A1);
        assert(registry.getLatestPolicyCommitment(WORKSPACE_A) == POLICY_A1);
        assert(registry.hasRole(WORKSPACE_A, owner, OWNER_ROLE));
        assert(registry.getWorkspaceCreatedAtBlock(WORKSPACE_A) == uint64(block.number));
    }

    function testCreateWorkspaceEmitsEvents() public {
        vm.expectEmit(true, true, false, true);
        emit IClarioWorkspaceRegistryV1.WorkspaceCreated(WORKSPACE_A, owner, POLICY_A1);

        vm.expectEmit(true, true, true, true);
        emit IClarioWorkspaceRegistryV1.RoleGranted(WORKSPACE_A, owner, OWNER_ROLE, bytes32(0));

        vm.expectEmit(true, false, false, true);
        emit IClarioWorkspaceRegistryV1.PolicyUpdated(WORKSPACE_A, 1, POLICY_A1);

        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);
    }

    function testCreateWorkspaceRejectsZeroWorkspaceId() public {
        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.InvalidWorkspaceId.selector);
        registry.createWorkspace(bytes32(0), POLICY_A1);
    }

    function testCreateWorkspaceRejectsZeroPolicyCommitment() public {
        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.InvalidPolicyCommitment.selector);
        registry.createWorkspace(WORKSPACE_A, bytes32(0));
    }

    function testCreateWorkspaceRejectsDuplicateId() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.WorkspaceAlreadyExists.selector);
        registry.createWorkspace(WORKSPACE_A, POLICY_A2);
    }

    // ------------------------------------------------------------------------
    // Role Grant and Permission Boundary Tests
    // ------------------------------------------------------------------------

    function testOwnerCanGrantAllRoles() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.startPrank(owner);
        registry.grantRole(WORKSPACE_A, admin, ADMIN_ROLE, bytes32(0));
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));
        registry.grantRole(WORKSPACE_A, treasury, TREASURY_ROLE, bytes32(0));
        registry.grantRole(WORKSPACE_A, auditor, AUDITOR_ROLE, bytes32(0));
        vm.stopPrank();

        assert(registry.hasRole(WORKSPACE_A, admin, ADMIN_ROLE));
        assert(registry.hasRole(WORKSPACE_A, approver, APPROVER_ROLE));
        assert(registry.hasRole(WORKSPACE_A, treasury, TREASURY_ROLE));
        assert(registry.hasRole(WORKSPACE_A, auditor, AUDITOR_ROLE));
    }

    function testAdminCanGrantOperationalRoles() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, admin, ADMIN_ROLE, bytes32(0));

        vm.startPrank(admin);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));
        registry.grantRole(WORKSPACE_A, treasury, TREASURY_ROLE, bytes32(0));
        registry.grantRole(WORKSPACE_A, auditor, AUDITOR_ROLE, bytes32(0));
        vm.stopPrank();

        assert(registry.hasRole(WORKSPACE_A, approver, APPROVER_ROLE));
        assert(registry.hasRole(WORKSPACE_A, treasury, TREASURY_ROLE));
        assert(registry.hasRole(WORKSPACE_A, auditor, AUDITOR_ROLE));
    }

    function testAdminCannotGrantOwnerOrAdminRole() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, admin, ADMIN_ROLE, bytes32(0));

        vm.startPrank(admin);
        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.grantRole(WORKSPACE_A, stranger, OWNER_ROLE, bytes32(0));

        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.grantRole(WORKSPACE_A, stranger, ADMIN_ROLE, bytes32(0));
        vm.stopPrank();
    }

    function testStrangerCannotGrantOrRevokeRoles() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.startPrank(stranger);
        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.grantRole(WORKSPACE_A, stranger, APPROVER_ROLE, bytes32(0));

        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.revokeRole(WORKSPACE_A, owner, OWNER_ROLE, bytes32(0));
        vm.stopPrank();
    }

    function testRejectsZeroAccount() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.InvalidAccount.selector);
        registry.grantRole(WORKSPACE_A, address(0), APPROVER_ROLE, bytes32(0));
    }

    function testRejectsInvalidRole() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        bytes32 badRole = keccak256("UNKNOWN_ROLE");
        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.InvalidRole.selector);
        registry.grantRole(WORKSPACE_A, approver, badRole, bytes32(0));
    }

    function testRejectsDuplicateActiveRoleGrant() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.startPrank(owner);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1);

        vm.expectRevert(IClarioWorkspaceRegistryV1.RoleAlreadyActive.selector);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1);
        vm.stopPrank();
    }

    function testRejectsRevokingInactiveRole() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.RoleNotActive.selector);
        registry.revokeRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));
    }

    function testCannotRevokeLastOwner() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.CannotRevokeLastOwner.selector);
        registry.revokeRole(WORKSPACE_A, owner, OWNER_ROLE, bytes32(0));
    }

    function testCanRevokeOwnerWhenMultipleOwnersExist() public {
        address secondOwner = address(0x1008);
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.startPrank(owner);
        registry.grantRole(WORKSPACE_A, secondOwner, OWNER_ROLE, bytes32(0));
        assert(registry.hasRole(WORKSPACE_A, secondOwner, OWNER_ROLE));

        // Revoke the second owner
        registry.revokeRole(WORKSPACE_A, secondOwner, OWNER_ROLE, bytes32(0));
        assert(!registry.hasRole(WORKSPACE_A, secondOwner, OWNER_ROLE));

        // Now revoking first owner must fail
        vm.expectRevert(IClarioWorkspaceRegistryV1.CannotRevokeLastOwner.selector);
        registry.revokeRole(WORKSPACE_A, owner, OWNER_ROLE, bytes32(0));
        vm.stopPrank();
    }

    // ------------------------------------------------------------------------
    // Scoped Roles and Hierarchical Fallback Tests
    // ------------------------------------------------------------------------

    function testScopedRoleAuthorityAndFallback() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        // Grant approver with SCOPE_DEPT1
        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1);

        // approver does NOT have global scope
        assert(!registry.hasRole(WORKSPACE_A, approver, APPROVER_ROLE));
        // approver DOES have scoped authority for SCOPE_DEPT1
        assert(registry.hasRoleScoped(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1));
        // approver does NOT have scoped authority for SCOPE_DEPT2
        assert(!registry.hasRoleScoped(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT2));
        // exact scope check
        assert(registry.isRoleActiveExact(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1));
        assert(!registry.isRoleActiveExact(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0)));

        // Now grant global scope to another approver (admin)
        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, admin, APPROVER_ROLE, bytes32(0));

        // Global grant satisfies both global query and any scoped query
        assert(registry.hasRole(WORKSPACE_A, admin, APPROVER_ROLE));
        assert(registry.hasRoleScoped(WORKSPACE_A, admin, APPROVER_ROLE, SCOPE_DEPT1));
        assert(registry.hasRoleScoped(WORKSPACE_A, admin, APPROVER_ROLE, SCOPE_DEPT2));
    }

    // ------------------------------------------------------------------------
    // Cross-Workspace Role Isolation Tests
    // ------------------------------------------------------------------------

    function testCrossWorkspaceRoleIsolation() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_B, POLICY_A1);

        // Grant role in WORKSPACE_A
        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));

        // Approver has authority in A, but zero authority in B
        assert(registry.hasRole(WORKSPACE_A, approver, APPROVER_ROLE));
        assert(!registry.hasRole(WORKSPACE_B, approver, APPROVER_ROLE));
        assert(!registry.hasRoleScoped(WORKSPACE_B, approver, APPROVER_ROLE, SCOPE_DEPT1));

        // Stranger attempting role actions in B fails
        vm.prank(approver);
        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.grantRole(WORKSPACE_B, stranger, TREASURY_ROLE, bytes32(0));
    }

    // ------------------------------------------------------------------------
    // Historical Authority Queries Tests
    // ------------------------------------------------------------------------

    function testHistoricalAuthorityAtBlock() public {
        vm.roll(100);
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.roll(150);
        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1);

        vm.roll(250);
        vm.prank(owner);
        registry.revokeRole(WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1);

        vm.roll(300);

        // Before grant
        assert(
            !registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 149
            )
        );
        // During active tenure (inclusive of grant block, strictly before revoke block)
        assert(
            registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 150
            )
        );
        assert(
            registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 200
            )
        );
        assert(
            registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 249
            )
        );
        // After revocation
        assert(
            !registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 250
            )
        );
        assert(
            !registry.wasRoleAuthorizedAtBlock(
                WORKSPACE_A, approver, APPROVER_ROLE, SCOPE_DEPT1, 300
            )
        );
    }

    function testHistoricalAuthorityAtPolicyVersion() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1); // version 1

        vm.prank(owner);
        registry.updatePolicy(WORKSPACE_A, POLICY_A2); // version 2

        // Grant approver at policy version 2
        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));

        // Update policy to version 3
        vm.prank(owner);
        registry.updatePolicy(WORKSPACE_A, keccak256("POLICY_V3")); // version 3

        // Revoke approver at policy version 3
        vm.prank(owner);
        registry.revokeRole(WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0));

        // Update policy to version 4
        vm.prank(owner);
        registry.updatePolicy(WORKSPACE_A, keccak256("POLICY_V4")); // version 4

        // Version 1: not yet granted
        assert(
            !registry.wasRoleAuthorizedAtPolicyVersion(
                WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0), 1
            )
        );
        // Version 2: granted and active
        assert(
            registry.wasRoleAuthorizedAtPolicyVersion(
                WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0), 2
            )
        );
        // Version 3: revoked at version 3
        assert(
            !registry.wasRoleAuthorizedAtPolicyVersion(
                WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0), 3
            )
        );
        // Version 4: after revocation
        assert(
            !registry.wasRoleAuthorizedAtPolicyVersion(
                WORKSPACE_A, approver, APPROVER_ROLE, bytes32(0), 4
            )
        );
    }

    // ------------------------------------------------------------------------
    // Policy Update and History Tests
    // ------------------------------------------------------------------------

    function testUpdatePolicySuccessAndHistory() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        bytes32 policyV2 = keccak256("POLICY_V2");
        bytes32 policyV3 = keccak256("POLICY_V3");

        vm.expectEmit(true, false, false, true);
        emit IClarioWorkspaceRegistryV1.PolicyUpdated(WORKSPACE_A, 2, policyV2);

        vm.prank(owner);
        uint32 v2 = registry.updatePolicy(WORKSPACE_A, policyV2);
        assert(v2 == 2);
        assert(registry.getPolicyVersion(WORKSPACE_A) == 2);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 1) == POLICY_A1);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 2) == policyV2);
        assert(registry.getLatestPolicyCommitment(WORKSPACE_A) == policyV2);

        vm.prank(owner);
        uint32 v3 = registry.updatePolicy(WORKSPACE_A, policyV3);
        assert(v3 == 3);
        assert(registry.getPolicyVersion(WORKSPACE_A) == 3);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 1) == POLICY_A1);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 2) == policyV2);
        assert(registry.getPolicyCommitment(WORKSPACE_A, 3) == policyV3);
        assert(registry.getLatestPolicyCommitment(WORKSPACE_A) == policyV3);
    }

    function testNonOwnerCannotUpdatePolicy() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        registry.grantRole(WORKSPACE_A, admin, ADMIN_ROLE, bytes32(0));

        vm.prank(admin);
        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.updatePolicy(WORKSPACE_A, POLICY_A2);

        vm.prank(stranger);
        vm.expectRevert(IClarioWorkspaceRegistryV1.Unauthorized.selector);
        registry.updatePolicy(WORKSPACE_A, POLICY_A2);
    }

    function testUpdatePolicyRejectsZeroCommitment() public {
        vm.prank(owner);
        registry.createWorkspace(WORKSPACE_A, POLICY_A1);

        vm.prank(owner);
        vm.expectRevert(IClarioWorkspaceRegistryV1.InvalidPolicyCommitment.selector);
        registry.updatePolicy(WORKSPACE_A, bytes32(0));
    }

    // ------------------------------------------------------------------------
    // Fuzz / Isolation Tests
    // ------------------------------------------------------------------------

    function testFuzzWorkspaceCreationAndIsolation(bytes32 wsIdA, bytes32 wsIdB, address user1)
        public
    {
        if (wsIdA == bytes32(0) || wsIdB == bytes32(0) || wsIdA == wsIdB) return;
        if (user1 == address(0) || user1 == owner) return;

        vm.prank(owner);
        registry.createWorkspace(wsIdA, POLICY_A1);

        assert(registry.isWorkspace(wsIdA));
        assert(!registry.isWorkspace(wsIdB));

        vm.prank(owner);
        registry.grantRole(wsIdA, user1, TREASURY_ROLE, bytes32(0));

        assert(registry.hasRole(wsIdA, user1, TREASURY_ROLE));
        assert(!registry.hasRole(wsIdB, user1, TREASURY_ROLE));
    }
}
