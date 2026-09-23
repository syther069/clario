export const AI_EXTRACTION_SCHEMA_VERSION = "clario.receipt-extraction.v1";
export const AI_EXTRACTION_PROMPT_VERSION = "receipt-extraction-2026-09-22.v1";

export const AI_FIELD_NAMES = [
  "merchant",
  "documentDate",
  "invoiceNumber",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
  "project",
] as const;

export type AiFieldName = (typeof AI_FIELD_NAMES)[number];
export type AiDisposition = "pending" | "accepted" | "modified" | "rejected";

export interface AiProviderDocument {
  readonly source: number;
  readonly mimeType: string;
  readonly bytes: Buffer;
}

export interface AiExtractionProviderRequest {
  readonly schemaVersion: typeof AI_EXTRACTION_SCHEMA_VERSION;
  readonly promptVersion: typeof AI_EXTRACTION_PROMPT_VERSION;
  readonly systemInstruction: string;
  readonly documents: readonly AiProviderDocument[];
}

export interface RawAiFieldSuggestion {
  readonly value: string | null;
  readonly confidence: number;
  readonly source: number;
  readonly uncertainty: string | null;
}

export interface RawAiExtractionOutput {
  readonly schemaVersion: string;
  readonly fields: Record<string, unknown>;
  readonly overallConfidence: number;
  readonly warnings: readonly unknown[];
}

export interface AiFieldSuggestion {
  readonly value: string | null;
  readonly confidence: number;
  readonly sourceEvidenceId: string;
  readonly uncertainty: string | null;
}

export interface AiExtractionResult {
  readonly schemaVersion: typeof AI_EXTRACTION_SCHEMA_VERSION;
  readonly fields: Record<AiFieldName, AiFieldSuggestion>;
  readonly overallConfidence: number;
  readonly warnings: readonly string[];
}

export interface AiExtractionProvider {
  readonly provider: string;
  readonly modelId: string;
  extract(
    request: AiExtractionProviderRequest,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export interface AiAnalysisRecord extends AiExtractionResult {
  readonly analysisId: string;
  readonly provider: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly disposition: AiDisposition;
  readonly createdAt: string;
}
