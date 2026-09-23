import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import {
  AuthorizationPolicy,
  type AuthContext,
  RecordNotFoundError,
} from "../auth/policy";
import { EvidenceService, getEvidenceKek } from "../evidence/service";
import { decryptAiPayload, encryptAiPayload } from "./crypto";
import {
  AiProviderError,
  getDefaultAiExtractionProvider,
  RECEIPT_EXTRACTION_SYSTEM_INSTRUCTION,
} from "./provider";
import {
  AI_EXTRACTION_PROMPT_VERSION,
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_FIELD_NAMES,
  type AiAnalysisRecord,
  type AiDisposition,
  type AiExtractionProvider,
  type AiExtractionResult,
} from "./types";
import {
  AiOutputValidationError,
  validateAiExtractionOutput,
} from "./validation";

const MAX_DOCUMENTS = 4;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

interface StoredAiPayload {
  result: AiExtractionResult;
  history: Array<{
    disposition: AiDisposition;
    actorUserId: string;
    at: string;
    corrections: Partial<
      Record<(typeof AI_FIELD_NAMES)[number], string | null>
    >;
  }>;
}

interface AiAnalysisRow {
  id: string;
  workspace_id: string;
  expense_id: string;
  provider: string;
  model_id: string;
  prompt_version: string;
  suggested_fields_ciphertext: string;
  confidence: string | number;
  warnings: unknown;
  disposition: AiDisposition;
  created_at: string | Date;
}

export class AiExtractionError extends Error {
  constructor(
    readonly code:
      | "AI_CONSENT_REQUIRED"
      | "AI_INVALID_EVIDENCE"
      | "AI_PROVIDER_DISABLED"
      | "AI_PROVIDER_UNAVAILABLE"
      | "AI_PROVIDER_QUOTA"
      | "AI_PROVIDER_TIMEOUT"
      | "AI_MALFORMED_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "AiExtractionError";
  }
}

export interface RunExtractionParams {
  workspaceId: string;
  expenseId: string;
  evidenceIds: readonly string[];
  consent: boolean;
  context: AuthContext;
}

export class AiExtractionService {
  private readonly policy: AuthorizationPolicy;

  constructor(
    private readonly db: DatabaseClient,
    private readonly provider: AiExtractionProvider = getDefaultAiExtractionProvider(),
    private readonly evidence = new EvidenceService(db),
    private readonly kek: Buffer = getEvidenceKek(),
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    policy?: AuthorizationPolicy,
  ) {
    this.policy = policy ?? new AuthorizationPolicy(db);
  }

  async runExtraction(
    params: RunExtractionParams,
  ): Promise<{ jobId: string; analysis: AiAnalysisRecord }> {
    if (params.consent !== true) {
      throw new AiExtractionError(
        "AI_CONSENT_REQUIRED",
        "Explicit consent is required before selected evidence can be sent to a configured AI provider.",
      );
    }
    const evidenceIds = [...new Set(params.evidenceIds)];
    if (evidenceIds.length < 1 || evidenceIds.length > MAX_DOCUMENTS) {
      throw new AiExtractionError(
        "AI_INVALID_EVIDENCE",
        `Select between 1 and ${MAX_DOCUMENTS} evidence files.`,
      );
    }

    await this.policy.authorizeExpense(
      params.workspaceId,
      params.expenseId,
      params.context,
      "edit",
    );
    const versionResult = await this.db.query<{
      current_version: number;
      status: string;
    }>(
      `SELECT e.current_version, ev.status
       FROM expenses e
       JOIN expense_versions ev ON ev.workspace_id = e.workspace_id
        AND ev.expense_id = e.expense_id AND ev.version = e.current_version
       WHERE e.workspace_id = $1 AND e.expense_id = $2;`,
      [params.workspaceId, params.expenseId],
    );
    const versionRow = versionResult.rows[0];
    if (!versionRow) throw new RecordNotFoundError("Expense draft not found.");
    if (versionRow.status !== "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: "AI suggestions can only be requested for a draft expense.",
      });
    }

    const jobId = randomUUID();
    await this.db.query(
      `INSERT INTO jobs (job_id, workspace_id, job_type, payload, status, attempts, max_attempts)
       VALUES ($1, $2, 'ai_receipt_extraction_v1', $3, 'pending', 0, $4);`,
      [
        jobId,
        params.workspaceId,
        JSON.stringify({
          expenseId: params.expenseId,
          evidenceIds,
          requestedBy: params.context.userId,
        }),
        MAX_ATTEMPTS,
      ],
    );

    try {
      const documents = [];
      let totalBytes = 0;
      for (let index = 0; index < evidenceIds.length; index += 1) {
        const downloaded = await this.evidence.downloadEvidence({
          workspaceId: params.workspaceId,
          expenseId: params.expenseId,
          evidenceId: evidenceIds[index]!,
          context: params.context,
        });
        if (!ALLOWED_MIME_TYPES.has(downloaded.mimeType)) {
          throw new AiExtractionError(
            "AI_INVALID_EVIDENCE",
            "AI extraction supports PDF, PNG, and JPEG evidence only.",
          );
        }
        totalBytes += downloaded.data.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          throw new AiExtractionError(
            "AI_INVALID_EVIDENCE",
            "Selected evidence exceeds the 20 MB extraction limit.",
          );
        }
        documents.push({
          source: index,
          mimeType: downloaded.mimeType,
          bytes: downloaded.data,
        });
      }

      await this.db.query(
        `UPDATE jobs SET status = 'running', attempts = 1, updated_at = NOW() WHERE job_id = $1;`,
        [jobId],
      );

      let raw: unknown;
      let attempt = 0;
      while (attempt < MAX_ATTEMPTS) {
        attempt += 1;
        if (attempt > 1) {
          await this.db.query(
            `UPDATE jobs SET attempts = $2, updated_at = NOW() WHERE job_id = $1;`,
            [jobId, attempt],
          );
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          raw = await Promise.race([
            this.provider.extract(
              {
                schemaVersion: AI_EXTRACTION_SCHEMA_VERSION,
                promptVersion: AI_EXTRACTION_PROMPT_VERSION,
                systemInstruction: RECEIPT_EXTRACTION_SYSTEM_INSTRUCTION,
                documents,
              },
              controller.signal,
            ),
            new Promise<never>((_, reject) => {
              controller.signal.addEventListener("abort", () =>
                reject(
                  new AiProviderError(
                    "AI_PROVIDER_TIMEOUT",
                    "AI extraction timed out.",
                    true,
                  ),
                ),
              );
            }),
          ]);
          break;
        } catch (error) {
          const retryable = error instanceof AiProviderError && error.retryable;
          if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
        } finally {
          clearTimeout(timer);
        }
      }

      const result = validateAiExtractionOutput(raw, evidenceIds);
      const analysisId = randomUUID();
      const createdAt = new Date().toISOString();
      const encrypted = encryptAiPayload(
        { result, history: [] } satisfies StoredAiPayload,
        this.kek,
        {
          workspaceId: params.workspaceId,
          expenseId: params.expenseId,
          analysisId,
          version: versionRow.current_version,
        },
      );
      await this.db.query(
        `INSERT INTO ai_analyses (
           id, workspace_id, expense_id, evidence_id, provider, model_id,
           prompt_version, suggested_fields_ciphertext, confidence, warnings,
           disposition, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11);`,
        [
          analysisId,
          params.workspaceId,
          params.expenseId,
          evidenceIds[0],
          this.provider.provider,
          this.provider.modelId,
          AI_EXTRACTION_PROMPT_VERSION,
          encrypted,
          result.overallConfidence,
          // Provider text stays inside the encrypted payload. The legacy JSONB
          // column intentionally carries no plaintext receipt-derived warning.
          JSON.stringify([]),
          createdAt,
        ],
      );
      await this.db.query(
        `UPDATE jobs SET status = 'completed', error_message = NULL, updated_at = NOW() WHERE job_id = $1;`,
        [jobId],
      );
      return {
        jobId,
        analysis: {
          analysisId,
          provider: this.provider.provider,
          modelId: this.provider.modelId,
          promptVersion: AI_EXTRACTION_PROMPT_VERSION,
          disposition: "pending",
          createdAt,
          ...result,
        },
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      await this.db.query(
        `UPDATE jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1;`,
        [jobId, normalized.code],
      );
      throw normalized;
    }
  }

  async recordDisposition(params: {
    workspaceId: string;
    expenseId: string;
    analysisId: string;
    disposition: Exclude<AiDisposition, "pending">;
    corrections?: Partial<
      Record<(typeof AI_FIELD_NAMES)[number], string | null>
    >;
    context: AuthContext;
  }): Promise<{ analysisId: string; disposition: AiDisposition }> {
    await this.policy.authorizeExpense(
      params.workspaceId,
      params.expenseId,
      params.context,
      "edit",
    );
    const result = await this.db.query<AiAnalysisRow>(
      `SELECT * FROM ai_analyses WHERE id = $1 AND workspace_id = $2 AND expense_id = $3;`,
      [params.analysisId, params.workspaceId, params.expenseId],
    );
    const row = result.rows[0];
    if (!row) throw new RecordNotFoundError("AI analysis not found.");
    if (
      !(["accepted", "modified", "rejected"] as const).includes(
        params.disposition,
      )
    ) {
      throw new AiExtractionError(
        "AI_MALFORMED_OUTPUT",
        "Invalid AI suggestion disposition.",
      );
    }
    const corrections: StoredAiPayload["history"][number]["corrections"] = {};
    for (const [key, value] of Object.entries(params.corrections ?? {})) {
      if (!AI_FIELD_NAMES.includes(key as (typeof AI_FIELD_NAMES)[number])) {
        throw new AiExtractionError(
          "AI_MALFORMED_OUTPUT",
          "Correction contains an unknown field.",
        );
      }
      if (value !== null && (typeof value !== "string" || value.length > 256)) {
        throw new AiExtractionError(
          "AI_MALFORMED_OUTPUT",
          "Correction values must be null or short text.",
        );
      }
      corrections[key as (typeof AI_FIELD_NAMES)[number]] = value;
    }
    const stored = decryptAiPayload<StoredAiPayload>(
      row.suggested_fields_ciphertext,
      this.kek,
      {
        workspaceId: params.workspaceId,
        expenseId: params.expenseId,
        analysisId: params.analysisId,
      },
    );
    stored.history.push({
      disposition: params.disposition,
      actorUserId: params.context.userId,
      at: new Date().toISOString(),
      corrections,
    });
    const envelope = JSON.parse(row.suggested_fields_ciphertext) as {
      version: number;
    };
    const encrypted = encryptAiPayload(stored, this.kek, {
      workspaceId: params.workspaceId,
      expenseId: params.expenseId,
      analysisId: params.analysisId,
      version: envelope.version,
    });
    await this.db.query(
      `UPDATE ai_analyses SET disposition = $2, suggested_fields_ciphertext = $3 WHERE id = $1;`,
      [params.analysisId, params.disposition, encrypted],
    );
    return { analysisId: params.analysisId, disposition: params.disposition };
  }

  private normalizeError(error: unknown): AiExtractionError {
    if (error instanceof AiExtractionError) return error;
    if (error instanceof AiProviderError)
      return new AiExtractionError(error.code, error.message);
    if (error instanceof AiOutputValidationError)
      return new AiExtractionError(error.code, error.message);
    return new AiExtractionError(
      "AI_PROVIDER_UNAVAILABLE",
      "AI extraction is unavailable. Continue with manual expense entry.",
    );
  }
}
