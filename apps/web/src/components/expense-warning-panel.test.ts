import { describe, expect, it } from "vitest";
import { availableWarningDispositions } from "./expense-warning-panel";

describe("ExpenseWarningPanel actions", () => {
  it("never offers false-positive dismissal for a deterministic block", () => {
    expect(availableWarningDispositions({ severity: "blocking" })).toEqual([
      "confirmed_issue",
      "acknowledged",
    ]);
  });

  it("offers recorded false-positive recovery for review warnings", () => {
    expect(availableWarningDispositions({ severity: "review" })).toContain(
      "dismissed_false_positive",
    );
  });
});
