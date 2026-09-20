import type { DatabaseClient } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import type {
  ExpenseTimelineResponse,
  IndexerLagStatus,
  RpcConflictStatus,
  TimelineEvent,
  TimelineEventType,
} from "./types";

// ---------------------------------------------------------------------------
// Row interface definitions (match SELECT column lists in queries below)
// ---------------------------------------------------------------------------

interface ExpenseRow {
  workspace_id: string;
  expense_id: string;
  created_by: string;
  current_version: number | null;
  status?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ExpenseVersionRow {
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string | null;
  previous_commitment: string | null;
  amount: string | null;
  currency: string | null;
  recipient: string | null;
  status: string;
  submitted_at: Date | string | null;
  submitted_by: string | null;
  submitted_transaction_hash: string | null;
  created_at: Date | string;
}

interface EvidenceObjectRow {
  evidence_id: string;
  workspace_id: string;
  expense_id: string;
  version: number | string;
  storage_key: string;
  sha256_hash: string | null;
  byte_length: number | string | null;
  mime_type: string | null;
  created_at: Date | string;
}

interface DecisionRow {
  decision_id: string;
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string | null;
  decision_type: string;
  reviewer_address: string;
  reason_commitment: string | null;
  policy_version: number | string | null;
  transaction_hash: string | null;
  recorded_at: Date | string;
}

interface ReimbursementRow {
  reimbursement_id: string;
  workspace_id: string;
  expense_id: string;
  version: number | string;
  token_address: string | null;
  recipient_address: string | null;
  amount: string | null;
  payment_reference: string | null;
  transaction_hash: string | null;
  status: string;
  settled_at: Date | string | null;
  created_at: Date | string;
}

interface SourceTransactionRow {
  id: string;
  workspace_id: string;
  expense_id: string;
  source_chain_id: number | string;
  source_transaction_hash: string;
  claim_slot: number | string;
  provider: string | null;
  status: string | null;
  imported_at: Date | string;
}

interface ProjExpenseRow {
  workspace_id: string;
  expense_id: string;
  current_version: number | string | null;
  current_commitment: string | null;
  latest_submitter: string | null;
  submitted_at_block: number | string | null;
  submitted_at_tx: string | null;
  updated_at: Date | string;
  status?: string;
}

interface ProjExpenseVersionRow {
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string;
  submitter: string;
  is_superseded: boolean;
  superseded_by_version: number | string | null;
  submitted_at_block: string | number;
  submitted_at_tx: string;
  indexed_at: Date | string;
}

interface ProjDecisionRow {
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string;
  reviewer: string;
  decision: string;
  reason_commitment: string | null;
  recorded_at_block: string | number;
  recorded_at_tx: string;
  indexed_at: Date | string;
}

interface ProjSettlementRow {
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string;
  token: string;
  recipient: string;
  amount: string;
  payment_reference: string;
  settled_at_block: string | number;
  settled_at_tx: string;
  indexed_at: Date | string;
}

interface ChainTxRow {
  transaction_id: string;
  workspace_id: string;
  chain_id: string | number;
  transaction_hash: string;
  action: string;
  status: string;
  submitted_at: Date | string;
  confirmed_at: Date | string | null;
  block_number: string | number | null;
}

interface IndexerCheckpointRow {
  chain_id: string | number;
  contract_address: string;
  last_indexed_block: string | number;
  last_indexed_block_hash: string | null;
}

interface IndexedEventRow {
  event_id: string;
  chain_id: string | number;
  block_number: string | number;
  block_hash: string | null;
  transaction_hash: string;
  log_index: number | string | null;
  event_name: string;
  payload: unknown;
  removed: boolean;
  status: string | null;
  indexed_at: Date | string;
}

interface WorkspaceAccessRow {
  workspace_id?: string;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class TimelineAuthorizationError extends ProtocolError {
  readonly status = 403;
  constructor(
    message = "Caller is not authorized to view this expense timeline.",
  ) {
    super("UNAUTHORIZED", { message });
    this.name = "TimelineAuthorizationError";
  }
}

export class TimelineNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  readonly status = 404;
  constructor(message = "Expense not found.") {
    super(message);
    this.name = "TimelineNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_TYPE_RANKS: Record<TimelineEventType, number> = {
  draft_created: 1,
  source_transaction_linked: 2,
  evidence_attached: 3,
  evidence_replaced: 4,
  ai_extraction_completed: 5,
  version_submitted: 6,
  commitment_confirmed: 7,
  review_started: 8,
  changes_requested: 9,
  decision_recorded: 10,
  version_superseded: 11,
  reimbursement_prepared: 12,
  settlement_confirmed: 13,
  transaction_reorged: 14,
  transaction_failed: 15,
};

function toIsoString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    try {
      return new Date(val).toISOString();
    } catch {
      return val;
    }
  }
  return null;
}

function safeStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

// ---------------------------------------------------------------------------
// TimelineService
// ---------------------------------------------------------------------------

export class TimelineService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Reconstructs an authoritative, chronological activity timeline joining
   * public onchain projections with authorized private application records.
   */
  async getExpenseTimeline(
    workspaceId: string,
    expenseId: string,
    caller: { userId: string; address: string },
  ): Promise<ExpenseTimelineResponse> {
    // 1. Authorize caller against workspace membership/roles
    await this.assertWorkspaceAccess(workspaceId, caller.address);

    // 2. Fetch primary expense record
    const expenseRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, created_by, current_version, created_at, updated_at
       FROM expenses
       WHERE workspace_id = $1 AND expense_id = $2
       LIMIT 1`,
      [workspaceId, expenseId],
    );

    if (expenseRes.rows.length === 0) {
      throw new TimelineNotFoundError(
        `Expense ${expenseId} does not exist in workspace ${workspaceId}.`,
      );
    }

    const expense = expenseRes.rows[0]!;
    const currentVersionNum = expense.current_version ?? 1;

    // 3. Parallel fetch of all operational and projection tables
    const [
      versionsRes,
      evidenceRes,
      decisionsRes,
      reimbursementsRes,
      sourceTxRes,
      projExpenseRes,
      projVersionsRes,
      projDecisionsRes,
      projSettlementsRes,
      chainTxRes,
      checkpointRes,
      reorgedEventsRes,
    ] = await Promise.all([
      // Operational tables
      this.db.query<ExpenseVersionRow>(
        `SELECT workspace_id, expense_id, version, commitment, previous_commitment, amount, currency, recipient, status, submitted_at, submitted_by, submitted_transaction_hash, created_at
         FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY version ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<EvidenceObjectRow>(
        `SELECT evidence_id, workspace_id, expense_id, version, storage_key, sha256_hash, byte_length, mime_type, created_at
         FROM evidence_objects
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY created_at ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<DecisionRow>(
        `SELECT decision_id, workspace_id, expense_id, version, commitment, decision_type, reviewer_address, reason_commitment, policy_version, transaction_hash, recorded_at
         FROM decisions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY recorded_at ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<ReimbursementRow>(
        `SELECT reimbursement_id, workspace_id, expense_id, version, token_address, recipient_address, amount, payment_reference, transaction_hash, status, settled_at, created_at
         FROM reimbursements
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY created_at ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<SourceTransactionRow>(
        `SELECT id, workspace_id, expense_id, source_chain_id, source_transaction_hash, claim_slot, provider, status, imported_at
         FROM source_transactions
         WHERE workspace_id = $1 AND expense_id = $2`,
        [workspaceId, expenseId],
      ),
      // Projection tables
      this.db.query<ProjExpenseRow>(
        `SELECT workspace_id, expense_id, current_version, current_commitment, latest_submitter, submitted_at_block, submitted_at_tx, updated_at
         FROM projection_expenses
         WHERE workspace_id = $1 AND expense_id = $2
         LIMIT 1`,
        [workspaceId, expenseId],
      ),
      this.db.query<ProjExpenseVersionRow>(
        `SELECT workspace_id, expense_id, version, commitment, submitter, is_superseded, superseded_by_version, submitted_at_block, submitted_at_tx, indexed_at
         FROM projection_expense_versions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY version ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<ProjDecisionRow>(
        `SELECT workspace_id, expense_id, version, commitment, reviewer, decision, reason_commitment, recorded_at_block, recorded_at_tx, indexed_at
         FROM projection_decisions
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY recorded_at_block ASC`,
        [workspaceId, expenseId],
      ),
      this.db.query<ProjSettlementRow>(
        `SELECT workspace_id, expense_id, version, commitment, token, recipient, amount, payment_reference, settled_at_block, settled_at_tx, indexed_at
         FROM projection_settlements
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY settled_at_block ASC`,
        [workspaceId, expenseId],
      ),
      // Chain transactions
      this.db.query<ChainTxRow>(
        `SELECT transaction_id, workspace_id, chain_id, transaction_hash, action, status, submitted_at, confirmed_at, block_number
         FROM chain_transactions
         WHERE workspace_id = $1`,
        [workspaceId],
      ),
      // Indexer checkpoints
      this.db.query<IndexerCheckpointRow>(
        `SELECT chain_id, contract_address, last_indexed_block, last_indexed_block_hash
         FROM indexer_checkpoints
         ORDER BY chain_id ASC`,
        [],
      ),
      // Reorged or removed indexed events
      this.db.query<IndexedEventRow>(
        `SELECT event_id, chain_id, block_number, block_hash, transaction_hash, log_index, event_name, payload, removed, status, indexed_at
         FROM indexed_events
         WHERE workspace_id = $1 AND (removed = true OR status = 'reorged')`,
        [workspaceId],
      ),
    ]);

    // Build fast lookup maps
    const projVersionsByVer = new Map<number, ProjExpenseVersionRow>();
    for (const pv of projVersionsRes.rows) {
      projVersionsByVer.set(Number(pv.version), pv);
    }

    const projDecisionsByVer = new Map<number, ProjDecisionRow[]>();
    for (const pd of projDecisionsRes.rows) {
      const v = Number(pd.version);
      if (!projDecisionsByVer.has(v)) projDecisionsByVer.set(v, []);
      projDecisionsByVer.get(v)!.push(pd);
    }

    const projSettlementByVer = new Map<number, ProjSettlementRow>();
    for (const ps of projSettlementsRes.rows) {
      projSettlementByVer.set(Number(ps.version), ps);
    }

    const chainTxByHash = new Map<string, ChainTxRow>();
    for (const ctx of chainTxRes.rows) {
      if (ctx.transaction_hash) {
        chainTxByHash.set(ctx.transaction_hash.toLowerCase(), ctx);
      }
    }

    // Determine current global version
    const publicCurrentVer =
      projExpenseRes.rows.length > 0
        ? Number(projExpenseRes.rows[0]!.current_version ?? currentVersionNum)
        : currentVersionNum;
    const effectiveCurrentVersion = Math.max(
      currentVersionNum,
      publicCurrentVer,
    );

    // Reconstruct events
    const events: TimelineEvent[] = [];

    // A. Draft Created event
    const draftCreatedAt =
      toIsoString(expense.created_at) ?? new Date().toISOString();
    events.push({
      id: `expense:${expenseId}:draft_created`,
      type: "draft_created",
      title: "Expense Draft Created",
      description: `Draft created in workspace by ${expense.created_by.slice(0, 8)}...`,
      actor: expense.created_by,
      actorRole: "creator",
      version: 1,
      isCurrentVersion: effectiveCurrentVersion === 1,
      isSupersededBranch: effectiveCurrentVersion > 1,
      branchId: "v1",
      source: "application",
      confirmationState: "local_draft",
      timestamp: {
        primary: draftCreatedAt,
        primaryType: "application",
        applicationTime: draftCreatedAt,
        blockTime: null,
        indexerTime: null,
      },
    });

    // B. Source Transaction Linked (if any)
    for (const st of sourceTxRes.rows) {
      const stTime = toIsoString(st.imported_at) ?? draftCreatedAt;
      events.push({
        id: `expense:${expenseId}:source_tx:${st.id}`,
        type: "source_transaction_linked",
        title: "Source Transaction Linked",
        description: `Linked payment fact from chain ${st.source_chain_id} (hash ${st.source_transaction_hash.slice(0, 10)}...)`,
        actor: expense.created_by,
        actorRole: "submitter",
        version: 1,
        isCurrentVersion: effectiveCurrentVersion === 1,
        isSupersededBranch: effectiveCurrentVersion > 1,
        branchId: "v1",
        source: "application",
        confirmationState: "confirmed",
        timestamp: {
          primary: stTime,
          primaryType: "application",
          applicationTime: stTime,
          blockTime: null,
          indexerTime: null,
        },
        txHash: st.source_transaction_hash,
        chainId: Number(st.source_chain_id),
        metadata: {
          claimSlot: st.claim_slot,
          provider: st.provider,
          status: st.status,
        },
      });
    }

    // C. Evidence Attached events
    for (const ev of evidenceRes.rows) {
      const evTime = toIsoString(ev.created_at) ?? draftCreatedAt;
      const v = Number(ev.version);
      const isCurrent = v === effectiveCurrentVersion;
      const isSuperseded = v < effectiveCurrentVersion;
      events.push({
        id: `expense:${expenseId}:evidence:${ev.evidence_id}`,
        type: "evidence_attached",
        title: `Evidence Attached (v${v})`,
        description: `Attached document (${ev.mime_type ?? "unknown"}, ${ev.byte_length ?? 0} bytes, SHA-256 ${String(ev.sha256_hash ?? "").slice(0, 10)}...)`,
        actor: expense.created_by,
        actorRole: "submitter",
        version: v,
        isCurrentVersion: isCurrent,
        isSupersededBranch: isSuperseded,
        branchId: `v${v}`,
        source: "application",
        confirmationState: "local_draft",
        timestamp: {
          primary: evTime,
          primaryType: "application",
          applicationTime: evTime,
          blockTime: null,
          indexerTime: null,
        },
        metadata: {
          evidenceId: ev.evidence_id,
          mimeType: ev.mime_type,
          sha256Hash: ev.sha256_hash,
          byteLength: ev.byte_length !== null ? Number(ev.byte_length) : null,
        },
      });
    }

    // D. Version Submissions & Confirmations
    for (const ver of versionsRes.rows) {
      const v = Number(ver.version);
      const isCurrent = v === effectiveCurrentVersion;
      const isSuperseded = v < effectiveCurrentVersion;
      const projVer = projVersionsByVer.get(v);

      const verCreatedAt = toIsoString(ver.created_at) ?? draftCreatedAt;
      const verSubmittedAt = toIsoString(ver.submitted_at);

      if (ver.status === "draft") {
        // Unsubmitted successor draft
        if (v > 1) {
          events.push({
            id: `expense:${expenseId}:v${v}:draft_created`,
            type: "draft_created",
            title: `Version ${v} Correction Draft Prepared`,
            description: `Successor draft initialized linked to predecessor ${String(ver.previous_commitment ?? "").slice(0, 10)}...`,
            actor: ver.submitted_by ?? expense.created_by,
            actorRole: "submitter",
            version: v,
            isCurrentVersion: true,
            isSupersededBranch: false,
            branchId: `v${v}`,
            source: "application",
            confirmationState: "local_draft",
            timestamp: {
              primary: verCreatedAt,
              primaryType: "application",
              applicationTime: verCreatedAt,
              blockTime: null,
              indexerTime: null,
            },
            previousCommitment: safeStr(ver.previous_commitment),
          });
        }
        continue;
      }

      // Version was submitted
      const txHash = ver.submitted_transaction_hash;
      const chainTx = txHash ? chainTxByHash.get(txHash.toLowerCase()) : null;

      let confirmState: TimelineEvent["confirmationState"] = "pending";
      let source: TimelineEvent["source"] = "application";
      let blockNumber: number | null = null;
      let blockTime: string | null = null;
      let indexerTime: string | null = null;

      if (projVer) {
        confirmState =
          projVer.is_superseded || isSuperseded ? "superseded" : "confirmed";
        source = "hybrid";
        blockNumber = Number(projVer.submitted_at_block);
        indexerTime = toIsoString(projVer.indexed_at);
        // Estimate block time if not directly stored, or use application submitted time
        blockTime = verSubmittedAt ?? toIsoString(projVer.indexed_at);
      } else if (chainTx) {
        if (chainTx.status === "confirmed") {
          confirmState = "confirming";
          source = "onchain_rpc";
          blockNumber = chainTx.block_number
            ? Number(chainTx.block_number)
            : null;
          blockTime = toIsoString(chainTx.confirmed_at);
        } else if (chainTx.status === "reorged") {
          confirmState = "reorged";
          source = "onchain_rpc";
        } else if (chainTx.status === "failed") {
          confirmState = "failed";
          source = "onchain_rpc";
        }
      }

      const primaryTime = blockTime ?? verSubmittedAt ?? verCreatedAt;
      const primaryType = blockTime ? "block" : "application";

      events.push({
        id: `expense:${expenseId}:v${v}:version_submitted`,
        type: "version_submitted",
        title: `Version ${v} Submitted to Monad`,
        description: `Version ${v} submitted with commitment ${String(ver.commitment ?? "").slice(0, 10)}... (Amount: ${ver.amount ?? "?"} ${ver.currency ?? "?"})`,
        actor: ver.submitted_by ?? expense.created_by,
        actorRole: "submitter",
        version: v,
        isCurrentVersion: isCurrent,
        isSupersededBranch: isSuperseded,
        branchId: `v${v}`,
        source,
        confirmationState: confirmState,
        timestamp: {
          primary: primaryTime,
          primaryType,
          applicationTime: verSubmittedAt ?? verCreatedAt,
          blockTime,
          indexerTime,
        },
        commitment: safeStr(ver.commitment),
        previousCommitment: safeStr(ver.previous_commitment),
        txHash: safeStr(projVer?.submitted_at_tx ?? txHash),
        blockNumber,
        metadata: {
          amount: ver.amount,
          currency: ver.currency,
          recipient: ver.recipient,
        },
      });

      // If onchain indexer confirmed the version, emit commitment_confirmed event
      if (projVer) {
        events.push({
          id: `expense:${expenseId}:v${v}:commitment_confirmed`,
          type: "commitment_confirmed",
          title: `Version ${v} Commitment Indexed`,
          description: `Authoritative event ExpenseVersionSubmitted confirmed at block ${projVer.submitted_at_block}`,
          actor: projVer.submitter,
          actorRole: "indexer",
          version: v,
          isCurrentVersion: isCurrent,
          isSupersededBranch: isSuperseded,
          branchId: `v${v}`,
          source: "onchain_indexer",
          confirmationState: isSuperseded ? "superseded" : "confirmed",
          timestamp: {
            primary: toIsoString(projVer.indexed_at) ?? primaryTime,
            primaryType: "indexer",
            applicationTime: verSubmittedAt,
            blockTime,
            indexerTime: toIsoString(projVer.indexed_at),
          },
          commitment: projVer.commitment,
          txHash: projVer.submitted_at_tx,
          blockNumber: Number(projVer.submitted_at_block),
        });
      }

      // If version is superseded, emit version_superseded event
      if (isSuperseded || projVer?.is_superseded) {
        const supersededByVer = projVer?.superseded_by_version ?? v + 1;
        events.push({
          id: `expense:${expenseId}:v${v}:superseded`,
          type: "version_superseded",
          title: `Version ${v} Superseded`,
          description: `Version ${v} was superseded by Version ${supersededByVer}. Approvals on this version are invalidated.`,
          actor: "System / Monad",
          actorRole: "protocol",
          version: v,
          isCurrentVersion: false,
          isSupersededBranch: true,
          branchId: `v${v}`,
          source: projVer?.is_superseded ? "onchain_indexer" : "application",
          confirmationState: "superseded",
          timestamp: {
            primary: toIsoString(projVer?.indexed_at) ?? primaryTime,
            primaryType: projVer?.is_superseded ? "indexer" : "application",
            applicationTime: verSubmittedAt,
            blockTime,
            indexerTime: toIsoString(projVer?.indexed_at),
          },
          commitment: safeStr(ver.commitment),
          metadata: {
            supersededByVersion: supersededByVer,
          },
        });
      }
    }

    // E. Decisions (Review / Approve / Reject / RequestChanges)
    for (const dec of decisionsRes.rows) {
      const v = Number(dec.version);
      const isCurrent = v === effectiveCurrentVersion;
      const isSuperseded = v < effectiveCurrentVersion;
      const projDecList = projDecisionsByVer.get(v) ?? [];
      const projDec = projDecList.find(
        (p) =>
          String(p.decision).toLowerCase() ===
          String(dec.decision_type).toLowerCase(),
      );

      const decRecordedAt = toIsoString(dec.recorded_at) ?? draftCreatedAt;
      let decType: TimelineEventType = "decision_recorded";
      let decTitle = "Review Decision Recorded";

      if (dec.decision_type === "approve") {
        decType = "decision_recorded";
        decTitle = `Version ${v} Approved`;
      } else if (dec.decision_type === "reject") {
        decType = "decision_recorded";
        decTitle = `Version ${v} Rejected`;
      } else if (dec.decision_type === "request_changes") {
        decType = "changes_requested";
        decTitle = `Changes Requested for Version ${v}`;
      }

      const txHash = dec.transaction_hash;
      const chainTx = txHash ? chainTxByHash.get(txHash.toLowerCase()) : null;

      let confirmState: TimelineEvent["confirmationState"] = "confirmed";
      let source: TimelineEvent["source"] = "application";
      let blockNumber: number | null = null;
      let blockTime: string | null = null;
      let indexerTime: string | null = null;

      if (projDec) {
        confirmState = isSuperseded ? "superseded" : "confirmed";
        source = "hybrid";
        blockNumber = Number(projDec.recorded_at_block);
        indexerTime = toIsoString(projDec.indexed_at);
        blockTime = decRecordedAt;
      } else if (chainTx) {
        if (chainTx.status === "confirmed") {
          confirmState = "confirming";
          source = "onchain_rpc";
          blockNumber = chainTx.block_number
            ? Number(chainTx.block_number)
            : null;
          blockTime = toIsoString(chainTx.confirmed_at);
        } else if (chainTx.status === "reorged") {
          confirmState = "reorged";
          source = "onchain_rpc";
        }
      }

      events.push({
        id: `expense:${expenseId}:v${v}:decision:${dec.decision_id}`,
        type: decType,
        title: decTitle,
        description: `Decision '${dec.decision_type}' recorded by reviewer ${dec.reviewer_address.slice(0, 8)}... (Policy v${dec.policy_version ?? "?"})`,
        actor: dec.reviewer_address,
        actorRole: "approver",
        version: v,
        isCurrentVersion: isCurrent,
        isSupersededBranch: isSuperseded,
        branchId: `v${v}`,
        source,
        confirmationState: confirmState,
        timestamp: {
          primary: blockTime ?? decRecordedAt,
          primaryType: blockTime ? "block" : "application",
          applicationTime: decRecordedAt,
          blockTime,
          indexerTime,
        },
        commitment: safeStr(dec.commitment),
        txHash: safeStr(projDec?.recorded_at_tx ?? txHash),
        blockNumber,
        metadata: {
          decisionType: dec.decision_type,
          policyVersion: dec.policy_version,
          reasonCommitment: dec.reason_commitment,
        },
      });
    }

    // F. Reimbursements & Settlements
    for (const reimb of reimbursementsRes.rows) {
      const v = Number(reimb.version);
      const isCurrent = v === effectiveCurrentVersion;
      const isSuperseded = v < effectiveCurrentVersion;
      const projSettlement = projSettlementByVer.get(v);

      const reimbCreatedAt = toIsoString(reimb.created_at) ?? draftCreatedAt;
      const settledAt = toIsoString(reimb.settled_at);

      if (
        [
          "prepared",
          "pending",
          "preparing",
          "awaiting_signature",
          "submitted",
          "confirming",
        ].includes(reimb.status)
      ) {
        const isSubmitted = ["submitted", "confirming"].includes(reimb.status);
        events.push({
          id: `expense:${expenseId}:v${v}:reimbursement:${reimb.reimbursement_id}`,
          type: "reimbursement_prepared",
          title: isSubmitted
            ? `Reimbursement Submitted to Monad (v${v})`
            : `Reimbursement Prepared for Version ${v}`,
          description: isSubmitted
            ? `Treasury submitted reimbursement transaction on Monad. Confirmation pending receipt validation.`
            : `Treasury prepared payment of ${reimb.amount ?? "?"} tokens to recipient ${String(reimb.recipient_address ?? "").slice(0, 8)}...`,
          actor: "Treasury",
          actorRole: "treasury",
          version: v,
          isCurrentVersion: isCurrent,
          isSupersededBranch: isSuperseded,
          branchId: `v${v}`,
          source: isSubmitted ? "onchain_rpc" : "application",
          confirmationState:
            reimb.status === "confirming" ? "confirming" : "pending",
          timestamp: {
            primary: reimbCreatedAt,
            primaryType: "application",
            applicationTime: reimbCreatedAt,
            blockTime: null,
            indexerTime: null,
          },
          txHash: safeStr(reimb.transaction_hash),
          metadata: {
            amount: reimb.amount,
            tokenAddress: reimb.token_address,
            recipientAddress: reimb.recipient_address,
            paymentReference: reimb.payment_reference,
          },
        });
      }

      if (
        reimb.status === "settled" ||
        reimb.status === "confirmed" ||
        projSettlement
      ) {
        const txHash = projSettlement?.settled_at_tx ?? reimb.transaction_hash;
        const blockNumber = projSettlement
          ? Number(projSettlement.settled_at_block)
          : null;
        const indexerTime = projSettlement
          ? toIsoString(projSettlement.indexed_at)
          : null;
        const blockTime = settledAt ?? indexerTime ?? reimbCreatedAt;

        events.push({
          id: `expense:${expenseId}:v${v}:settlement:${reimb.reimbursement_id}`,
          type: "settlement_confirmed",
          title: `Reimbursement Settled on Monad (v${v})`,
          description: `Reimbursement confirmed on Monad Settlement Registry. Payment reference: ${String(reimb.payment_reference ?? "").slice(0, 10)}...`,
          actor: reimb.recipient_address ?? "treasury",
          actorRole: "treasury",
          version: v,
          isCurrentVersion: isCurrent,
          isSupersededBranch: isSuperseded,
          branchId: `v${v}`,
          source: projSettlement ? "hybrid" : "application",
          confirmationState: "confirmed",
          timestamp: {
            primary: blockTime,
            primaryType: projSettlement ? "block" : "application",
            applicationTime: settledAt ?? reimbCreatedAt,
            blockTime,
            indexerTime,
          },
          txHash: safeStr(txHash),
          blockNumber,
          metadata: {
            amount: reimb.amount,
            tokenAddress: reimb.token_address,
            recipientAddress: reimb.recipient_address,
            paymentReference: reimb.payment_reference,
          },
        });
      }

      if (reimb.status === "failed") {
        events.push({
          id: `expense:${expenseId}:v${v}:failed:${reimb.reimbursement_id}`,
          type: "transaction_failed",
          title: `Reimbursement Transaction Failed (v${v})`,
          description: `Treasury reimbursement transaction failed or reverted onchain. Safe retry is available.`,
          actor: "Treasury",
          actorRole: "treasury",
          version: v,
          isCurrentVersion: isCurrent,
          isSupersededBranch: isSuperseded,
          branchId: `v${v}`,
          source: "onchain_rpc",
          confirmationState: "failed",
          timestamp: {
            primary: reimbCreatedAt,
            primaryType: "application",
            applicationTime: reimbCreatedAt,
            blockTime: null,
            indexerTime: null,
          },
          txHash: safeStr(reimb.transaction_hash),
          metadata: {
            amount: reimb.amount,
            tokenAddress: reimb.token_address,
            recipientAddress: reimb.recipient_address,
            paymentReference: reimb.payment_reference,
          },
        });
      }
    }

    // G. Reorg / Conflict Detection
    const affectedTxHashes: string[] = [];
    let hasRpcConflict = false;
    let conflictType: RpcConflictStatus["conflictType"];
    let conflictMessage: string | undefined;

    for (const re of reorgedEventsRes.rows) {
      hasRpcConflict = true;
      conflictType = "reorg_detected";
      conflictMessage = `Chain reorganization retracted event ${re.event_name} at block ${re.block_number}.`;
      affectedTxHashes.push(re.transaction_hash);

      const reorgTime = toIsoString(re.indexed_at) ?? new Date().toISOString();
      events.push({
        id: `expense:${expenseId}:reorg:${re.event_id}`,
        type: "transaction_reorged",
        title: `Transaction Reorganized: ${re.event_name}`,
        description: `Monad event at block ${re.block_number} was rolled back due to chain reorganization.`,
        actor: "Monad Node",
        actorRole: "network",
        version: null,
        isCurrentVersion: false,
        isSupersededBranch: false,
        source: "onchain_indexer",
        confirmationState: "reorged",
        timestamp: {
          primary: reorgTime,
          primaryType: "indexer",
          applicationTime: null,
          blockTime: null,
          indexerTime: reorgTime,
        },
        txHash: re.transaction_hash,
        blockNumber: Number(re.block_number),
      });
    }

    for (const ctx of chainTxRes.rows) {
      if (ctx.status === "reorged") {
        hasRpcConflict = true;
        conflictType = "reorg_detected";
        conflictMessage = `Chain transaction ${ctx.transaction_hash.slice(0, 10)}... was marked reorged.`;
        if (!affectedTxHashes.includes(ctx.transaction_hash)) {
          affectedTxHashes.push(ctx.transaction_hash);
        }
      } else if (ctx.status === "failed") {
        hasRpcConflict = true;
        conflictType = "unconfirmed_timeout";
        conflictMessage = `Transaction ${ctx.transaction_hash.slice(0, 10)}... failed onchain.`;
        if (!affectedTxHashes.includes(ctx.transaction_hash)) {
          affectedTxHashes.push(ctx.transaction_hash);
        }
      }
    }

    // H. Calculate Indexer Lag Status
    let maxConfirmedBlock = 0;
    for (const ctx of chainTxRes.rows) {
      if (ctx.status === "confirmed" && ctx.block_number) {
        const b = Number(ctx.block_number);
        if (b > maxConfirmedBlock) maxConfirmedBlock = b;
      }
    }

    let maxIndexedBlock = 0;
    for (const cp of checkpointRes.rows) {
      const b = Number(cp.last_indexed_block);
      if (b > maxIndexedBlock) maxIndexedBlock = b;
    }
    for (const pv of projVersionsRes.rows) {
      const b = Number(pv.submitted_at_block);
      if (b > maxIndexedBlock) maxIndexedBlock = b;
    }

    // Check if any submitted expense version is confirmed onchain but missing in indexer projection
    let unindexedConfirmedTx = false;
    for (const ver of versionsRes.rows) {
      if (ver.submitted_transaction_hash) {
        const c = chainTxByHash.get(
          ver.submitted_transaction_hash.toLowerCase(),
        );
        const hasProj = projVersionsByVer.has(Number(ver.version));
        if (c?.status === "confirmed" && !hasProj) {
          unindexedConfirmedTx = true;
        }
      }
    }

    const isLagging =
      (maxConfirmedBlock > maxIndexedBlock && maxConfirmedBlock > 0) ||
      unindexedConfirmedTx;
    const lagBlocks = Math.max(0, maxConfirmedBlock - maxIndexedBlock);

    const indexerLag: IndexerLagStatus = {
      isLagging,
      latestKnownBlock: maxConfirmedBlock,
      indexedCheckpointBlock: maxIndexedBlock,
      lagBlocks,
      message: isLagging
        ? `Indexer is trailing onchain state by ${lagBlocks} block(s). Authoritative projections are catching up.`
        : "Indexer is synchronized with finalized onchain blocks.",
    };

    const rpcConflict: RpcConflictStatus = {
      hasConflict: hasRpcConflict,
      conflictType,
      message: conflictMessage,
      affectedTxHashes:
        affectedTxHashes.length > 0 ? affectedTxHashes : undefined,
    };

    // I. Deterministic Sorting
    events.sort((a, b) => {
      // 1. Primary timestamp ascending
      const timeDiff =
        new Date(a.timestamp.primary).getTime() -
        new Date(b.timestamp.primary).getTime();
      if (timeDiff !== 0) return timeDiff;

      // 2. Version ascending (nulls first)
      const verA = a.version ?? -1;
      const verB = b.version ?? -1;
      if (verA !== verB) return verA - verB;

      // 3. Event type rank
      const rankA = EVENT_TYPE_RANKS[a.type] ?? 99;
      const rankB = EVENT_TYPE_RANKS[b.type] ?? 99;
      if (rankA !== rankB) return rankA - rankB;

      // 4. Stable ID tie-breaker
      return a.id.localeCompare(b.id);
    });

    const projExpense = projExpenseRes.rows[0];

    return {
      expenseId,
      workspaceId,
      currentVersion: effectiveCurrentVersion,
      currentStatus:
        expense.status ??
        (projExpense as { status?: string } | undefined)?.status ??
        "submitted",
      isSuperseded: false, // current version is not superseded
      events,
      indexerLag,
      rpcConflict,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Asserts caller has active role or membership access to the workspace.
   */
  private async assertWorkspaceAccess(
    workspaceId: string,
    callerAddress: string,
  ): Promise<void> {
    const res = await this.db.query<WorkspaceAccessRow>(
      `SELECT 1 FROM workspaces WHERE workspace_id = $1 AND LOWER(created_by) = LOWER($2)
       UNION
       SELECT 1 FROM role_grants WHERE workspace_id = $1 AND LOWER(account_address) = LOWER($2) AND revoked_at IS NULL
       UNION
       SELECT 1 FROM memberships WHERE workspace_id = $1 AND LOWER(account_address) = LOWER($2)
       LIMIT 1`,
      [workspaceId, callerAddress],
    );

    if (res.rows.length === 0) {
      throw new TimelineAuthorizationError(
        `Address ${callerAddress} does not have access to workspace ${workspaceId}.`,
      );
    }
  }
}
