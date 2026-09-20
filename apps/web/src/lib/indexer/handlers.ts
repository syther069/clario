import type { DatabaseClient } from "@clario/database";
import {
  OnchainDecision,
  type ClarioPublicEvent,
  type DecisionRecordedEvent,
  type ExpenseVersionSubmittedEvent,
  type ExpenseVersionSupersededEvent,
  type PolicyUpdatedEvent,
  type RoleGrantedEvent,
  type RoleRevokedEvent,
  type SettlementRecordedEvent,
  type WorkspaceCreatedEvent,
} from "@clario/protocol";
import { assertPublicProjectionPrivacy } from "./privacy";
import type { LogMetadata } from "./types";

/**
 * Dispatches an authoritative Clario public event to its corresponding projection handler.
 */
export async function handlePublicEvent(
  tx: DatabaseClient,
  event: ClarioPublicEvent,
  meta: LogMetadata,
): Promise<void> {
  switch (event.eventName) {
    case "WorkspaceCreated":
      await handleWorkspaceCreated(tx, event, meta);
      break;
    case "RoleGranted":
      await handleRoleGranted(tx, event, meta);
      break;
    case "RoleRevoked":
      await handleRoleRevoked(tx, event, meta);
      break;
    case "PolicyUpdated":
      await handlePolicyUpdated(tx, event, meta);
      break;
    case "ExpenseVersionSubmitted":
      await handleExpenseVersionSubmitted(tx, event, meta);
      break;
    case "ExpenseVersionSuperseded":
      await handleExpenseVersionSuperseded(tx, event);
      break;
    case "DecisionRecorded":
      await handleDecisionRecorded(tx, event, meta);
      break;
    case "SettlementRecorded":
      await handleSettlementRecorded(tx, event, meta);
      break;
    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Handles WorkspaceCreated event.
 */
export async function handleWorkspaceCreated(
  tx: DatabaseClient,
  event: WorkspaceCreatedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  // 1. Ensure operational workspaces table row exists to satisfy foreign keys
  await tx.query(
    `INSERT INTO workspaces (workspace_id, name, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id) DO NOTHING;`,
    [
      event.workspaceId,
      "Workspace " + event.workspaceId.slice(0, 10),
      event.owner,
    ],
  );

  // 2. Insert or update public workspace projection
  await tx.query(
    `INSERT INTO projection_workspaces (
       workspace_id, owner_address, policy_commitment, current_policy_version,
       created_at_block, created_at_tx, updated_at
     ) VALUES ($1, $2, $3, 1, $4, $5, NOW())
     ON CONFLICT (workspace_id)
     DO UPDATE SET
       owner_address = EXCLUDED.owner_address,
       policy_commitment = EXCLUDED.policy_commitment,
       updated_at = NOW();`,
    [
      event.workspaceId,
      event.owner.toLowerCase(),
      event.policyCommitment,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // 3. Record policy version 1 projection
  await tx.query(
    `INSERT INTO projection_policy_versions (
       workspace_id, policy_version, policy_commitment, updated_at_block, updated_at_tx, indexed_at
     ) VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (workspace_id, policy_version)
     DO UPDATE SET policy_commitment = EXCLUDED.policy_commitment;`,
    [
      event.workspaceId,
      1,
      event.policyCommitment,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // 4. Record owner role in projection_role_grants
  const OWNER_ROLE_BYTES =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const GLOBAL_SCOPE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  await tx.query(
    `INSERT INTO projection_role_grants (
       workspace_id, account_address, role, scope, active,
       granted_at_block, granted_at_tx
     ) VALUES ($1, $2, $3, $4, TRUE, $5, $6)
     ON CONFLICT (workspace_id, account_address, role, scope) WHERE active = TRUE
     DO NOTHING;`,
    [
      event.workspaceId,
      event.owner.toLowerCase(),
      OWNER_ROLE_BYTES,
      GLOBAL_SCOPE,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );
}

/**
 * Handles RoleGranted event.
 */
export async function handleRoleGranted(
  tx: DatabaseClient,
  event: RoleGrantedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  await tx.query(
    `INSERT INTO projection_role_grants (
       workspace_id, account_address, role, scope, active,
       granted_at_block, granted_at_tx, revoked_at_block, revoked_at_tx, updated_at
     ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, NULL, NULL, NOW())
     ON CONFLICT (workspace_id, account_address, role, scope) WHERE active = TRUE
     DO NOTHING;`,
    [
      event.workspaceId,
      event.account.toLowerCase(),
      event.role,
      event.scope,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );
}

/**
 * Handles RoleRevoked event.
 */
export async function handleRoleRevoked(
  tx: DatabaseClient,
  event: RoleRevokedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  await tx.query(
    `UPDATE projection_role_grants
     SET active = FALSE,
         revoked_at_block = $1,
         revoked_at_tx = $2,
         updated_at = NOW()
     WHERE workspace_id = $3
       AND LOWER(account_address) = LOWER($4)
       AND role = $5
       AND scope = $6
       AND active = TRUE;`,
    [
      meta.blockNumber.toString(),
      meta.transactionHash,
      event.workspaceId,
      event.account.toLowerCase(),
      event.role,
      event.scope,
    ],
  );

  // Reconcile operational role_grants if row exists
  await tx.query(
    `UPDATE role_grants
     SET revoked_at = NOW()
     WHERE workspace_id = $1
       AND LOWER(address) = LOWER($2)
       AND role = $3
       AND scope = $4
       AND revoked_at IS NULL;`,
    [event.workspaceId, event.account.toLowerCase(), event.role, event.scope],
  );
}

/**
 * Handles PolicyUpdated event.
 */
export async function handlePolicyUpdated(
  tx: DatabaseClient,
  event: PolicyUpdatedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  await tx.query(
    `INSERT INTO projection_policy_versions (
       workspace_id, policy_version, policy_commitment, updated_at_block, updated_at_tx, indexed_at
     ) VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (workspace_id, policy_version)
     DO UPDATE SET policy_commitment = EXCLUDED.policy_commitment;`,
    [
      event.workspaceId,
      event.policyVersion,
      event.policyCommitment,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  await tx.query(
    `UPDATE projection_workspaces
     SET current_policy_version = $1,
         policy_commitment = $2,
         updated_at = NOW()
     WHERE workspace_id = $3;`,
    [event.policyVersion, event.policyCommitment, event.workspaceId],
  );
}

/**
 * Handles ExpenseVersionSubmitted event.
 */
export async function handleExpenseVersionSubmitted(
  tx: DatabaseClient,
  event: ExpenseVersionSubmittedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  // 1. Projection: Expense Versions
  await tx.query(
    `INSERT INTO projection_expense_versions (
       workspace_id, expense_id, version, commitment, submitter,
       is_superseded, submitted_at_block, submitted_at_tx, indexed_at
     ) VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, NOW())
     ON CONFLICT (workspace_id, expense_id, version)
     DO UPDATE SET
       commitment = EXCLUDED.commitment,
       submitter = EXCLUDED.submitter;`,
    [
      event.workspaceId,
      event.expenseId,
      event.version,
      event.commitment,
      event.submitter.toLowerCase(),
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // 2. Projection: Expenses anchor
  await tx.query(
    `INSERT INTO projection_expenses (
       workspace_id, expense_id, current_version, current_commitment,
       latest_submitter, submitted_at_block, submitted_at_tx, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (workspace_id, expense_id)
     DO UPDATE SET
       current_version = GREATEST(projection_expenses.current_version, EXCLUDED.current_version),
       current_commitment = CASE
         WHEN EXCLUDED.current_version >= projection_expenses.current_version THEN EXCLUDED.current_commitment
         ELSE projection_expenses.current_commitment
       END,
       latest_submitter = CASE
         WHEN EXCLUDED.current_version >= projection_expenses.current_version THEN EXCLUDED.latest_submitter
         ELSE projection_expenses.latest_submitter
       END,
       submitted_at_block = CASE
         WHEN EXCLUDED.current_version >= projection_expenses.current_version THEN EXCLUDED.submitted_at_block
         ELSE projection_expenses.submitted_at_block
       END,
       submitted_at_tx = CASE
         WHEN EXCLUDED.current_version >= projection_expenses.current_version THEN EXCLUDED.submitted_at_tx
         ELSE projection_expenses.submitted_at_tx
       END,
       updated_at = NOW();`,
    [
      event.workspaceId,
      event.expenseId,
      event.version,
      event.commitment,
      event.submitter.toLowerCase(),
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // 3. Reconcile operational records if present
  await tx.query(
    `UPDATE expense_versions
     SET status = 'submitted',
         submitted_at = NOW(),
         submitted_by = $1,
         submitted_transaction_hash = $2
     WHERE workspace_id = $3
       AND expense_id = $4
       AND version = $5
       AND status IN ('draft', 'prepared');`,
    [
      event.submitter.toLowerCase(),
      meta.transactionHash,
      event.workspaceId,
      event.expenseId,
      event.version,
    ],
  );

  await tx.query(
    `UPDATE expenses
     SET current_version = $1,
         updated_at = NOW()
     WHERE workspace_id = $2
       AND expense_id = $3;`,
    [event.version, event.workspaceId, event.expenseId],
  );

  await tx.query(
    `UPDATE chain_transactions
     SET status = 'confirmed',
         confirmed_at = NOW(),
         block_number = $1
     WHERE chain_id = $2
       AND LOWER(transaction_hash) = LOWER($3);`,
    [
      meta.blockNumber.toString(),
      meta.chainId.toString(),
      meta.transactionHash,
    ],
  );
}

/**
 * Handles ExpenseVersionSuperseded event.
 */
export async function handleExpenseVersionSuperseded(
  tx: DatabaseClient,
  event: ExpenseVersionSupersededEvent,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  await tx.query(
    `UPDATE projection_expense_versions
     SET is_superseded = TRUE,
         superseded_by_version = $1
     WHERE workspace_id = $2
       AND expense_id = $3
       AND version = $4;`,
    [event.newVersion, event.workspaceId, event.expenseId, event.oldVersion],
  );

  // Reconcile operational expense_versions
  await tx.query(
    `UPDATE expense_versions
     SET status = 'superseded'
     WHERE workspace_id = $1
       AND expense_id = $2
       AND version = $3;`,
    [event.workspaceId, event.expenseId, event.oldVersion],
  );
}

/**
 * Handles DecisionRecorded event.
 */
export async function handleDecisionRecorded(
  tx: DatabaseClient,
  event: DecisionRecordedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

  let decisionTypeStr: "approve" | "reject" | "request_changes";
  switch (event.decision) {
    case OnchainDecision.Approve:
      decisionTypeStr = "approve";
      break;
    case OnchainDecision.Reject:
      decisionTypeStr = "reject";
      break;
    case OnchainDecision.RequestChanges:
      decisionTypeStr = "request_changes";
      break;
    default:
      throw new Error(
        `Unknown onchain decision code: ${String(event.decision)}`,
      );
  }

  const reasonCommitmentVal =
    (event.reasonCommitment as string) ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
      ? null
      : event.reasonCommitment;

  await tx.query(
    `INSERT INTO projection_decisions (
       workspace_id, expense_id, version, commitment, reviewer,
       decision, reason_commitment, recorded_at_block, recorded_at_tx, indexed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (workspace_id, expense_id, version)
     DO UPDATE SET
       reviewer = EXCLUDED.reviewer,
       decision = EXCLUDED.decision,
       reason_commitment = EXCLUDED.reason_commitment;`,
    [
      event.workspaceId,
      event.expenseId,
      event.version,
      event.commitment,
      event.reviewer.toLowerCase(),
      decisionTypeStr,
      reasonCommitmentVal,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // Reconcile operational expense_version status on approval
  if (decisionTypeStr === "approve") {
    await tx.query(
      `UPDATE expense_versions
       SET status = 'current'
       WHERE workspace_id = $1
         AND expense_id = $2
         AND version = $3
         AND status = 'submitted';`,
      [event.workspaceId, event.expenseId, event.version],
    );
  }

  await tx.query(
    `UPDATE chain_transactions
     SET status = 'confirmed',
         confirmed_at = NOW(),
         block_number = $1
     WHERE chain_id = $2
       AND LOWER(transaction_hash) = LOWER($3);`,
    [
      meta.blockNumber.toString(),
      meta.chainId.toString(),
      meta.transactionHash,
    ],
  );
}

/**
 * Handles SettlementRecorded event.
 */
export async function handleSettlementRecorded(
  tx: DatabaseClient,
  event: SettlementRecordedEvent,
  meta: LogMetadata,
): Promise<void> {
  assertPublicProjectionPrivacy(event);

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
      event.workspaceId,
      event.expenseId,
      event.version,
      event.commitment,
      event.token.toLowerCase(),
      event.recipient.toLowerCase(),
      event.amount.toString(),
      event.paymentReference,
      meta.blockNumber.toString(),
      meta.transactionHash,
    ],
  );

  // Reconcile operational reimbursements table
  await tx.query(
    `UPDATE reimbursements
     SET status = 'confirmed',
         settled_at = NOW(),
         transaction_hash = $1,
         updated_at = NOW()
     WHERE workspace_id = $2
       AND expense_id = $3
       AND version = $4;`,
    [meta.transactionHash, event.workspaceId, event.expenseId, event.version],
  );

  await tx.query(
    `UPDATE chain_transactions
     SET status = 'confirmed',
         confirmed_at = NOW(),
         block_number = $1
     WHERE chain_id = $2
       AND LOWER(transaction_hash) = LOWER($3);`,
    [
      meta.blockNumber.toString(),
      meta.chainId.toString(),
      meta.transactionHash,
    ],
  );
}
