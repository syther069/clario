import { describe, expect, it } from "vitest";
import {
  DECISION_LIFECYCLE_STATES,
  EXPENSE_LIFECYCLE_STATES,
  type ExpenseLifecycleState,
  OnchainDecision,
  ROLE_IDENTIFIERS,
  SETTLEMENT_LIFECYCLE_STATES,
  TRANSACTION_LIFECYCLE_STATES,
  type TransactionLifecycleState,
  VERIFICATION_RESULTS,
  WORKSPACE_ROLES,
  assertNever,
  parseDecisionLifecycleState,
  parseExpenseLifecycleState,
  parseOnchainDecision,
  parseSettlementLifecycleState,
  parseTransactionLifecycleState,
  parseVerificationResult,
  parseWorkspaceRole,
} from "./lifecycle.js";

describe("Lifecycle States and Enums", () => {
  describe("Expense Lifecycle States", () => {
    it("contains all 5 expected states without omission", () => {
      const expected = [
        "DRAFT",
        "PREPARED",
        "SUBMITTED",
        "CURRENT",
        "SUPERSEDED",
      ];
      expect(EXPENSE_LIFECYCLE_STATES).toEqual(expected);
    });

    it("parses valid states", () => {
      for (const state of EXPENSE_LIFECYCLE_STATES) {
        expect(parseExpenseLifecycleState(state)).toBe(state);
      }
    });

    it("rejects unknown serialized values (fail closed)", () => {
      const bad = ["draft", "UNKNOWN", "DELETED", "", null, undefined, 123];
      for (const val of bad) {
        expect(() => parseExpenseLifecycleState(val)).toThrow();
      }
    });

    it("supports exhaustive compile-time checking", () => {
      function checkExhaustive(state: ExpenseLifecycleState): string {
        switch (state) {
          case "DRAFT":
            return "draft";
          case "PREPARED":
            return "prepared";
          case "SUBMITTED":
            return "submitted";
          case "CURRENT":
            return "current";
          case "SUPERSEDED":
            return "superseded";
          default:
            return assertNever(state);
        }
      }

      for (const state of EXPENSE_LIFECYCLE_STATES) {
        expect(typeof checkExhaustive(state)).toBe("string");
      }
    });
  });

  describe("Decision Lifecycle States", () => {
    it("contains all 6 expected states", () => {
      const expected = [
        "NONE",
        "APPROVED",
        "REJECTED",
        "CHANGES_REQUESTED",
        "HISTORICAL_APPROVAL",
        "REAPPROVAL_REQUIRED",
      ];
      expect(DECISION_LIFECYCLE_STATES).toEqual(expected);
    });

    it("parses valid states and rejects unknown values", () => {
      for (const state of DECISION_LIFECYCLE_STATES) {
        expect(parseDecisionLifecycleState(state)).toBe(state);
      }
      expect(() => parseDecisionLifecycleState("UNKNOWN_STATE")).toThrow();
    });
  });

  describe("Settlement Lifecycle States", () => {
    it("contains all 6 expected states", () => {
      const expected = [
        "UNSETTLED",
        "PREPARING",
        "AWAITING_SIGNATURE",
        "SETTLEMENT_SUBMITTED",
        "SETTLED",
        "SETTLEMENT_FAILED",
      ];
      expect(SETTLEMENT_LIFECYCLE_STATES).toEqual(expected);
    });

    it("parses valid states and rejects unknown values", () => {
      for (const state of SETTLEMENT_LIFECYCLE_STATES) {
        expect(parseSettlementLifecycleState(state)).toBe(state);
      }
      expect(() => parseSettlementLifecycleState("PENDING")).toThrow();
    });
  });

  describe("Transaction Lifecycle States", () => {
    it("preserves distinct non-collapsed states including SUBMITTED, CONFIRMING, CONFIRMED, INDEXED, FAILED, REPLACED, REORGED", () => {
      const expected = [
        "PREPARING",
        "AWAITING_SIGNATURE",
        "CANCELLED",
        "SUBMITTED",
        "CONFIRMING",
        "CONFIRMED",
        "INDEXED",
        "FAILED",
        "REPLACED",
        "REORGED",
      ];
      expect(TRANSACTION_LIFECYCLE_STATES).toEqual(expected);
      expect(new Set(TRANSACTION_LIFECYCLE_STATES).size).toBe(10);
    });

    it("does not collapse submitted, confirming, confirmed, indexed, failed, replaced, or reorged", () => {
      const criticalStates: TransactionLifecycleState[] = [
        "SUBMITTED",
        "CONFIRMING",
        "CONFIRMED",
        "INDEXED",
        "FAILED",
        "REPLACED",
        "REORGED",
      ];
      for (let i = 0; i < criticalStates.length; i++) {
        for (let j = i + 1; j < criticalStates.length; j++) {
          expect(criticalStates[i]).not.toBe(criticalStates[j]);
        }
      }
    });

    it("parses valid transaction states and rejects invalid", () => {
      for (const state of TRANSACTION_LIFECYCLE_STATES) {
        expect(parseTransactionLifecycleState(state)).toBe(state);
      }
      expect(() =>
        parseTransactionLifecycleState("UNKNOWN_TX_STATE"),
      ).toThrow();
    });
  });

  describe("Verification Results", () => {
    it("distinguishes VERIFIED, VERIFIED_WITH_WARNINGS, FAILED, and UNVERIFIABLE", () => {
      const expected = [
        "VERIFIED",
        "VERIFIED_WITH_WARNINGS",
        "FAILED",
        "UNVERIFIABLE",
      ];
      expect(VERIFICATION_RESULTS).toEqual(expected);

      for (const res of VERIFICATION_RESULTS) {
        expect(parseVerificationResult(res)).toBe(res);
      }
      expect(() => parseVerificationResult("INVALID_RESULT")).toThrow();
    });
  });

  describe("Workspace Roles and Keccak Role Hashes", () => {
    it("contains the 5 contract roles and precomputed keccak hashes", () => {
      const expectedRoles = [
        "OWNER_ROLE",
        "ADMIN_ROLE",
        "APPROVER_ROLE",
        "TREASURY_ROLE",
        "AUDITOR_ROLE",
      ];
      expect(WORKSPACE_ROLES).toEqual(expectedRoles);

      for (const role of WORKSPACE_ROLES) {
        expect(parseWorkspaceRole(role)).toBe(role);
        expect(ROLE_IDENTIFIERS[role]).toMatch(/^0x[0-9a-f]{64}$/);
      }

      expect(() => parseWorkspaceRole("USER_ROLE")).toThrow();
    });
  });

  describe("OnchainDecision Enum", () => {
    it("maps numeric values to matching contract enum", () => {
      expect(OnchainDecision.None).toBe(0);
      expect(OnchainDecision.Approve).toBe(1);
      expect(OnchainDecision.Reject).toBe(2);
      expect(OnchainDecision.RequestChanges).toBe(3);

      expect(parseOnchainDecision(0)).toBe(OnchainDecision.None);
      expect(parseOnchainDecision(1)).toBe(OnchainDecision.Approve);
      expect(parseOnchainDecision(2)).toBe(OnchainDecision.Reject);
      expect(parseOnchainDecision(3)).toBe(OnchainDecision.RequestChanges);

      expect(parseOnchainDecision("Approve")).toBe(OnchainDecision.Approve);

      expect(() => parseOnchainDecision(4)).toThrow();
      expect(() => parseOnchainDecision(-1)).toThrow();
      expect(() => parseOnchainDecision("UnknownDecision")).toThrow();
    });
  });

  describe("assertNever helper", () => {
    it("throws error when called with an unhandled value", () => {
      expect(() => assertNever("unexpected" as never)).toThrow(
        "Unexpected unreachable value encountered in exhaustive match: unexpected",
      );
    });
  });
});
