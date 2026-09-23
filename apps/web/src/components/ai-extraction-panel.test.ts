import { describe, expect, it } from "vitest";
import {
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_FIELD_NAMES,
  type AiAnalysisRecord,
} from "@/lib/ai/types";
import { buildAppliedAiFields, confidenceLabel } from "./ai-extraction-panel";

function analysis(): AiAnalysisRecord {
  return {
    analysisId: "analysis-1",
    provider: "fixture",
    modelId: "fixture-v1",
    promptVersion: "prompt-v1",
    disposition: "pending",
    createdAt: "2026-09-22T00:00:00.000Z",
    schemaVersion: AI_EXTRACTION_SCHEMA_VERSION,
    overallConfidence: 0.7,
    warnings: [],
    fields: Object.fromEntries(
      AI_FIELD_NAMES.map((name) => [
        name,
        {
          value:
            name === "total" ? "12.00" : name === "merchant" ? "Cafe" : null,
          confidence: name === "merchant" ? 0.4 : 0.9,
          sourceEvidenceId: "evidence-1",
          uncertainty: null,
        },
      ]),
    ) as AiAnalysisRecord["fields"],
  };
}

describe("AI extraction confirmation helpers", () => {
  it("uses plain confidence labels", () => {
    expect(confidenceLabel(0.2)).toBe("Low");
    expect(confidenceLabel(0.7)).toBe("Moderate");
    expect(confidenceLabel(0.9)).toBe("High");
  });

  it("applies only explicitly selected fields and records edits as modified", () => {
    const decision = buildAppliedAiFields(
      analysis(),
      { merchant: "Corrected Cafe", total: "12.00" },
      ["merchant"],
    );
    expect(decision.applied).toEqual({ merchant: "Corrected Cafe" });
    expect(decision.applied.claimAmount).toBeUndefined();
    expect(decision.disposition).toBe("modified");
    expect(decision.corrections).toEqual({ merchant: "Corrected Cafe" });
  });
});
