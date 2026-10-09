/**
 * Clario Settlement Service (SET-001)
 *
 * Prepares and reconciles treasury reimbursement for an approved current expense version.
 * Token address and decimals sourced exclusively from validated deployment configuration.
 *
 * Invariants enforced:
 * - TREASURY_ROLE required with recent wallet confirmation (RULES §8)
 * - Token configuration sourced from deployment manifest — no hardcoded addresses (RULES §10.4)
 * - Current version and valid approval verified before calldata is generated (RULES §10.1)
 * - Duplicate settlement blocked at application layer (RULES §10.3, founder invariant 8)
 * - No private fields appear in calldata (RULES R-001)
 * - SUBMITTED lifecycle never labeled confirmed/paid (RULES §10.2)
 */

import { randomUUID } from "node:crypto";
import { type DatabaseClient, withTransaction } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import {
  AuthorizationPolicy,
  assertRecentConfirmation,
  type AuthContext,
} from "../auth/policy";
import { formatBaseUnits, parseBaseUnits } from "../expense/amount";
import {
  buildSettlementPrepareResult,
  type SettlementPrepareResult,
  type SettlementTokenInfo,
} from "./calldata";
import {
  validateSettlementReceipt,
  fetchAndValidateSettlementReceipt,
  type MinimalTransactionReceipt,
} from "./receipt";
import { getExplorerTxUrl } from "../import/chains";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface SettlementTokenConfig {
  /** Checksummed EVM address from deployment manifest */
  readonly address: string;
  /** Standard decimals from deployment manifest */
  readonly decimals: number;
  /** Display symbol */
  readonly symbol: string;
}

export interface TreasuryQueueItem {
  readonly expenseId: string;
  readonly workspaceId: string;
  readonly currentVersion: number;
  readonly commitment: string;
  /** Amount in base units (bigint-safe string) */
  readonly amountBaseUnits: string;
  /** Human-readable decimal amount for display */
  readonly amountDisplay: string;
  readonly currency: string;
  /** Reimbursement recipient address */
  readonly recipient: string;
  /** Decision type that authorized this expense */
  readonly decisionType: string;
  /** Address that approved this version */
  readonly reviewerAddress: string;
  readonly decisionRecordedAt: string;
  /** Whether a reimbursement is already pending/submitted for this version */
  readonly hasPendingReimbursement: boolean;
  /** Whether this version is already settled */
  readonly isSettled: boolean;
  /** Whether the last reimbursement attempt failed and can be retried */
  readonly isFailed: boolean;
  /** Whether this expense is blocked from reimbursement due to duplicate receipt or cross-version settlement */
  readonly isDuplicateBlocked?: boolean;
  /** Human-readable reason why duplicate reimbursement is blocked */
  readonly duplicateReason?: string | null;
}

export interface TreasuryQueueResponse {
  readonly workspaceId: string;
  readonly items: readonly TreasuryQueueItem[];
  readonly total: number;
}

export interface SettlementPrepareResponse {
  readonly expenseId: string;
  readonly workspaceId: string;
  readonly version: number;
  readonly commitment: string;
  readonly token: SettlementTokenConfig;
  readonly recipient: string;
  readonly amountBaseUnits: string;
  readonly amountDisplay: string;
  /** Encoded reimburse() calldata */
  readonly calldata: string;
  /** ERC-20 approve() calldata if allowance is insufficient */
  readonly approveCalldata: string | null;
  /** Whether the wallet needs to approve the token spend first */
  readonly needsApproval: boolean;
  readonly allowanceRequired: string;
  /** Human-readable intent summary for the wallet signing dialog */
  readonly intent: SettlementPrepareResult["intent"];
  /** Chain ID the transaction must be sent on */
  readonly chainId: number;
  /** Settlement registry contract address */
  readonly registryAddress: string;
  /** USDC token contract address */
  readonly tokenAddress: string;
  /** Idempotency key for this preparation */
  readonly idempotencyKey: string;
}

export interface SettlementReconcileRequest {
  readonly transactionHash: string;
  readonly idempotencyKey: string;
}

export interface SettlementReconcileResponse {
  readonly reimbursementId: string;
  readonly status: "submitted" | "confirming";
  readonly transactionHash: string;
  readonly expenseId: string;
  readonly version: number;
}

export interface SettlementProof {
  readonly transactionHash: string;
  readonly blockNumber: string;
  readonly blockHash: string;
  readonly paymentReference: string;
  readonly tokenAddress: string;
  readonly recipientAddress: string;
  readonly amountBaseUnits: string;
  readonly amountDisplay: string;
  readonly settledAt: string;
  readonly explorerUrl: string | null;
}

export interface SettlementConfirmResult {
  readonly confirmed: boolean;
  readonly status: "confirmed" | "failed";
  readonly transactionHash: string;
  readonly reimbursementId: string;
  readonly proof?: SettlementProof | undefined;
  readonly reason?: string | undefined;
}

export interface SettlementAttemptItem {
  readonly transactionHash: string;
  readonly status: string;
  readonly submittedAt: string;
  readonly confirmedAt: string | null;
  readonly blockNumber: string | null;
}

export interface SettlementStatusResponse {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly version: number;
  readonly status:
    "unsubmitted" | "submitted" | "confirming" | "confirmed" | "failed";
  readonly attempts: readonly SettlementAttemptItem[];
  readonly proof: SettlementProof | null;
  readonly canRetry: boolean;
}

export interface SettlementSimulationOptions {
  /** Current balance of treasury account in base units */
  readonly treasuryBalance?: bigint | undefined;
  /** Current allowance of treasury account for the settlement registry in base units */
  readonly treasuryAllowance?: bigint | undefined;
  /** Require that allowance is already sufficient, otherwise fail preparation */
  readonly requireSufficientAllowance?: boolean | undefined;
  /** Simulation probe for onchain call execution */
  readonly simulateCall?:
    | ((params: {
        from: string;
        to: string;
        data: string;
      }) => Promise<{ success: boolean; revertReason?: string }>)
    | undefined;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class SettlementAuthorizationError extends ProtocolError {
  readonly status = 403;
  constructor(message: string) {
    super("UNAUTHORIZED", { message });
    this.name = "SettlementAuthorizationError";
  }
}

export class SettlementNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "SettlementNotFoundError";
  }
}

export class SettlementPreConditionError extends Error {
  readonly code: string;
  readonly status = 422;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.name = "SettlementPreConditionError";
  }
}

// ---------------------------------------------------------------------------
// DB row interfaces
// ---------------------------------------------------------------------------

interface ExpenseVersionRow {
  workspace_id: string;
  expense_id: string;
  version: number | string;
  commitment: string;
  previous_commitment: string | null;
  amount: string | null;
  currency: string | null;
  recipient: string | null;
  status: string;
}

interface DecisionRow {
  decision_type: string;
  reviewer_address: string;
  recorded_at: Date | string;
}

interface ReimbursementRow {
  reimbursement_id: string;
  workspace_id?: string;
  expense_id?: string;
  version?: number | string;
  token_address?: string;
  recipient_address?: string;
  amount?: string;
  payment_reference?: string;
  status: string;
  transaction_hash: string | null;
  settled_at: Date | string | null;
  created_at?: Date | string;
}

interface ExpenseRow {
  workspace_id: string;
  expense_id: string;
  current_version: number | null;
  created_by: string;
}

// ---------------------------------------------------------------------------
// SettlementService
// ---------------------------------------------------------------------------

export class SettlementService {
  private readonly policy: AuthorizationPolicy;

  constructor(private readonly db: DatabaseClient) {
    this.policy = new AuthorizationPolicy(db);
  }

  /**
   * Returns the treasury queue: expenses with a valid current approval but no active settlement.
   * Enforces TREASURY_ROLE.
   */
  async getTreasuryQueue(
    workspaceId: string,
    context: AuthContext,
    tokenConfig?: SettlementTokenConfig,
  ): Promise<TreasuryQueueResponse> {
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "viewing the treasury reimbursement queue",
    );

    // Join: current expense versions that have an Approve decision and no active settlement
    const queueRes = await this.db.query<{
      expense_id: string;
      workspace_id: string;
      version: number | string;
      commitment: string;
      amount: string | null;
      currency: string | null;
      recipient: string | null;
      decision_type: string;
      reviewer_address: string;
      recorded_at: Date | string;
    }>(
      `SELECT
         ev.expense_id,
         ev.workspace_id,
         ev.version,
         ev.commitment,
         ev.amount,
         ev.currency,
         ev.recipient,
         d.decision_type,
         d.reviewer_address,
         d.recorded_at
       FROM expense_versions ev
       JOIN expenses e ON e.workspace_id = ev.workspace_id AND e.expense_id = ev.expense_id
       JOIN decisions d ON d.workspace_id = ev.workspace_id AND d.expense_id = ev.expense_id AND d.version = ev.version
       WHERE ev.workspace_id = $1
         AND ev.status IN ('current', 'submitted')
         AND d.decision_type = 'approve'
         AND e.current_version = ev.version
       ORDER BY d.recorded_at DESC`,
      [workspaceId],
    );

    // For each, check for pending/active reimbursements
    const items: TreasuryQueueItem[] = [];

    for (const row of queueRes.rows) {
      // Check all reimbursements for this expense across any version
      const reimbRes = await this.db.query<ReimbursementRow>(
        `SELECT reimbursement_id, version, status, transaction_hash, settled_at
         FROM reimbursements
         WHERE workspace_id = $1 AND expense_id = $2
         ORDER BY created_at DESC`,
        [workspaceId, row.expense_id],
      );

      const confirmedReimb = reimbRes.rows.find((r) => r.status === "confirmed");
      const pendingReimb = reimbRes.rows.find((r) =>
        ["preparing", "awaiting_signature", "submitted", "confirming"].includes(
          r.status,
        ),
      );
      const latestReimb = reimbRes.rows[0];

      const isSettled = !!confirmedReimb;
      const hasPendingReimbursement = !isSettled && !!pendingReimb;
      const isFailed =
        !isSettled &&
        !hasPendingReimbursement &&
        !!latestReimb &&
        latestReimb.status === "failed";

      // Check if any attached receipt has already been reimbursed or is pending in another expense
      let isDuplicateBlocked = false;
      let duplicateReason: string | null = null;

      if (!isSettled) {
        const dupReceiptRes = await this.db.query<{
          other_expense_id: string;
          reimbursement_status: string;
        }>(
          `SELECT other_eo.expense_id AS other_expense_id, r.status AS reimbursement_status
           FROM evidence_objects current_eo
           JOIN evidence_objects other_eo
             ON other_eo.workspace_id = current_eo.workspace_id
            AND other_eo.sha256_hash = current_eo.sha256_hash
            AND other_eo.expense_id <> current_eo.expense_id
           JOIN reimbursements r
             ON r.workspace_id = other_eo.workspace_id
            AND r.expense_id = other_eo.expense_id
           WHERE current_eo.workspace_id = $1
             AND current_eo.expense_id = $2
             AND current_eo.version = $3
             AND r.status NOT IN ('failed', 'cancelled')
           ORDER BY r.created_at DESC
           LIMIT 1`,
          [workspaceId, row.expense_id, row.version],
        );

        if (dupReceiptRes.rows.length > 0) {
          const dup = dupReceiptRes.rows[0]!;
          isDuplicateBlocked = true;
          duplicateReason =
            dup.reimbursement_status === "confirmed"
              ? `Receipt already reimbursed in expense '${dup.other_expense_id.slice(0, 10)}...'`
              : `Receipt pending reimbursement in expense '${dup.other_expense_id.slice(0, 10)}...'`;
        }
      }

      const amountBaseUnits = row.amount ?? "0";
      const decimals =
        row.currency === "USDC" ? (tokenConfig?.decimals ?? 6) : 6;
      let amountDisplay = "?";
      try {
        amountDisplay = formatBaseUnits(BigInt(amountBaseUnits), decimals);
      } catch {
        amountDisplay = amountBaseUnits;
      }

      items.push({
        expenseId: row.expense_id,
        workspaceId: row.workspace_id,
        currentVersion: Number(row.version),
        commitment: row.commitment,
        amountBaseUnits,
        amountDisplay,
        currency: row.currency ?? "USDC",
        recipient: row.recipient ?? "",
        decisionType: row.decision_type,
        reviewerAddress: row.reviewer_address,
        decisionRecordedAt:
          row.recorded_at instanceof Date
            ? row.recorded_at.toISOString()
            : String(row.recorded_at),
        hasPendingReimbursement,
        isSettled,
        isFailed,
        isDuplicateBlocked,
        duplicateReason,
      });
    }

    return {
      workspaceId,
      items,
      total: items.length,
    };
  }

  /**
   * Prepares a reimbursement for the current approved expense version.
   *
   * Checks performed before calldata generation (RULES §10.1):
   * 1. TREASURY_ROLE + recent confirmation
   * 2. Expense exists in workspace (workspace isolation)
   * 3. Target version is the current version
   * 4. A valid Approve decision exists for the current version/commitment
   * 5. No active or settled reimbursement already exists (duplicate guard)
   * 6. Token address sourced from deployment manifest, not hardcoded
   * 7. Recipient is a valid EVM address
   * 8. Amount is a positive base-unit integer
   */
  async prepareSettlement(
    workspaceId: string,
    expenseId: string,
    context: AuthContext,
    tokenConfig: SettlementTokenConfig,
    registryAddress: string,
    chainId: number,
    simulationOptions?: SettlementSimulationOptions,
  ): Promise<SettlementPrepareResponse> {
    // 1. Auth: TREASURY_ROLE + recent confirmation
    assertRecentConfirmation(context.session);
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "preparing a reimbursement",
    );

    // 2. Validate configuration: token, registry, chain (RULES §5.1, §10.4, §14)
    if (
      !tokenConfig ||
      !tokenConfig.address ||
      tokenConfig.address === "0x0000000000000000000000000000000000000000" ||
      !/^0x[0-9a-fA-F]{40}$/.test(tokenConfig.address.trim())
    ) {
      throw new SettlementPreConditionError(
        "INVALID_TOKEN_CONFIG",
        "Settlement token address is invalid or unconfigured.",
      );
    }
    if (
      typeof tokenConfig.decimals !== "number" ||
      !Number.isInteger(tokenConfig.decimals) ||
      tokenConfig.decimals < 0 ||
      tokenConfig.decimals > 18
    ) {
      throw new SettlementPreConditionError(
        "INVALID_TOKEN_CONFIG",
        "Settlement token decimals must be an integer between 0 and 18.",
      );
    }
    if (
      !registryAddress ||
      registryAddress === "0x0000000000000000000000000000000000000000" ||
      !/^0x[0-9a-fA-F]{40}$/.test(registryAddress.trim())
    ) {
      throw new SettlementPreConditionError(
        "INVALID_REGISTRY_CONFIG",
        "Settlement registry address is invalid or unconfigured.",
      );
    }
    if (
      typeof chainId !== "number" ||
      !Number.isInteger(chainId) ||
      chainId <= 0
    ) {
      throw new SettlementPreConditionError(
        "UNSUPPORTED_NETWORK",
        `Unsupported settlement network chain ID (${chainId}).`,
      );
    }

    // 3. Load expense record (workspace-isolated)
    const expRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, current_version, created_by
       FROM expenses
       WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      throw new SettlementNotFoundError("Expense not found in this workspace.");
    }

    const expenseRec = expRes.rows[0]!;
    const currentVersion = expenseRec.current_version;

    if (!currentVersion) {
      throw new SettlementPreConditionError(
        "VERSION_MISMATCH",
        "Expense has no submitted version.",
      );
    }

    // 4. Load current expense version
    const verRes = await this.db.query<ExpenseVersionRow>(
      `SELECT workspace_id, expense_id, version, commitment, previous_commitment, amount, currency, recipient, status
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
      [workspaceId, expenseId, currentVersion],
    );

    if (verRes.rows.length === 0) {
      throw new SettlementPreConditionError(
        "VERSION_MISMATCH",
        `Version ${currentVersion} not found.`,
      );
    }

    const ver = verRes.rows[0]!;
    const verStatus = ver.status;

    if (!["current", "submitted"].includes(verStatus)) {
      throw new SettlementPreConditionError(
        "STALE_VERSION",
        `Version ${currentVersion} has status '${verStatus}' — only current versions may be reimbursed.`,
      );
    }

    // Verify expense currency matches supported settlement asset (RULES §10.4)
    if (
      ver.currency &&
      ver.currency.toUpperCase() !== tokenConfig.symbol.toUpperCase()
    ) {
      throw new SettlementPreConditionError(
        "UNSUPPORTED_ASSET",
        `Expense currency '${ver.currency}' does not match supported settlement token '${tokenConfig.symbol}'.`,
      );
    }

    const commitment = ver.commitment;

    // 4. Verify valid Approve decision for this exact version+commitment
    const decRes = await this.db.query<DecisionRow>(
      `SELECT decision_type, reviewer_address, recorded_at
       FROM decisions
       WHERE workspace_id = $1
         AND expense_id = $2
         AND version = $3
         AND commitment = $4
         AND decision_type = 'approve'
       LIMIT 1`,
      [workspaceId, expenseId, currentVersion, commitment],
    );

    if (decRes.rows.length === 0) {
      throw new SettlementPreConditionError(
        "APPROVAL_REQUIRED",
        `Version ${currentVersion} does not have a valid Approve decision. Only approved current versions may be reimbursed.`,
      );
    }

    // 5. Authoritative duplicate settlement & duplicate receipt guards
    // 5a. Cross-version duplicate check: an expense cannot be reimbursed more than once
    const allReimbRes = await this.db.query<ReimbursementRow>(
      `SELECT reimbursement_id, version, status, transaction_hash, settled_at
       FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2
       ORDER BY created_at DESC`,
      [workspaceId, expenseId],
    );

    const confirmedReimb = allReimbRes.rows.find((r) => r.status === "confirmed");
    if (confirmedReimb) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `This expense has already been reimbursed and settled in version ${confirmedReimb.version} (reimbursement ${confirmedReimb.reimbursement_id}${confirmedReimb.transaction_hash ? ` on transaction ${confirmedReimb.transaction_hash}` : ""}). Expenses cannot be reimbursed more than once.`,
      );
    }

    const pendingReimb = allReimbRes.rows.find((r) =>
      ["preparing", "awaiting_signature", "submitted", "confirming"].includes(
        r.status,
      ),
    );
    if (pendingReimb) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `A reimbursement is already pending for this expense (version ${pendingReimb.version}, status '${pendingReimb.status}'). Wait for confirmation or resolution before retrying.`,
      );
    }

    // Check projection_settlements in case settled onchain
    const projRes = await this.db.query<{ version: number; settled_at_tx: string }>(
      `SELECT version, settled_at_tx
       FROM projection_settlements
       WHERE workspace_id = $1 AND expense_id = $2
       LIMIT 1`,
      [workspaceId, expenseId],
    );
    if (projRes.rows.length > 0) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `This expense has already been confirmed as settled on Monad (version ${projRes.rows[0]!.version}, tx ${projRes.rows[0]!.settled_at_tx}). Expenses cannot be settled more than once.`,
      );
    }

    // 5b. Duplicate receipt guard: check if any attached evidence was already settled in another expense
    const dupReceiptRes = await this.db.query<{
      other_expense_id: string;
      other_version: number;
      reimbursement_id: string;
      reimbursement_status: string;
      transaction_hash: string | null;
      sha256_hash: string;
    }>(
      `SELECT
         other_eo.expense_id AS other_expense_id,
         other_eo.version AS other_version,
         r.reimbursement_id,
         r.status AS reimbursement_status,
         r.transaction_hash,
         current_eo.sha256_hash
       FROM evidence_objects current_eo
       JOIN evidence_objects other_eo
         ON other_eo.workspace_id = current_eo.workspace_id
        AND other_eo.sha256_hash = current_eo.sha256_hash
        AND other_eo.expense_id <> current_eo.expense_id
       JOIN reimbursements r
         ON r.workspace_id = other_eo.workspace_id
        AND r.expense_id = other_eo.expense_id
       WHERE current_eo.workspace_id = $1
         AND current_eo.expense_id = $2
         AND current_eo.version = $3
         AND r.status NOT IN ('failed', 'cancelled')
       ORDER BY r.created_at DESC
       LIMIT 1;`,
      [workspaceId, expenseId, currentVersion],
    );

    if (dupReceiptRes.rows.length > 0) {
      const dup = dupReceiptRes.rows[0]!;
      const shortHash = `${dup.sha256_hash.slice(0, 8)}...${dup.sha256_hash.slice(-6)}`;
      if (dup.reimbursement_status === "confirmed") {
        throw new SettlementPreConditionError(
          "DUPLICATE_RECEIPT_SETTLEMENT",
          `Duplicate receipt rejected: An identical receipt file (SHA-256: ${shortHash}) was already reimbursed in expense '${dup.other_expense_id}' (reimbursement ${dup.reimbursement_id}${dup.transaction_hash ? `, tx ${dup.transaction_hash}` : ""}). The same receipt cannot be reimbursed more than once.`,
        );
      } else {
        throw new SettlementPreConditionError(
          "DUPLICATE_RECEIPT_SETTLEMENT",
          `Duplicate receipt rejected: An identical receipt file (SHA-256: ${shortHash}) is currently pending reimbursement in expense '${dup.other_expense_id}' (status: ${dup.reimbursement_status}). Wait for resolution before retrying.`,
        );
      }
    }

    // 5c. Duplicate source transaction guard: check if any source transaction was already reimbursed in another expense
    const dupSourceRes = await this.db.query<{
      other_expense_id: string;
      source_transaction_hash: string;
      claim_slot: number;
      reimbursement_id: string;
      reimbursement_status: string;
    }>(
      `SELECT
         other_st.expense_id AS other_expense_id,
         current_st.source_transaction_hash,
         current_st.claim_slot,
         r.reimbursement_id,
         r.status AS reimbursement_status
       FROM source_transactions current_st
       JOIN source_transactions other_st
         ON other_st.workspace_id = current_st.workspace_id
        AND other_st.source_chain_id = current_st.source_chain_id
        AND LOWER(other_st.source_transaction_hash) = LOWER(current_st.source_transaction_hash)
        AND other_st.claim_slot = current_st.claim_slot
        AND other_st.expense_id <> current_st.expense_id
       JOIN reimbursements r
         ON r.workspace_id = other_st.workspace_id
        AND r.expense_id = other_st.expense_id
       WHERE current_st.workspace_id = $1
         AND current_st.expense_id = $2
         AND r.status NOT IN ('failed', 'cancelled')
       ORDER BY r.created_at DESC
       LIMIT 1;`,
      [workspaceId, expenseId],
    );

    if (dupSourceRes.rows.length > 0) {
      const dup = dupSourceRes.rows[0]!;
      throw new SettlementPreConditionError(
        "DUPLICATE_SOURCE_SETTLEMENT",
        `Duplicate source transaction rejected: The source transaction (${dup.source_transaction_hash.slice(0, 10)}..., slot ${dup.claim_slot}) was already settled or is pending settlement in expense '${dup.other_expense_id}'.`,
      );
    }

    // 6. Validate recipient address
    const recipient = ver.recipient;
    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient.trim())) {
      throw new SettlementPreConditionError(
        "INVALID_RECIPIENT",
        "Expense version has no valid EVM recipient address. The submission must include a checksummed recipient.",
      );
    }

    // 7. Validate and parse amount
    const rawAmount = ver.amount;
    if (!rawAmount) {
      throw new SettlementPreConditionError(
        "INVALID_AMOUNT",
        "Expense version has no amount.",
      );
    }

    let amountBaseUnits: bigint;
    try {
      // Amount stored in base units as a decimal string
      amountBaseUnits = BigInt(rawAmount);
      if (amountBaseUnits <= 0n) throw new Error("non-positive");
    } catch {
      // Fall back: try parsing as decimal with token decimals
      try {
        amountBaseUnits = parseBaseUnits(rawAmount, tokenConfig.decimals);
      } catch {
        throw new SettlementPreConditionError(
          "INVALID_AMOUNT",
          `Cannot parse expense amount '${rawAmount}' as base units.`,
        );
      }
    }

    // 8. Balance check (if balance is provided via simulation/query)
    if (
      simulationOptions?.treasuryBalance !== undefined &&
      simulationOptions.treasuryBalance < amountBaseUnits
    ) {
      throw new SettlementPreConditionError(
        "INSUFFICIENT_BALANCE",
        `Treasury balance (${simulationOptions.treasuryBalance.toString()} base units) is less than required amount (${amountBaseUnits.toString()} base units).`,
      );
    }

    // 9. Build calldata — token from config, never from user input
    const tokenInfo: SettlementTokenInfo = {
      address: tokenConfig.address,
      decimals: tokenConfig.decimals,
      symbol: tokenConfig.symbol,
    };

    const currentAllowance = simulationOptions?.treasuryAllowance ?? 0n;

    if (
      simulationOptions?.requireSufficientAllowance &&
      currentAllowance < amountBaseUnits
    ) {
      throw new SettlementPreConditionError(
        "INSUFFICIENT_ALLOWANCE",
        `Treasury allowance (${currentAllowance.toString()} base units) is less than required amount (${amountBaseUnits.toString()} base units). Grant token spend approval before executing settlement.`,
      );
    }

    const prepareResult = buildSettlementPrepareResult(
      {
        workspaceId,
        expenseId,
        version: currentVersion,
        commitment,
        registryAddress,
        token: tokenInfo,
        recipient: recipient.trim(),
        amountBaseUnits,
      },
      chainId,
      currentAllowance,
    );

    // 10. Run simulation probe if provided
    if (simulationOptions?.simulateCall) {
      const sim = await simulationOptions.simulateCall({
        from: context.address,
        to: registryAddress,
        data: prepareResult.calldata,
      });
      if (!sim.success) {
        throw new SettlementPreConditionError(
          "SIMULATION_FAILED",
          `Reimbursement simulation failed: ${sim.revertReason ?? "execution reverted"}.`,
        );
      }
    }

    const amountDisplay = formatBaseUnits(
      amountBaseUnits,
      tokenConfig.decimals,
    );

    // Generate idempotency key for this preparation
    const idempotencyKey = randomUUID();

    return {
      expenseId,
      workspaceId,
      version: currentVersion,
      commitment,
      token: tokenConfig,
      recipient: recipient.trim(),
      amountBaseUnits: amountBaseUnits.toString(),
      amountDisplay,
      calldata: prepareResult.calldata,
      approveCalldata: prepareResult.approveCalldata,
      needsApproval: prepareResult.needsApproval,
      allowanceRequired: prepareResult.allowanceRequired,
      intent: prepareResult.intent,
      chainId,
      registryAddress,
      tokenAddress: tokenConfig.address,
      idempotencyKey,
    };
  }

  /**
   * Reconciles a submitted reimbursement transaction.
   * Records the chain_transaction and reimbursement row in the database.
   * Does NOT mark as confirmed — confirmation requires receipt validation (SET-002).
   */
  async reconcileSettlement(
    workspaceId: string,
    expenseId: string,
    version: number,
    commitment: string,
    transactionHash: string,
    idempotencyKey: string,
    context: AuthContext,
    tokenConfig: SettlementTokenConfig,
    chainId: number,
    registryAddress: string,
  ): Promise<SettlementReconcileResponse> {
    // Re-verify TREASURY_ROLE + recent confirmation for reconciliation
    assertRecentConfirmation(context.session);
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "reconciling a reimbursement",
    );

    // Validate configuration: token, registry, chain (RULES §5.1, §10.4, §14)
    if (
      !tokenConfig ||
      !tokenConfig.address ||
      tokenConfig.address === "0x0000000000000000000000000000000000000000" ||
      !/^0x[0-9a-fA-F]{40}$/.test(tokenConfig.address.trim())
    ) {
      throw new SettlementPreConditionError(
        "INVALID_TOKEN_CONFIG",
        "Settlement token address is invalid or unconfigured.",
      );
    }
    if (
      !registryAddress ||
      registryAddress === "0x0000000000000000000000000000000000000000" ||
      !/^0x[0-9a-fA-F]{40}$/.test(registryAddress.trim())
    ) {
      throw new SettlementPreConditionError(
        "INVALID_REGISTRY_CONFIG",
        "Settlement registry address is invalid or unconfigured.",
      );
    }
    if (
      typeof chainId !== "number" ||
      !Number.isInteger(chainId) ||
      chainId <= 0
    ) {
      throw new SettlementPreConditionError(
        "UNSUPPORTED_NETWORK",
        `Unsupported settlement network chain ID (${chainId}).`,
      );
    }

    // Validate tx hash format
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      throw new SettlementPreConditionError(
        "INVALID_TRANSACTION_HASH",
        "transactionHash must be a 0x-prefixed 64-hex string.",
      );
    }

    // Load expense and verify version still matches
    const expRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      throw new SettlementNotFoundError("Expense not found.");
    }

    const currentVersion = expRes.rows[0]!.current_version;
    if (currentVersion !== version) {
      throw new SettlementPreConditionError(
        "STALE_VERSION",
        `The expense current version is now ${currentVersion}, but reconciliation was for version ${version}. The expense may have been superseded.`,
      );
    }

    // Duplicate settlement guards
    const existingReimbs = await this.db.query<ReimbursementRow>(
      `SELECT reimbursement_id, version, status, transaction_hash, settled_at
       FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2
       ORDER BY created_at DESC`,
      [workspaceId, expenseId],
    );

    // If matching transactionHash was already submitted, handle idempotently
    const sameTxReimb = existingReimbs.rows.find(
      (r) =>
        r.transaction_hash &&
        r.transaction_hash.toLowerCase() === transactionHash.toLowerCase(),
    );
    if (sameTxReimb) {
      return {
        reimbursementId: sameTxReimb.reimbursement_id,
        status:
          sameTxReimb.status === "confirming" ? "confirming" : "submitted",
        transactionHash: sameTxReimb.transaction_hash ?? transactionHash,
        expenseId,
        version: Number(sameTxReimb.version ?? version),
      };
    }

    // If already confirmed on ANY version, reject duplicate settlement
    const confirmedReimb = existingReimbs.rows.find((r) => r.status === "confirmed");
    if (confirmedReimb) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `This expense has already been reimbursed (version ${confirmedReimb.version}, tx ${confirmedReimb.transaction_hash ?? "unknown"}). Duplicate reimbursement is strictly prohibited.`,
      );
    }

    // If an active settlement is currently in flight, reject concurrent duplicate
    const pendingReimb = existingReimbs.rows.find((r) =>
      ["preparing", "awaiting_signature", "submitted", "confirming"].includes(
        r.status,
      ),
    );
    if (pendingReimb) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `A reimbursement is already pending for this expense (version ${pendingReimb.version}, status '${pendingReimb.status}'). Wait for confirmation or resolution before retrying.`,
      );
    }

    // Check projection_settlements across all versions
    const projRes = await this.db.query<{ version: number; settled_at_tx: string }>(
      `SELECT version, settled_at_tx
       FROM projection_settlements
       WHERE workspace_id = $1 AND expense_id = $2
       LIMIT 1`,
      [workspaceId, expenseId],
    );
    if (projRes.rows.length > 0) {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        `This expense has already been confirmed as settled on Monad (version ${projRes.rows[0]!.version}, tx ${projRes.rows[0]!.settled_at_tx}). Expenses cannot be settled more than once.`,
      );
    }

    // Duplicate receipt guard across expenses
    const dupReceiptRes = await this.db.query<{
      other_expense_id: string;
      reimbursement_id: string;
      reimbursement_status: string;
      sha256_hash: string;
    }>(
      `SELECT
         other_eo.expense_id AS other_expense_id,
         r.reimbursement_id,
         r.status AS reimbursement_status,
         current_eo.sha256_hash
       FROM evidence_objects current_eo
       JOIN evidence_objects other_eo
         ON other_eo.workspace_id = current_eo.workspace_id
        AND other_eo.sha256_hash = current_eo.sha256_hash
        AND other_eo.expense_id <> current_eo.expense_id
       JOIN reimbursements r
         ON r.workspace_id = other_eo.workspace_id
        AND r.expense_id = other_eo.expense_id
       WHERE current_eo.workspace_id = $1
         AND current_eo.expense_id = $2
         AND current_eo.version = $3
         AND r.status NOT IN ('failed', 'cancelled')
       ORDER BY r.created_at DESC
       LIMIT 1;`,
      [workspaceId, expenseId, currentVersion],
    );

    if (dupReceiptRes.rows.length > 0) {
      const dup = dupReceiptRes.rows[0]!;
      const shortHash = `${dup.sha256_hash.slice(0, 8)}...${dup.sha256_hash.slice(-6)}`;
      throw new SettlementPreConditionError(
        "DUPLICATE_RECEIPT_SETTLEMENT",
        `Duplicate receipt rejected: An identical receipt file (SHA-256: ${shortHash}) has already been reimbursed or is pending reimbursement in expense '${dup.other_expense_id}'. The same receipt cannot be reimbursed more than once.`,
      );
    }

    // Duplicate source transaction guard across expenses
    const dupSourceRes = await this.db.query<{
      other_expense_id: string;
      source_transaction_hash: string;
      claim_slot: number;
    }>(
      `SELECT
         other_st.expense_id AS other_expense_id,
         current_st.source_transaction_hash,
         current_st.claim_slot
       FROM source_transactions current_st
       JOIN source_transactions other_st
         ON other_st.workspace_id = current_st.workspace_id
        AND other_st.source_chain_id = current_st.source_chain_id
        AND LOWER(other_st.source_transaction_hash) = LOWER(current_st.source_transaction_hash)
        AND other_st.claim_slot = current_st.claim_slot
        AND other_st.expense_id <> current_st.expense_id
       JOIN reimbursements r
         ON r.workspace_id = other_st.workspace_id
        AND r.expense_id = other_st.expense_id
       WHERE current_st.workspace_id = $1
         AND current_st.expense_id = $2
         AND r.status NOT IN ('failed', 'cancelled')
       ORDER BY r.created_at DESC
       LIMIT 1;`,
      [workspaceId, expenseId],
    );

    if (dupSourceRes.rows.length > 0) {
      const dup = dupSourceRes.rows[0]!;
      throw new SettlementPreConditionError(
        "DUPLICATE_SOURCE_SETTLEMENT",
        `Duplicate source transaction rejected: The source transaction (${dup.source_transaction_hash.slice(0, 10)}..., slot ${dup.claim_slot}) was already settled or is pending settlement in expense '${dup.other_expense_id}'.`,
      );
    }

    const reimbursementId = randomUUID();

    try {
      await withTransaction(this.db, async (tx) => {
        // Record chain_transaction
        await tx.query(
          `INSERT INTO chain_transactions (transaction_id, workspace_id, chain_id, transaction_hash, action, status, submitted_at)
           VALUES ($1, $2, $3, $4, 'reimburse', 'submitted', NOW())
           ON CONFLICT (transaction_hash) DO NOTHING`,
          [randomUUID(), workspaceId, chainId, transactionHash],
        );

        // Record reimbursement
        await tx.query(
          `INSERT INTO reimbursements
             (reimbursement_id, workspace_id, expense_id, version, token_address, recipient_address, amount, payment_reference, transaction_hash, status, created_at)
           SELECT $1, $2, $3, $4, $5, ev.recipient, ev.amount,
                  '0x' || LPAD(REPLACE($6::text, '-', ''), 64, '0'),
                  $7, 'submitted', NOW()
           FROM expense_versions ev
           WHERE ev.workspace_id = $2 AND ev.expense_id = $3 AND ev.version = $4`,
          [
            reimbursementId,
            workspaceId,
            expenseId,
            version,
            tokenConfig.address,
            idempotencyKey,
            transactionHash,
          ],
        );

        // Audit log
        await tx.query(
          `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
           VALUES ($1, $2, 'reimbursement_submitted', 'reimbursement', $3, $4, NOW())`,
          [
            workspaceId,
            context.address.toLowerCase(),
            reimbursementId,
            JSON.stringify({
              expenseId,
              version,
              commitment,
              transactionHash,
              chainId,
              registryAddress,
            }),
          ],
        );
      });
    } catch (err: unknown) {
      if (
        (err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "23505") ||
        (err instanceof Error &&
          /unique constraint|duplicate key|idx_reimbursements_active_unique/i.test(
            err.message,
          ))
      ) {
        throw new SettlementPreConditionError(
          "DUPLICATE_SETTLEMENT",
          "A reimbursement is already active or confirmed for this expense. Duplicate settlement is strictly prohibited.",
        );
      }
      throw err;
    }

    return {
      reimbursementId,
      status: "submitted",
      transactionHash,
      expenseId,
      version,
    };
  }

  /**
   * Confirms a reimbursement after onchain execution.
   *
   * Invariants enforced (SET-002):
   * - TREASURY_ROLE + recent wallet confirmation required
   * - Validates transaction receipt against expected contract, token, recipient, amount, version, commitment
   * - Reverted transactions update status to 'failed' and allow safe retry
   * - Atomically updates reimbursements, chain_transactions, projection_settlements, and audit_events
   * - SUBMITTED state is NEVER returned as confirmed without receipt validation
   */
  async confirmSettlement(
    workspaceId: string,
    expenseId: string,
    context: AuthContext,
    options: {
      receipt?: MinimalTransactionReceipt | undefined;
      transactionHash?: string | undefined;
      rpcUrl?: string | undefined;
      chainId: number;
      registryAddress: string;
      tokenConfig: SettlementTokenConfig;
    },
  ): Promise<SettlementConfirmResult> {
    assertRecentConfirmation(context.session);
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "confirming a reimbursement",
    );

    // 1. Load expense and current version
    const expRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );
    if (expRes.rows.length === 0) {
      throw new SettlementNotFoundError("Expense not found.");
    }
    const currentVersion = expRes.rows[0]!.current_version;
    if (!currentVersion) {
      throw new SettlementPreConditionError(
        "NO_VERSION",
        "Expense has no submitted version.",
      );
    }

    // 2. Load current version row
    const verRes = await this.db.query<ExpenseVersionRow>(
      `SELECT workspace_id, expense_id, version, commitment, previous_commitment, amount, currency, recipient, status
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
      [workspaceId, expenseId, currentVersion],
    );
    if (verRes.rows.length === 0) {
      throw new SettlementPreConditionError(
        "VERSION_MISMATCH",
        `Version ${currentVersion} not found.`,
      );
    }
    const ver = verRes.rows[0]!;

    // 3. Load latest reimbursement record
    const reimbRes = await this.db.query<ReimbursementRow>(
      `SELECT reimbursement_id, workspace_id, expense_id, version, token_address, recipient_address,
              amount, payment_reference, transaction_hash, status, settled_at
       FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, expenseId, currentVersion],
    );
    if (reimbRes.rows.length === 0) {
      // Check if another version was already confirmed
      const allConfirmed = await this.db.query<ReimbursementRow>(
        `SELECT reimbursement_id, version, status, transaction_hash, settled_at
         FROM reimbursements
         WHERE workspace_id = $1 AND expense_id = $2 AND status = 'confirmed'`,
        [workspaceId, expenseId],
      );
      if (
        allConfirmed.rows.length > 0 &&
        allConfirmed.rows[0]!.version !== currentVersion
      ) {
        throw new SettlementPreConditionError(
          "DUPLICATE_SETTLEMENT",
          `This expense has already been reimbursed on version ${allConfirmed.rows[0]!.version}. Duplicate settlement across versions is strictly prohibited.`,
        );
      }

      throw new SettlementNotFoundError(
        "No reimbursement attempt found for this expense version.",
      );
    }
    const reimb = reimbRes.rows[0]!;

    // If already confirmed, return idempotently with existing proof
    if (reimb.status === "confirmed") {
      const projRes = await this.db.query<{
        settled_at_block: string;
        settled_at_tx: string;
        payment_reference: string;
        token: string;
        recipient: string;
        amount: string;
      }>(
        `SELECT settled_at_block, settled_at_tx, payment_reference, token, recipient, amount
         FROM projection_settlements
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
        [workspaceId, expenseId, currentVersion],
      );
      const proj = projRes.rows[0];
      const txHash =
        proj?.settled_at_tx ??
        reimb.transaction_hash ??
        options.transactionHash ??
        "";
      const blockNum = proj?.settled_at_block ?? "0";
      const payRef = proj?.payment_reference ?? reimb.payment_reference ?? "0x";
      const tokenAddr =
        proj?.token ?? reimb.token_address ?? options.tokenConfig.address;
      const recAddr =
        proj?.recipient ?? reimb.recipient_address ?? ver.recipient ?? "";
      const baseUnits = proj?.amount ?? reimb.amount ?? ver.amount ?? "0";

      return {
        confirmed: true,
        status: "confirmed",
        transactionHash: txHash,
        reimbursementId: reimb.reimbursement_id,
        proof: {
          transactionHash: txHash,
          blockNumber: blockNum,
          blockHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          paymentReference: payRef,
          tokenAddress: tokenAddr,
          recipientAddress: recAddr,
          amountBaseUnits: baseUnits,
          amountDisplay: formatBaseUnits(
            BigInt(baseUnits),
            options.tokenConfig.decimals,
          ),
          settledAt:
            reimb.settled_at instanceof Date
              ? reimb.settled_at.toISOString()
              : reimb.settled_at
                ? String(reimb.settled_at)
                : new Date().toISOString(),
          explorerUrl: getExplorerTxUrl(options.chainId, txHash),
        },
      };
    }

    // 4. Resolve receipt
    let receipt = options.receipt;
    const txHash = options.transactionHash ?? reimb.transaction_hash;
    if (!receipt && txHash && options.rpcUrl) {
      const fetched = await fetchAndValidateSettlementReceipt({
        rpcUrl: options.rpcUrl,
        transactionHash: txHash as `0x${string}`,
        expected: {
          workspaceId,
          expenseId,
          version: currentVersion,
          commitment: ver.commitment,
          registryAddress: options.registryAddress,
          tokenAddress: options.tokenConfig.address,
          recipientAddress: ver.recipient ?? "",
          amountBaseUnits: BigInt(ver.amount ?? "0"),
        },
      });
      if (fetched.receipt) {
        receipt = fetched.receipt;
      }
    }

    if (!receipt) {
      throw new SettlementPreConditionError(
        "RECEIPT_REQUIRED",
        "A valid transaction receipt or online RPC connection is required to confirm settlement.",
      );
    }

    // 5. Check if reverted
    const isReverted =
      receipt.status === "reverted" ||
      receipt.status === 0 ||
      receipt.status === "0x0";

    if (isReverted) {
      await withTransaction(this.db, async (tx) => {
        await tx.query(
          `UPDATE reimbursements SET status = 'failed', updated_at = NOW() WHERE reimbursement_id = $1`,
          [reimb.reimbursement_id],
        );
        if (receipt.transactionHash) {
          await tx.query(
            `UPDATE chain_transactions SET status = 'failed' WHERE chain_id = $1 AND LOWER(transaction_hash) = LOWER($2)`,
            [options.chainId, receipt.transactionHash],
          );
        }
        await tx.query(
          `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
           VALUES ($1, $2, 'reimbursement_failed', 'reimbursement', $3, $4, NOW())`,
          [
            workspaceId,
            context.address.toLowerCase(),
            reimb.reimbursement_id,
            JSON.stringify({
              expenseId,
              version: currentVersion,
              transactionHash: receipt.transactionHash,
              reason: "Transaction reverted onchain.",
            }),
          ],
        );
      });

      return {
        confirmed: false,
        status: "failed",
        transactionHash: receipt.transactionHash,
        reimbursementId: reimb.reimbursement_id,
        reason: "Transaction reverted onchain.",
      };
    }

    // 6. Validate receipt contents against expected parameters
    const validation = validateSettlementReceipt(receipt, {
      workspaceId,
      expenseId,
      version: currentVersion,
      commitment: ver.commitment,
      registryAddress: options.registryAddress,
      tokenAddress: options.tokenConfig.address,
      recipientAddress: ver.recipient ?? "",
      amountBaseUnits: BigInt(ver.amount ?? "0"),
    });

    if (!validation.valid) {
      if (validation.isReverted) {
        await withTransaction(this.db, async (tx) => {
          await tx.query(
            `UPDATE reimbursements SET status = 'failed', updated_at = NOW() WHERE reimbursement_id = $1`,
            [reimb.reimbursement_id],
          );
          if (receipt.transactionHash) {
            await tx.query(
              `UPDATE chain_transactions SET status = 'failed' WHERE chain_id = $1 AND LOWER(transaction_hash) = LOWER($2)`,
              [options.chainId, receipt.transactionHash],
            );
          }
          await tx.query(
            `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
             VALUES ($1, $2, 'reimbursement_failed', 'reimbursement', $3, $4, NOW())`,
            [
              workspaceId,
              context.address.toLowerCase(),
              reimb.reimbursement_id,
              JSON.stringify({
                expenseId,
                version: currentVersion,
                transactionHash: receipt.transactionHash,
                reason: validation.reason,
              }),
            ],
          );
        });
        return {
          confirmed: false,
          status: "failed",
          transactionHash: receipt.transactionHash,
          reimbursementId: reimb.reimbursement_id,
          reason: validation.reason ?? "Transaction reverted onchain.",
        };
      }

      throw new SettlementPreConditionError(
        "RECEIPT_VALIDATION_FAILED",
        validation.reason ?? "Settlement receipt failed verification.",
      );
    }

    // 7. Successful validation: atomically update tables
    const confirmedTxHash = receipt.transactionHash;
    const blockNum = receipt.blockNumber.toString();
    const blockHash = receipt.blockHash;
    const paymentRef =
      validation.paymentReference ?? reimb.payment_reference ?? "0x";
    const tokenAddr = validation.tokenAddress ?? options.tokenConfig.address;
    const recAddr = validation.recipientAddress ?? ver.recipient ?? "";
    const amountUnits = (
      validation.amountBaseUnits ?? BigInt(ver.amount ?? "0")
    ).toString();

    await withTransaction(this.db, async (tx) => {
      // Update reimbursement row
      await tx.query(
        `UPDATE reimbursements
         SET status = 'confirmed',
             settled_at = NOW(),
             transaction_hash = $1,
             updated_at = NOW()
         WHERE reimbursement_id = $2`,
        [confirmedTxHash, reimb.reimbursement_id],
      );

      // Update chain_transactions
      await tx.query(
        `UPDATE chain_transactions
         SET status = 'confirmed',
             confirmed_at = NOW(),
             block_number = $1
         WHERE chain_id = $2 AND LOWER(transaction_hash) = LOWER($3)`,
        [blockNum, options.chainId, confirmedTxHash],
      );

      // Upsert projection_settlements
      await tx.query(
        `INSERT INTO projection_settlements (
           workspace_id, expense_id, version, commitment, token, recipient,
           amount, payment_reference, settled_at_block, settled_at_tx, indexed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (workspace_id, expense_id, version)
         DO UPDATE SET
           token = EXCLUDED.token,
           recipient = EXCLUDED.recipient,
           amount = EXCLUDED.amount,
           payment_reference = EXCLUDED.payment_reference;`,
        [
          workspaceId,
          expenseId,
          currentVersion,
          ver.commitment,
          tokenAddr.toLowerCase(),
          recAddr.toLowerCase(),
          amountUnits,
          paymentRef,
          blockNum,
          confirmedTxHash,
        ],
      );

      // Audit log
      await tx.query(
        `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
         VALUES ($1, $2, 'reimbursement_confirmed', 'reimbursement', $3, $4, NOW())`,
        [
          workspaceId,
          context.address.toLowerCase(),
          reimb.reimbursement_id,
          JSON.stringify({
            expenseId,
            version: currentVersion,
            transactionHash: confirmedTxHash,
            blockNumber: blockNum,
            paymentReference: paymentRef,
            amount: amountUnits,
          }),
        ],
      );
    });

    const proof: SettlementProof = {
      transactionHash: confirmedTxHash,
      blockNumber: blockNum,
      blockHash,
      paymentReference: paymentRef,
      tokenAddress: tokenAddr,
      recipientAddress: recAddr,
      amountBaseUnits: amountUnits,
      amountDisplay: formatBaseUnits(
        BigInt(amountUnits),
        options.tokenConfig.decimals,
      ),
      settledAt: new Date().toISOString(),
      explorerUrl: getExplorerTxUrl(options.chainId, confirmedTxHash),
    };

    return {
      confirmed: true,
      status: "confirmed",
      transactionHash: confirmedTxHash,
      reimbursementId: reimb.reimbursement_id,
      proof,
    };
  }

  /**
   * Retrieves comprehensive settlement lifecycle status, history of attempts,
   * proof of settlement (if confirmed), and retry eligibility.
   */
  async getSettlementStatus(
    workspaceId: string,
    expenseId: string,
    context: AuthContext,
    chainId: number,
    tokenDecimals: number = 6,
  ): Promise<SettlementStatusResponse> {
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "viewing settlement status",
    );

    const expRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );
    if (expRes.rows.length === 0) {
      throw new SettlementNotFoundError("Expense not found.");
    }
    const currentVersion = expRes.rows[0]!.current_version;
    if (!currentVersion) {
      return {
        workspaceId,
        expenseId,
        version: 0,
        status: "unsubmitted",
        attempts: [],
        proof: null,
        canRetry: false,
      };
    }

    // Query reimbursements for current version
    const reimbRes = await this.db.query<
      ReimbursementRow & { created_at: Date | string }
    >(
      `SELECT reimbursement_id, workspace_id, expense_id, version, token_address, recipient_address,
              amount, payment_reference, transaction_hash, status, settled_at, created_at
       FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY created_at DESC`,
      [workspaceId, expenseId, currentVersion],
    );

    // Query projection_settlements
    const projRes = await this.db.query<{
      settled_at_block: string;
      settled_at_tx: string;
      payment_reference: string;
      token: string;
      recipient: string;
      amount: string;
      indexed_at: Date | string;
    }>(
      `SELECT settled_at_block, settled_at_tx, payment_reference, token, recipient, amount, indexed_at
       FROM projection_settlements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
      [workspaceId, expenseId, currentVersion],
    );
    const proj = projRes.rows[0];

    // Query chain_transactions for these hashes
    const txHashes = reimbRes.rows
      .map((r) => r.transaction_hash)
      .filter((h): h is string => !!h);

    const chainTxRes =
      txHashes.length > 0
        ? await this.db.query<{
            transaction_hash: string;
            status: string;
            submitted_at: Date | string;
            confirmed_at: Date | string | null;
            block_number: string | number | null;
          }>(
            `SELECT transaction_hash, status, submitted_at, confirmed_at, block_number
             FROM chain_transactions
             WHERE workspace_id = $1 AND chain_id = $2 AND transaction_hash = ANY($3)`,
            [workspaceId, chainId, txHashes],
          )
        : { rows: [] };

    const chainTxByHash = new Map<string, (typeof chainTxRes.rows)[0]>();
    for (const ctx of chainTxRes.rows) {
      chainTxByHash.set(ctx.transaction_hash.toLowerCase(), ctx);
    }

    const attempts: SettlementAttemptItem[] = reimbRes.rows.map((r) => {
      const hash = r.transaction_hash ?? "";
      const ctx = hash ? chainTxByHash.get(hash.toLowerCase()) : undefined;
      return {
        transactionHash: hash,
        status: r.status,
        submittedAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        confirmedAt:
          r.settled_at instanceof Date
            ? r.settled_at.toISOString()
            : r.settled_at
              ? String(r.settled_at)
              : ctx?.confirmed_at
                ? ctx.confirmed_at instanceof Date
                  ? ctx.confirmed_at.toISOString()
                  : String(ctx.confirmed_at)
                : null,
        blockNumber: ctx?.block_number
          ? String(ctx.block_number)
          : proj
            ? proj.settled_at_block
            : null,
      };
    });

    const isConfirmed =
      !!proj || reimbRes.rows.some((r) => r.status === "confirmed");
    const latestReimb = reimbRes.rows[0];

    let overallStatus: SettlementStatusResponse["status"] = "unsubmitted";
    let canRetry = false;

    if (isConfirmed) {
      overallStatus = "confirmed";
      canRetry = false;
    } else if (latestReimb) {
      if (
        latestReimb.status === "failed" ||
        latestReimb.status === "cancelled"
      ) {
        overallStatus = "failed";
        canRetry = true;
      } else if (latestReimb.status === "confirming") {
        overallStatus = "confirming";
        canRetry = false;
      } else if (latestReimb.status === "submitted") {
        overallStatus = "submitted";
        canRetry = false;
      }
    }

    let proof: SettlementProof | null = null;
    if (isConfirmed) {
      const confirmedReimb =
        reimbRes.rows.find((r) => r.status === "confirmed") ?? latestReimb;
      const txHash =
        proj?.settled_at_tx ?? confirmedReimb?.transaction_hash ?? "";
      const baseUnits = proj?.amount ?? confirmedReimb?.amount ?? "0";
      proof = {
        transactionHash: txHash,
        blockNumber: proj?.settled_at_block ?? "0",
        blockHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        paymentReference:
          proj?.payment_reference ?? confirmedReimb?.payment_reference ?? "0x",
        tokenAddress: proj?.token ?? confirmedReimb?.token_address ?? "",
        recipientAddress:
          proj?.recipient ?? confirmedReimb?.recipient_address ?? "",
        amountBaseUnits: baseUnits,
        amountDisplay: formatBaseUnits(BigInt(baseUnits), tokenDecimals),
        settledAt:
          confirmedReimb?.settled_at instanceof Date
            ? confirmedReimb.settled_at.toISOString()
            : confirmedReimb?.settled_at
              ? String(confirmedReimb.settled_at)
              : new Date().toISOString(),
        explorerUrl: getExplorerTxUrl(chainId, txHash),
      };
    }

    return {
      workspaceId,
      expenseId,
      version: currentVersion,
      status: overallStatus,
      attempts,
      proof,
      canRetry,
    };
  }

  /**
   * Resets a failed reimbursement attempt so a new attempt can be prepared and submitted.
   *
   * Invariants enforced (SET-002):
   * - TREASURY_ROLE + recent wallet confirmation required
   * - Only failed or cancelled reimbursements may be reset for retry
   * - Confirmed or actively processing reimbursements cannot be retried
   */
  async retryFailedReimbursement(
    workspaceId: string,
    expenseId: string,
    context: AuthContext,
  ): Promise<{ success: boolean; expenseId: string; version: number }> {
    assertRecentConfirmation(context.session);
    const membership = await this.policy.getMembership(workspaceId, context);
    this.policy.assertRole(
      membership,
      "TREASURY_ROLE",
      undefined,
      "retrying a failed reimbursement",
    );

    const expRes = await this.db.query<ExpenseRow>(
      `SELECT workspace_id, expense_id, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );
    if (expRes.rows.length === 0) {
      throw new SettlementNotFoundError("Expense not found.");
    }
    const currentVersion = expRes.rows[0]!.current_version;
    if (!currentVersion) {
      throw new SettlementPreConditionError(
        "NO_VERSION",
        "Expense has no current version.",
      );
    }

    const reimbRes = await this.db.query<ReimbursementRow>(
      `SELECT reimbursement_id, status FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, expenseId, currentVersion],
    );
    if (reimbRes.rows.length === 0) {
      throw new SettlementPreConditionError(
        "NO_ATTEMPT",
        "No prior reimbursement attempt to retry.",
      );
    }
    const latest = reimbRes.rows[0]!;

    if (latest.status === "confirmed") {
      throw new SettlementPreConditionError(
        "DUPLICATE_SETTLEMENT",
        "Expense version is already confirmed and settled.",
      );
    }
    if (
      ["submitted", "confirming", "preparing", "awaiting_signature"].includes(
        latest.status,
      )
    ) {
      throw new SettlementPreConditionError(
        "PENDING_SETTLEMENT",
        `A reimbursement is actively ${latest.status}. It must fail before retry is allowed.`,
      );
    }

    await withTransaction(this.db, async (tx) => {
      await tx.query(
        `UPDATE reimbursements SET status = 'cancelled', updated_at = NOW() WHERE reimbursement_id = $1`,
        [latest.reimbursement_id],
      );
      await tx.query(
        `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
         VALUES ($1, $2, 'reimbursement_retry_reset', 'reimbursement', $3, $4, NOW())`,
        [
          workspaceId,
          context.address.toLowerCase(),
          latest.reimbursement_id,
          JSON.stringify({
            expenseId,
            version: currentVersion,
          }),
        ],
      );
    });

    return {
      success: true,
      expenseId,
      version: currentVersion,
    };
  }

  /**
   * Handles reorg retraction of a previously confirmed settlement.
   */
  async handleReorgRetraction(
    workspaceId: string,
    expenseId: string,
    version: number,
    transactionHash: string,
    chainId: number,
  ): Promise<void> {
    await withTransaction(this.db, async (tx) => {
      // Mark transaction as reorged
      await tx.query(
        `UPDATE chain_transactions SET status = 'reorged' WHERE chain_id = $1 AND LOWER(transaction_hash) = LOWER($2)`,
        [chainId, transactionHash],
      );

      // Revert reimbursement status to failed so it can be retried safely
      await tx.query(
        `UPDATE reimbursements
         SET status = 'failed',
             settled_at = NULL,
             updated_at = NOW()
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
        [workspaceId, expenseId, version],
      );

      // Retract projection
      await tx.query(
        `DELETE FROM projection_settlements
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3`,
        [workspaceId, expenseId, version],
      );

      // Audit event
      await tx.query(
        `INSERT INTO audit_events (workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at)
         VALUES ($1, 'system', 'reimbursement_reorg_retracted', 'reimbursement', $2, $3, NOW())`,
        [
          workspaceId,
          `${expenseId}:v${version}`,
          JSON.stringify({
            expenseId,
            version,
            transactionHash,
            chainId,
          }),
        ],
      );
    });
  }
}
