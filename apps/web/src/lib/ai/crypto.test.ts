import { describe, expect, it } from "vitest";
import { decryptAiPayload, encryptAiPayload } from "./crypto";

const kek = Buffer.alloc(32, 7);
const ids = {
  workspaceId: "ws-1",
  expenseId: "expense-1",
  analysisId: "analysis-1",
  version: 1,
};

describe("AI analysis encryption", () => {
  it("round-trips an analysis using authenticated context", () => {
    const encrypted = encryptAiPayload(
      { merchant: "Private Merchant" },
      kek,
      ids,
    );
    expect(encrypted).not.toContain("Private Merchant");
    expect(
      decryptAiPayload(encrypted, kek, {
        workspaceId: ids.workspaceId,
        expenseId: ids.expenseId,
        analysisId: ids.analysisId,
      }),
    ).toEqual({ merchant: "Private Merchant" });
  });

  it("fails closed when an analysis is moved to another expense", () => {
    const encrypted = encryptAiPayload({ total: "20.00" }, kek, ids);
    expect(() =>
      decryptAiPayload(encrypted, kek, {
        workspaceId: ids.workspaceId,
        expenseId: "expense-2",
        analysisId: ids.analysisId,
      }),
    ).toThrow(/authentication check failed/);
  });
});
