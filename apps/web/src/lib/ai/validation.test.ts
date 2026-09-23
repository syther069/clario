import { describe, expect, it } from "vitest";
import { AI_EXTRACTION_SCHEMA_VERSION, AI_FIELD_NAMES } from "./types";
import {
  AiOutputValidationError,
  validateAiExtractionOutput,
} from "./validation";

function validOutput() {
  return {
    schemaVersion: AI_EXTRACTION_SCHEMA_VERSION,
    fields: Object.fromEntries(
      AI_FIELD_NAMES.map((name) => [
        name,
        {
          value:
            name === "documentDate"
              ? "2026-09-22"
              : name === "currency"
                ? "USD"
                : ["subtotal", "tax", "total"].includes(name)
                  ? "10.00"
                  : "Example",
          confidence: 0.8,
          source: 0,
          uncertainty: null,
        },
      ]),
    ),
    overallConfidence: 0.8,
    warnings: [],
  };
}

describe("validateAiExtractionOutput", () => {
  it("maps provider source indexes to authorized evidence identifiers", () => {
    const result = validateAiExtractionOutput(validOutput(), ["evidence-1"]);
    expect(result.fields.merchant.sourceEvidenceId).toBe("evidence-1");
    expect(result.schemaVersion).toBe(AI_EXTRACTION_SCHEMA_VERSION);
  });

  it.each([
    [
      "unknown root key",
      (value: ReturnType<typeof validOutput>) =>
        Object.assign(value, { toolCall: "pay" }),
    ],
    [
      "unknown field",
      (value: ReturnType<typeof validOutput>) =>
        Object.assign(value.fields, { approve: { value: "yes" } }),
    ],
    [
      "tool-shaped field data",
      (value: ReturnType<typeof validOutput>) =>
        Object.assign(value.fields.merchant!, { action: "transfer" }),
    ],
    [
      "bad confidence",
      (value: ReturnType<typeof validOutput>) =>
        (value.fields.merchant!.confidence = 1.1),
    ],
    [
      "bad source",
      (value: ReturnType<typeof validOutput>) =>
        (value.fields.merchant!.source = 99),
    ],
    [
      "bad date",
      (value: ReturnType<typeof validOutput>) =>
        (value.fields.documentDate!.value = "tomorrow"),
    ],
    [
      "bad currency",
      (value: ReturnType<typeof validOutput>) =>
        (value.fields.currency!.value = "usd"),
    ],
    [
      "executable amount",
      (value: ReturnType<typeof validOutput>) =>
        (value.fields.total!.value = "10; DROP TABLE"),
    ],
  ])("fails closed for %s", (_name, mutate) => {
    const output = validOutput();
    mutate(output);
    expect(() => validateAiExtractionOutput(output, ["evidence-1"])).toThrow(
      AiOutputValidationError,
    );
  });

  it("does not accept partial output", () => {
    const output = validOutput();
    delete (output.fields as Record<string, unknown>).tax;
    expect(() => validateAiExtractionOutput(output, ["evidence-1"])).toThrow(
      /exactly/,
    );
  });
});
