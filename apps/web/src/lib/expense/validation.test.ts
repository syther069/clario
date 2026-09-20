import { describe, expect, it } from "vitest";
import { validateExpenseDraft } from "./validation";
import type { ExpenseDraftPayload } from "./types";

describe("Expense Draft Validation", () => {
  const validDraft: ExpenseDraftPayload = {
    title: "AWS Cloud Hosting - September 2026",
    businessPurpose: "Monthly production validator node infrastructure",
    category: "hosting",
    project: "infrastructure",
    merchant: "Amazon Web Services",
    expenseDate: "2026-09-01",
    claimAmount: "250.00",
    claimAsset: "0x0000000000000000000000000000000000001001",
    recipient: "0x1111111111111111111111111111111111111111",
    paymentSource: "manual",
    tags: ["infra", "hosting"],
    notes: "Approved quarterly recurring expense",
  };

  it("passes validation for complete valid draft", () => {
    const res = validateExpenseDraft(validDraft, true);
    expect(res.valid).toBe(true);
    expect(Object.keys(res.errors)).toHaveLength(0);
  });

  it("allows partial drafts when isSubmission is false", () => {
    const res = validateExpenseDraft(
      {
        title: "Initial Draft Title",
      },
      false,
    );
    expect(res.valid).toBe(true);
  });

  it("rejects missing required fields when isSubmission is true", () => {
    const res = validateExpenseDraft({}, true);
    expect(res.valid).toBe(false);
    expect(res.errors.title).toBeDefined();
    expect(res.errors.businessPurpose).toBeDefined();
    expect(res.errors.category).toBeDefined();
    expect(res.errors.project).toBeDefined();
    expect(res.errors.merchant).toBeDefined();
    expect(res.errors.expenseDate).toBeDefined();
    expect(res.errors.claimAmount).toBeDefined();
    expect(res.errors.claimAsset).toBeDefined();
    expect(res.errors.recipient).toBeDefined();
    expect(res.errors.paymentSource).toBeDefined();
  });

  it("validates title and business purpose lengths", () => {
    const longTitle = "A".repeat(201);
    const resTitle = validateExpenseDraft({ title: longTitle }, false);
    expect(resTitle.valid).toBe(false);
    expect(resTitle.errors.title).toMatch(/cannot exceed 200/);

    const longPurpose = "B".repeat(2001);
    const resPurpose = validateExpenseDraft(
      { businessPurpose: longPurpose },
      false,
    );
    expect(resPurpose.valid).toBe(false);
    expect(resPurpose.errors.businessPurpose).toMatch(/cannot exceed 2000/);
  });

  it("validates categories against allowed list", () => {
    const validCat = validateExpenseDraft({ category: "travel" }, false);
    expect(validCat.valid).toBe(true);

    const invalidCat = validateExpenseDraft(
      { category: "crypto-gambling" },
      false,
    );
    expect(invalidCat.valid).toBe(false);
    expect(invalidCat.errors.category).toMatch(/Invalid category/);
  });

  it("validates expenseDate format, calendar validity, and future dates", () => {
    expect(
      validateExpenseDraft({ expenseDate: "not-a-date" }, false).valid,
    ).toBe(false);
    expect(
      validateExpenseDraft({ expenseDate: "2026-02-31" }, false).valid,
    ).toBe(false); // Feb 31 invalid

    // Far future date
    expect(
      validateExpenseDraft({ expenseDate: "2099-01-01" }, false).valid,
    ).toBe(false);

    // Valid past/today date
    expect(
      validateExpenseDraft({ expenseDate: "2026-09-15" }, false).valid,
    ).toBe(true);
  });

  it("validates recipient and claimAsset EVM addresses", () => {
    expect(
      validateExpenseDraft(
        { recipient: "invalid" as unknown as `0x${string}` },
        false,
      ).valid,
    ).toBe(false);
    expect(
      validateExpenseDraft(
        { claimAsset: "0x123" as unknown as `0x${string}` },
        false,
      ).valid,
    ).toBe(false);
    expect(
      validateExpenseDraft(
        {
          recipient: "0x1111111111111111111111111111111111111111",
          claimAsset: "0x0000000000000000000000000000000000001001",
        },
        false,
      ).valid,
    ).toBe(true);
  });

  it("validates claim amount and decimal places", () => {
    expect(validateExpenseDraft({ claimAmount: "-10" }, false).valid).toBe(
      false,
    );
    expect(
      validateExpenseDraft(
        { claimAmount: "10.1234567", claimAsset: validDraft.claimAsset },
        false,
      ).valid,
    ).toBe(false);
    expect(validateExpenseDraft({ claimAmount: "0" }, true).valid).toBe(false); // Zero not allowed on submission
  });

  it("validates transaction_hash source requirement", () => {
    const missingTx = validateExpenseDraft(
      {
        paymentSource: "transaction_hash",
      },
      false,
    );
    expect(missingTx.valid).toBe(false);
    expect(missingTx.errors.sourceTransactionHash).toBeDefined();

    const validTx = validateExpenseDraft(
      {
        paymentSource: "transaction_hash",
        sourceTransactionHash:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      },
      false,
    );
    expect(validTx.valid).toBe(true);
  });

  it("validates tags array length and tag item lengths", () => {
    const tooManyTags = Array(11).fill("tag");
    expect(validateExpenseDraft({ tags: tooManyTags }, false).valid).toBe(
      false,
    );

    const longTag = ["A".repeat(31)];
    expect(validateExpenseDraft({ tags: longTag }, false).valid).toBe(false);

    const validTags = ["engineering", "monad", "infra"];
    expect(validateExpenseDraft({ tags: validTags }, false).valid).toBe(true);
  });
});
