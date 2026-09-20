// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IClarioRegistry } from "../src/protocol/v1/interfaces/IClarioRegistry.sol";
import {
    IClarioDecisionRegistryV1
} from "../src/protocol/v1/interfaces/IClarioDecisionRegistryV1.sol";
import { ClarioWorkspaceRegistryV1 } from "../src/protocol/v1/ClarioWorkspaceRegistryV1.sol";
import { ClarioExpenseRegistryV1 } from "../src/protocol/v1/ClarioExpenseRegistryV1.sol";
import { ClarioDecisionRegistryV1 } from "../src/protocol/v1/ClarioDecisionRegistryV1.sol";
import { ClarioSettlementRegistryV1 } from "../src/protocol/v1/ClarioSettlementRegistryV1.sol";
import { ClarioRegistry } from "../src/protocol/v1/ClarioRegistry.sol";
import { MockUSDC } from "./MockUSDC.sol";

interface Vm {
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
}

contract ClarioRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ClarioWorkspaceRegistryV1 private workspaceRegistry;
    ClarioExpenseRegistryV1 private expenseRegistry;
    ClarioDecisionRegistryV1 private decisionRegistry;
    ClarioSettlementRegistryV1 private settlementRegistry;
    ClarioRegistry private registry;
    MockUSDC private mockUsdc;

    bytes32 private constant WORKSPACE_ID = keccak256("test-workspace");
    bytes32 private constant POLICY_COMMITMENT = keccak256("policy-v1");
    bytes32 private constant EXPENSE_ID = keccak256("expense-1");
    bytes32 private constant COMMITMENT = keccak256("commitment-v1");

    bytes32 private constant APPROVER_ROLE =
        0x408a36151f841709116a4e8aca4e0202874f7f54687dcb863b1ea4672dc9d8cf;
    bytes32 private constant TREASURY_ROLE =
        0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9;

    address private constant OWNER = address(0x1111);
    address private constant APPROVER = address(0x2222);
    address private constant TREASURY = address(0x3333);
    address private constant SUBMITTER = address(0x4444);
    address private constant RECIPIENT = address(0x5555);

    function setUp() public {
        workspaceRegistry = new ClarioWorkspaceRegistryV1();
        expenseRegistry = new ClarioExpenseRegistryV1(address(workspaceRegistry));
        decisionRegistry =
            new ClarioDecisionRegistryV1(address(workspaceRegistry), address(expenseRegistry));
        settlementRegistry = new ClarioSettlementRegistryV1(
            address(workspaceRegistry), address(expenseRegistry), address(decisionRegistry)
        );

        registry = new ClarioRegistry(
            address(workspaceRegistry),
            address(expenseRegistry),
            address(decisionRegistry),
            address(settlementRegistry)
        );

        mockUsdc = new MockUSDC();
    }

    function testInitialization() public view {
        assert(registry.workspaceRegistry() == address(workspaceRegistry));
        assert(registry.expenseRegistry() == address(expenseRegistry));
        assert(registry.decisionRegistry() == address(decisionRegistry));
        assert(registry.settlementRegistry() == address(settlementRegistry));
    }

    function testCannotInitializeWithZeroAddress() public {
        vm.expectRevert(IClarioRegistry.InvalidRegistryAddress.selector);
        new ClarioRegistry(
            address(0),
            address(expenseRegistry),
            address(decisionRegistry),
            address(settlementRegistry)
        );

        vm.expectRevert(IClarioRegistry.InvalidRegistryAddress.selector);
        new ClarioRegistry(
            address(workspaceRegistry),
            address(0),
            address(decisionRegistry),
            address(settlementRegistry)
        );

        vm.expectRevert(IClarioRegistry.InvalidRegistryAddress.selector);
        new ClarioRegistry(
            address(workspaceRegistry),
            address(expenseRegistry),
            address(0),
            address(settlementRegistry)
        );

        vm.expectRevert(IClarioRegistry.InvalidRegistryAddress.selector);
        new ClarioRegistry(
            address(workspaceRegistry),
            address(expenseRegistry),
            address(decisionRegistry),
            address(0)
        );
    }

    function testWorkspaceQueriesForwardCorrectly() public {
        assert(!registry.isWorkspace(WORKSPACE_ID));

        vm.prank(OWNER);
        workspaceRegistry.createWorkspace(WORKSPACE_ID, POLICY_COMMITMENT);

        assert(registry.isWorkspace(WORKSPACE_ID));
        assert(registry.hasRole(WORKSPACE_ID, OWNER, workspaceRegistry.OWNER_ROLE()));
        assert(!registry.hasRole(WORKSPACE_ID, APPROVER, APPROVER_ROLE));

        vm.prank(OWNER);
        workspaceRegistry.grantRole(WORKSPACE_ID, APPROVER, APPROVER_ROLE, bytes32(0));

        assert(registry.hasRole(WORKSPACE_ID, APPROVER, APPROVER_ROLE));
    }

    function testExpenseAndDecisionQueriesForwardCorrectly() public {
        vm.prank(OWNER);
        workspaceRegistry.createWorkspace(WORKSPACE_ID, POLICY_COMMITMENT);
        vm.prank(OWNER);
        workspaceRegistry.grantRole(WORKSPACE_ID, APPROVER, APPROVER_ROLE, bytes32(0));

        assert(registry.getCurrentVersion(WORKSPACE_ID, EXPENSE_ID) == 0);
        assert(registry.getCommitment(WORKSPACE_ID, EXPENSE_ID, 1) == bytes32(0));
        assert(!registry.isApprovalValid(WORKSPACE_ID, EXPENSE_ID, 1));
        assert(!registry.isSettled(WORKSPACE_ID, EXPENSE_ID, 1));

        // Submit expense version 1
        vm.prank(SUBMITTER);
        expenseRegistry.submitVersion(WORKSPACE_ID, EXPENSE_ID, 1, COMMITMENT, bytes32(0));

        assert(registry.getCurrentVersion(WORKSPACE_ID, EXPENSE_ID) == 1);
        assert(registry.getCommitment(WORKSPACE_ID, EXPENSE_ID, 1) == COMMITMENT);
        assert(!registry.isApprovalValid(WORKSPACE_ID, EXPENSE_ID, 1));

        // Record Approve decision
        vm.prank(APPROVER);
        decisionRegistry.recordDecision(
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            COMMITMENT,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        assert(registry.isApprovalValid(WORKSPACE_ID, EXPENSE_ID, 1));
        assert(!registry.isSettled(WORKSPACE_ID, EXPENSE_ID, 1));
    }

    function testSettlementQueriesForwardCorrectly() public {
        vm.prank(OWNER);
        workspaceRegistry.createWorkspace(WORKSPACE_ID, POLICY_COMMITMENT);
        vm.prank(OWNER);
        workspaceRegistry.grantRole(WORKSPACE_ID, APPROVER, APPROVER_ROLE, bytes32(0));
        vm.prank(OWNER);
        workspaceRegistry.grantRole(WORKSPACE_ID, TREASURY, TREASURY_ROLE, bytes32(0));

        vm.prank(SUBMITTER);
        expenseRegistry.submitVersion(WORKSPACE_ID, EXPENSE_ID, 1, COMMITMENT, bytes32(0));

        vm.prank(APPROVER);
        decisionRegistry.recordDecision(
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            COMMITMENT,
            IClarioDecisionRegistryV1.Decision.Approve,
            bytes32(0)
        );

        mockUsdc.mint(TREASURY, 1_000_000);
        vm.prank(TREASURY);
        mockUsdc.approve(address(settlementRegistry), 1_000_000);

        vm.prank(TREASURY);
        settlementRegistry.reimburse(
            WORKSPACE_ID,
            EXPENSE_ID,
            1,
            COMMITMENT,
            address(mockUsdc),
            RECIPIENT,
            1_000_000,
            bytes32(0)
        );

        assert(registry.isSettled(WORKSPACE_ID, EXPENSE_ID, 1));
        assert(mockUsdc.balanceOf(RECIPIENT) == 1_000_000);
    }
}
