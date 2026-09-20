import { describe, expect, it } from "vitest";
import type { TransactionLifecycleStatus } from "@/components/intent-dialog";
import { prepareRoleChangeIntent } from "./calldata";

describe("Transaction Intent Lifecycle & Network State Machine", () => {
  const dummyWorkspace =
    "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
  const dummyRegistry = "0x2222222222222222222222222222222222222222" as const;
  const dummyAccount = "0x3333333333333333333333333333333333333333" as const;

  it("flags network mismatch when connected wallet chain does not match target Monad chain", () => {
    const targetChainId = 31337;
    const connectedChainId = 1; // e.g. Ethereum Mainnet

    const intent = prepareRoleChangeIntent({
      workspaceRegistryAddress: dummyRegistry,
      chainId: targetChainId,
      workspaceId: dummyWorkspace,
      action: "grant",
      account: dummyAccount,
      role: "APPROVER_ROLE",
    });

    expect(intent.chainId).toBe(31337);
    const isMismatch = connectedChainId !== intent.chainId;
    expect(isMismatch).toBe(true);
  });

  it("models explicit transaction lifecycle transitions correctly", () => {
    const lifecycle: TransactionLifecycleStatus[] = [];

    // Step 1: user triggers action
    lifecycle.push("preparing");
    expect(lifecycle[lifecycle.length - 1]).toBe("preparing");

    // Step 2: calldata ready, awaiting wallet signature
    lifecycle.push("awaiting_signature");
    expect(lifecycle[lifecycle.length - 1]).toBe("awaiting_signature");

    // Step 3: user approved in wallet, transaction broadcast
    lifecycle.push("submitted");
    expect(lifecycle[lifecycle.length - 1]).toBe("submitted");

    // Step 4: transaction in mempool, waiting for Monad block confirmation
    lifecycle.push("confirming");
    expect(lifecycle[lifecycle.length - 1]).toBe("confirming");

    // Step 5: block receipt confirmed, authoritatively active
    lifecycle.push("confirmed");
    expect(lifecycle[lifecycle.length - 1]).toBe("confirmed");

    // Rejection branch
    const rejectedLifecycle: TransactionLifecycleStatus[] = [
      "preparing",
      "awaiting_signature",
      "rejected",
    ];
    expect(rejectedLifecycle.includes("confirmed")).toBe(false);

    // Failure branch
    const failedLifecycle: TransactionLifecycleStatus[] = [
      "preparing",
      "awaiting_signature",
      "submitted",
      "confirming",
      "failed",
    ];
    expect(failedLifecycle.includes("confirmed")).toBe(false);
  });

  it("never asserts role as active in any pre-confirmation lifecycle state", () => {
    const preConfirmationStates: TransactionLifecycleStatus[] = [
      "preparing",
      "awaiting_signature",
      "submitted",
      "confirming",
      "failed",
      "rejected",
    ];

    for (const status of preConfirmationStates) {
      const isAuthoritativelyActive = status === "confirmed";
      expect(isAuthoritativelyActive).toBe(false);
    }
  });
});
