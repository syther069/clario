import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import {
  AuthorizationPolicy,
  type AuthContext,
  RecordNotFoundError,
} from "../auth/policy";
import { decryptAiPayload } from "../ai/crypto";
import type { AiDisposition, AiExtractionResult } from "../ai/types";
import { decryptEvidence, unwrapKey } from "../evidence/crypto";
import { getEvidenceKek } from "../evidence/service";
import type { ExpenseDraftPayload } from "../expense/types";
import { evaluateExpenseWarnings } from "./rules";
import type {
  ExpenseWarning,
  ExpenseWarningsResponse,
  WarningDisposition,
  WarningDispositionRecord,
} from "./types";

interface StoredDraftEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: string;
  keyId: string;
  kekIv: string;
  kekAuthTag: string;
}

interface StoredAiPayload {
  result: AiExtractionResult;
  history: Array<{
    disposition: AiDisposition;
    actorUserId: string;
    at: string;
    corrections: Partial<Record<string, string | null>>;
  }>;
}

interface VersionRow {
  current_version: number | string;
  status: string;
  amount: string;
  currency: string;
  recipient: string;
  record_ciphertext: string;
}

interface AuditRow {
  actor_address: string;
  metadata: unknown;
  occurred_at: string | Date;
}

export class WarningService {
  private readonly policy: AuthorizationPolicy;
  private readonly kek: Buffer;

  constructor(
    private readonly db: DatabaseClient,
    kek?: Buffer,
    policy?: AuthorizationPolicy,
  ) {
    this.kek = kek ?? getEvidenceKek();
    this.policy = policy ?? new AuthorizationPolicy(db);
  }

  async getWarnings(params: {
    workspaceId: string;
    expenseId: string;
    context: AuthContext;
  }): Promise<ExpenseWarningsResponse> {
    await this.policy.authorizeExpense(
      params.workspaceId,
      params.expenseId,
      params.context,
      "read",
    );

    const versionResult = await this.db.query<VersionRow>(
      `SELECT e.current_version, ev.status, ev.amount, ev.currency, ev.recipient, ev.record_ciphertext
       FROM expenses e
       JOIN expense_versions ev ON ev.workspace_id = e.workspace_id
        AND ev.expense_id = e.expense_id AND ev.version = e.current_version
       WHERE e.workspace_id = $1 AND e.expense_id = $2;`,
      [params.workspaceId, params.expenseId],
    );
    const version = versionResult.rows[0];
    if (!version) throw new RecordNotFoundError("Expense not found.");
    const currentVersion = Number(version.current_version);
    const payload = this.decryptPayload(
      params.workspaceId,
      params.expenseId,
      currentVersion,
      version.record_ciphertext,
    );

    const evidenceResult = await this.db.query<{ evidence_id: string }>(
      `SELECT evidence_id FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY created_at ASC;`,
      [params.workspaceId, params.expenseId, currentVersion],
    );
    let evidenceSignalsAvailable = evidenceResult.rows.length === 0;
    if (evidenceResult.rows[0]) {
      try {
        await this.policy.authorizeEvidence(
          params.workspaceId,
          params.expenseId,
          evidenceResult.rows[0].evidence_id,
          params.context,
          "read",
        );
        evidenceSignalsAvailable = true;
      } catch (error) {
        if (!(error instanceof ProtocolError)) throw error;
      }
    }

    const reusedResult = evidenceSignalsAvailable
      ? await this.db.query<{ reused_count: number | string }>(
          `SELECT COUNT(DISTINCT other.expense_id) AS reused_count
           FROM evidence_objects current_evidence
           JOIN evidence_objects other
             ON other.workspace_id = current_evidence.workspace_id
            AND other.sha256_hash = current_evidence.sha256_hash
            AND other.expense_id <> current_evidence.expense_id
           WHERE current_evidence.workspace_id = $1
             AND current_evidence.expense_id = $2
             AND current_evidence.version = $3;`,
          [params.workspaceId, params.expenseId, currentVersion],
        )
      : { rows: [{ reused_count: 0 }] };

    const sourceResult = await this.db.query<{
      id: string;
      status: string;
      imported_at: string | Date;
      duplicate_count: number | string;
    }>(
      `SELECT st.id, st.status, st.imported_at,
              (SELECT COUNT(*) FROM source_transactions duplicate
               WHERE duplicate.workspace_id = st.workspace_id
                 AND duplicate.source_chain_id = st.source_chain_id
                 AND LOWER(duplicate.source_transaction_hash) = LOWER(st.source_transaction_hash)
                 AND duplicate.claim_slot = st.claim_slot) AS duplicate_count
       FROM source_transactions st
       WHERE st.workspace_id = $1 AND st.expense_id = $2;`,
      [params.workspaceId, params.expenseId],
    );

    const settlementResult = await this.db.query<{
      reimbursement_id: string;
      version: number | string;
      amount: string;
      recipient_address: string;
      status: string;
      created_at: string | Date;
    }>(
      `SELECT reimbursement_id, version, amount, recipient_address, status, created_at
       FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2
       ORDER BY created_at ASC;`,
      [params.workspaceId, params.expenseId],
    );

    const aiAnalysis = evidenceSignalsAvailable
      ? await this.loadLatestAiAnalysis(params.workspaceId, params.expenseId)
      : null;

    let warnings = evaluateExpenseWarnings({
      workspaceId: params.workspaceId,
      expenseId: params.expenseId,
      currentVersion,
      amountBaseUnits: version.amount,
      currency: version.currency,
      recipient: version.recipient,
      payload,
      evidenceCount: evidenceResult.rows.length,
      evidenceSignalsAvailable,
      reusedEvidenceCount: Number(reusedResult.rows[0]?.reused_count ?? 0),
      sourceTransactions: sourceResult.rows.map((row) => ({
        id: row.id,
        status: row.status,
        duplicateCount: Number(row.duplicate_count),
        importedAt: this.iso(row.imported_at),
      })),
      settlements: settlementResult.rows.map((row) => ({
        reimbursementId: row.reimbursement_id,
        version: Number(row.version),
        amount: row.amount,
        recipient: row.recipient_address,
        status: row.status,
        createdAt: this.iso(row.created_at),
      })),
      aiAnalysis,
    });

    warnings = await this.attachDispositionHistory(
      params.workspaceId,
      params.expenseId,
      warnings,
    );

    return {
      workspaceId: params.workspaceId,
      expenseId: params.expenseId,
      version: currentVersion,
      warnings,
      blockingCount: warnings.filter(
        (warning) => warning.severity === "blocking",
      ).length,
      reviewCount: warnings.filter((warning) => warning.severity === "review")
        .length,
      evaluatedAt: new Date().toISOString(),
      authorityNotice:
        "Warnings are advisory unless marked blocking. They never approve or reject an expense, and blocking settlement checks remain server-enforced.",
    };
  }

  async recordDisposition(params: {
    workspaceId: string;
    expenseId: string;
    warningId: string;
    disposition: WarningDisposition;
    context: AuthContext;
  }): Promise<WarningDispositionRecord> {
    const allowed: readonly WarningDisposition[] = [
      "acknowledged",
      "confirmed_issue",
      "dismissed_false_positive",
    ];
    if (!allowed.includes(params.disposition)) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: "Unsupported warning disposition.",
      });
    }
    const current = await this.getWarnings(params);
    const warning = current.warnings.find(
      (item) => item.warningId === params.warningId,
    );
    if (!warning) throw new RecordNotFoundError("Warning is no longer active.");
    if (
      warning.severity === "blocking" &&
      params.disposition === "dismissed_false_positive"
    ) {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message:
          "A deterministic settlement block cannot be dismissed. Reconcile the underlying authoritative state.",
      });
    }

    const occurredAt = new Date().toISOString();
    await this.db.query(
      `INSERT INTO audit_events (
         audit_id, workspace_id, actor_address, event_type, entity_type,
         entity_id, metadata, occurred_at
       ) VALUES ($1, $2, $3, 'warning_disposition_recorded', 'expense', $4, $5, $6);`,
      [
        randomUUID(),
        params.workspaceId,
        params.context.address.toLowerCase(),
        params.expenseId,
        JSON.stringify({
          warningId: warning.warningId,
          warningCode: warning.code,
          version: current.version,
          disposition: params.disposition,
          severity: warning.severity,
        }),
        occurredAt,
      ],
    );
    return {
      disposition: params.disposition,
      actorAddress: params.context.address.toLowerCase(),
      occurredAt,
    };
  }

  private decryptPayload(
    workspaceId: string,
    expenseId: string,
    version: number,
    recordCiphertext: string,
  ): ExpenseDraftPayload {
    const envelope = JSON.parse(recordCiphertext) as StoredDraftEnvelope;
    const dek = unwrapKey(
      {
        wrappedKey: Buffer.from(envelope.wrappedKey, "hex"),
        iv: Buffer.from(envelope.kekIv, "hex"),
        authTag: Buffer.from(envelope.kekAuthTag, "hex"),
        keyId: envelope.keyId,
      },
      this.kek,
    );
    const plaintext = decryptEvidence(
      Buffer.from(envelope.ciphertext, "hex"),
      dek,
      Buffer.from(envelope.iv, "hex"),
      Buffer.from(envelope.authTag, "hex"),
      {
        workspaceId: workspaceId.toLowerCase(),
        expenseId: expenseId.toLowerCase(),
        version,
        evidenceId: "draft_record",
      },
    );
    return JSON.parse(plaintext.toString("utf8")) as ExpenseDraftPayload;
  }

  private async loadLatestAiAnalysis(workspaceId: string, expenseId: string) {
    const result = await this.db.query<{
      id: string;
      provider: string;
      disposition: string;
      suggested_fields_ciphertext: string;
      created_at: string | Date;
    }>(
      `SELECT id, provider, disposition, suggested_fields_ciphertext, created_at
       FROM ai_analyses
       WHERE workspace_id = $1 AND expense_id = $2
       ORDER BY created_at DESC
       LIMIT 1;`,
      [workspaceId, expenseId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const stored = decryptAiPayload<StoredAiPayload>(
      row.suggested_fields_ciphertext,
      this.kek,
      { workspaceId, expenseId, analysisId: row.id },
    );
    const corrections: Partial<Record<string, string | null>> = {};
    for (const item of stored.history)
      Object.assign(corrections, item.corrections);
    return {
      analysisId: row.id,
      provider: row.provider,
      createdAt: this.iso(row.created_at),
      disposition: row.disposition,
      result: stored.result,
      corrections,
    };
  }

  private async attachDispositionHistory(
    workspaceId: string,
    expenseId: string,
    warnings: ExpenseWarning[],
  ): Promise<ExpenseWarning[]> {
    if (warnings.length === 0) return warnings;
    const result = await this.db.query<AuditRow>(
      `SELECT actor_address, metadata, occurred_at
       FROM audit_events
       WHERE workspace_id = $1 AND entity_type = 'expense' AND entity_id = $2
         AND event_type = 'warning_disposition_recorded'
       ORDER BY occurred_at ASC;`,
      [workspaceId, expenseId],
    );
    const byWarning = new Map<string, WarningDispositionRecord[]>();
    for (const row of result.rows) {
      const metadata =
        typeof row.metadata === "string"
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : (row.metadata as Record<string, unknown>);
      if (
        !metadata ||
        typeof metadata.warningId !== "string" ||
        ![
          "acknowledged",
          "confirmed_issue",
          "dismissed_false_positive",
        ].includes(String(metadata.disposition))
      ) {
        continue;
      }
      const history = byWarning.get(metadata.warningId) ?? [];
      history.push({
        disposition: metadata.disposition as WarningDisposition,
        actorAddress: row.actor_address,
        occurredAt: this.iso(row.occurred_at),
      });
      byWarning.set(metadata.warningId, history);
    }
    return warnings.map((warning) => {
      const history = byWarning.get(warning.warningId) ?? [];
      return {
        ...warning,
        history,
        disposition: history.at(-1) ?? null,
      };
    });
  }

  private iso(value: string | Date): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
