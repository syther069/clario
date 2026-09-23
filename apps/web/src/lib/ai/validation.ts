import {
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_FIELD_NAMES,
  type AiExtractionResult,
  type AiFieldName,
  type AiFieldSuggestion,
} from "./types";

const MAX_VALUE_LENGTH = 256;
const MAX_UNCERTAINTY_LENGTH = 500;
const MAX_WARNING_LENGTH = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

export class AiOutputValidationError extends Error {
  readonly code = "AI_MALFORMED_OUTPUT";
  constructor(message: string) {
    super(message);
    this.name = "AiOutputValidationError";
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiOutputValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    throw new AiOutputValidationError(
      `${label} must contain exactly: ${expected.join(", ")}.`,
    );
  }
}

function confidence(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new AiOutputValidationError(`${label} must be a number from 0 to 1.`);
  }
  return value;
}

function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > max ||
    value.includes("\u0000")
  ) {
    throw new AiOutputValidationError(
      `${label} must be null or valid text up to ${max} characters.`,
    );
  }
  return value.trim() || null;
}

function validateValue(name: AiFieldName, value: string | null): void {
  if (value === null) return;
  if (name === "documentDate" && !ISO_DATE.test(value)) {
    throw new AiOutputValidationError("documentDate must use YYYY-MM-DD.");
  }
  if (name === "currency" && !ISO_CURRENCY.test(value)) {
    throw new AiOutputValidationError(
      "currency must be a three-letter uppercase code.",
    );
  }
  if (["subtotal", "tax", "total"].includes(name) && !DECIMAL.test(value)) {
    throw new AiOutputValidationError(
      `${name} must be an unsigned decimal string.`,
    );
  }
}

export function validateAiExtractionOutput(
  input: unknown,
  evidenceIds: readonly string[],
): AiExtractionResult {
  const root = object(input, "AI output");
  exactKeys(
    root,
    ["schemaVersion", "fields", "overallConfidence", "warnings"],
    "AI output",
  );
  if (root.schemaVersion !== AI_EXTRACTION_SCHEMA_VERSION) {
    throw new AiOutputValidationError(
      "Unsupported AI extraction schema version.",
    );
  }

  const rawFields = object(root.fields, "fields");
  exactKeys(rawFields, AI_FIELD_NAMES, "fields");
  const fields = {} as Record<AiFieldName, AiFieldSuggestion>;
  for (const name of AI_FIELD_NAMES) {
    const raw = object(rawFields[name], `fields.${name}`);
    exactKeys(
      raw,
      ["value", "confidence", "source", "uncertainty"],
      `fields.${name}`,
    );
    const value = optionalText(
      raw.value,
      `fields.${name}.value`,
      MAX_VALUE_LENGTH,
    );
    validateValue(name, value);
    if (
      !Number.isSafeInteger(raw.source) ||
      (raw.source as number) < 0 ||
      (raw.source as number) >= evidenceIds.length
    ) {
      throw new AiOutputValidationError(
        `fields.${name}.source does not identify an input document.`,
      );
    }
    fields[name] = {
      value,
      confidence: confidence(raw.confidence, `fields.${name}.confidence`),
      sourceEvidenceId: evidenceIds[raw.source as number]!,
      uncertainty: optionalText(
        raw.uncertainty,
        `fields.${name}.uncertainty`,
        MAX_UNCERTAINTY_LENGTH,
      ),
    };
  }

  if (!Array.isArray(root.warnings) || root.warnings.length > 20) {
    throw new AiOutputValidationError(
      "warnings must be an array with at most 20 entries.",
    );
  }
  const warnings = root.warnings.map((warning, index) => {
    if (
      typeof warning !== "string" ||
      !warning.trim() ||
      warning.length > MAX_WARNING_LENGTH
    ) {
      throw new AiOutputValidationError(
        `warnings[${index}] must be non-empty text.`,
      );
    }
    return warning.trim();
  });

  return {
    schemaVersion: AI_EXTRACTION_SCHEMA_VERSION,
    fields,
    overallConfidence: confidence(root.overallConfidence, "overallConfidence"),
    warnings,
  };
}
