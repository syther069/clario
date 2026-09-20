import { describe, expect, it } from "vitest";

import {
  CLARIO_APPROVAL_PRIMARY_TYPE,
  CLARIO_EXPENSE_V1_DOMAIN,
  CLARIO_SCHEMA_VERSION_V1,
  EXPENSE_LIFECYCLE_STATES,
  OnchainDecision,
  PROTOCOL_ERROR_CODES,
  ProtocolError,
  TRANSACTION_LIFECYCLE_STATES,
  WORKSPACE_ROLES,
  parseCommitmentHash,
  parseExpenseId,
  parseWorkspaceId,
  protocolInitializationState,
  validateClarioApprovalTypedData,
} from "./index.js";

describe("protocol package initialization and exports", () => {
  it("initializes canonical schema version 1 under PRO-001", () => {
    expect(protocolInitializationState).toBe("initialized");
    expect(CLARIO_SCHEMA_VERSION_V1).toBe(1);
    expect(CLARIO_EXPENSE_V1_DOMAIN).toBe(
      "0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8",
    );
  });

  it("exports public protocol types, lifecycles, approval typed data, and error vocabulary", () => {
    expect(WORKSPACE_ROLES).toBeDefined();
    expect(EXPENSE_LIFECYCLE_STATES).toBeDefined();
    expect(TRANSACTION_LIFECYCLE_STATES).toBeDefined();
    expect(OnchainDecision.Approve).toBe(1);
    expect(CLARIO_APPROVAL_PRIMARY_TYPE).toBe("ClarioApproval");
    expect(typeof validateClarioApprovalTypedData).toBe("function");
    expect(PROTOCOL_ERROR_CODES).toBeDefined();
    expect(typeof ProtocolError).toBe("function");
    expect(typeof parseWorkspaceId).toBe("function");
    expect(typeof parseExpenseId).toBe("function");
    expect(typeof parseCommitmentHash).toBe("function");
  });
});
