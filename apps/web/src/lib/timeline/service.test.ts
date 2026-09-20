import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  TimelineAuthorizationError,
  TimelineNotFoundError,
  TimelineService,
} from "./service";

class MockDatabaseClient implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    created_by: string;
  }> = [];

  roleGrants: Array<{
    workspace_id: string;
    account_address: string;
    role: string;
    revoked_at: Date | string | null;
  }> = [];

  memberships: Array<{
    workspace_id: string;
    account_address: string;
  }> = [];

  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number | null;
    created_at: string;
    updated_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    previous_commitment: string | null;
    amount: string;
    currency: string;
    recipient: string;
    status: string;
    submitted_at: string | null;
    submitted_by: string | null;
    submitted_transaction_hash: string | null;
    created_at: string;
  }> = [];

  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    storage_key: string;
    sha256_hash: string;
    byte_length: number;
    mime_type: string;
    created_at: string;
  }> = [];

  decisions: Array<{
    decision_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    decision_type: string;
    reviewer_address: string;
    reason_commitment: string | null;
    policy_version: number;
    transaction_hash: string | null;
    recorded_at: string;
  }> = [];

  reimbursements: Array<{
    reimbursement_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    token_address: string;
    recipient_address: string;
    amount: string;
    payment_reference: string;
    transaction_hash: string | null;
    status: string;
    settled_at: string | null;
    created_at: string;
  }> = [];

  sourceTransactions: Array<{
    id: string;
    workspace_id: string;
    expense_id: string;
    source_chain_id: string;
    source_transaction_hash: string;
    claim_slot: number;
    provider: string;
    status: string;
    imported_at: string;
  }> = [];

  projExpenses: Array<{
    workspace_id: string;
    expense_id: string;
    current_version: number;
    current_commitment: string;
    latest_submitter: string;
    submitted_at_block: string;
    submitted_at_tx: string;
    updated_at: string;
  }> = [];

  projExpenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    submitter: string;
    is_superseded: boolean;
    superseded_by_version: number | null;
    submitted_at_block: string;
    submitted_at_tx: string;
    indexed_at: string;
  }> = [];

  projDecisions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    reviewer: string;
    decision: string;
    reason_commitment: string | null;
    recorded_at_block: string;
    recorded_at_tx: string;
    indexed_at: string;
  }> = [];

  projSettlements: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    token: string;
    recipient: string;
    amount: string;
    payment_reference: string;
    settled_at_block: string;
    settled_at_tx: string;
    indexed_at: string;
  }> = [];

  chainTransactions: Array<{
    transaction_id: string;
    workspace_id: string;
    chain_id: string;
    transaction_hash: string;
    action: string;
    status: string;
    submitted_at: string;
    confirmed_at: string | null;
    block_number: string | null;
  }> = [];

  indexerCheckpoints: Array<{
    chain_id: string;
    contract_address: string;
    last_indexed_block: string;
    last_indexed_block_hash: string;
  }> = [];

  reorgedEvents: Array<{
    event_id: string;
    workspace_id?: string;
    chain_id: string;
    block_number: string;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    payload: Record<string, unknown>;
    removed: boolean;
    status: string;
    indexed_at: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const normalized = sql.toLowerCase().replace(/\s+/g, " ");

    // Authorization check
    if (
      normalized.includes(
        "from workspaces where workspace_id = $1 and lower(created_by) = lower($2)",
      ) ||
      normalized.includes(
        "from role_grants where workspace_id = $1 and lower(account_address) = lower($2)",
      ) ||
      normalized.includes(
        "from memberships where workspace_id = $1 and lower(account_address) = lower($2)",
      )
    ) {
      const [wId, addr] = params as [string, string];
      const matchOwner = this.workspaces.some(
        (w) =>
          w.workspace_id === wId &&
          w.created_by.toLowerCase() === addr.toLowerCase(),
      );
      const matchRole = this.roleGrants.some(
        (r) =>
          r.workspace_id === wId &&
          r.account_address.toLowerCase() === addr.toLowerCase() &&
          r.revoked_at === null,
      );
      const matchMember = this.memberships.some(
        (m) =>
          m.workspace_id === wId &&
          m.account_address.toLowerCase() === addr.toLowerCase(),
      );

      if (matchOwner || matchRole || matchMember) {
        return { rows: [{ "?column?": 1 } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Expenses query
    if (
      normalized.includes(
        "from expenses where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.expenses.filter(
        (e) => e.workspace_id === wId && e.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Expense versions query
    if (
      normalized.includes(
        "from expense_versions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.expenseVersions
        .filter((ev) => ev.workspace_id === wId && ev.expense_id === eId)
        .sort((a, b) => a.version - b.version);
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Evidence objects query
    if (
      normalized.includes(
        "from evidence_objects where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.evidenceObjects.filter(
        (ev) => ev.workspace_id === wId && ev.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Decisions query
    if (
      normalized.includes(
        "from decisions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.decisions.filter(
        (d) => d.workspace_id === wId && d.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Reimbursements query
    if (
      normalized.includes(
        "from reimbursements where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.reimbursements.filter(
        (r) => r.workspace_id === wId && r.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Source transactions query
    if (
      normalized.includes(
        "from source_transactions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.sourceTransactions.filter(
        (st) => st.workspace_id === wId && st.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Projection expenses query
    if (
      normalized.includes(
        "from projection_expenses where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.projExpenses.filter(
        (pe) => pe.workspace_id === wId && pe.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Projection expense versions query
    if (
      normalized.includes(
        "from projection_expense_versions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.projExpenseVersions.filter(
        (pev) => pev.workspace_id === wId && pev.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Projection decisions query
    if (
      normalized.includes(
        "from projection_decisions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.projDecisions.filter(
        (pd) => pd.workspace_id === wId && pd.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Projection settlements query
    if (
      normalized.includes(
        "from projection_settlements where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.projSettlements.filter(
        (ps) => ps.workspace_id === wId && ps.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Chain transactions query
    if (
      normalized.includes("from chain_transactions where workspace_id = $1")
    ) {
      const [wId] = params as [string];
      const matches = this.chainTransactions.filter(
        (ctx) => ctx.workspace_id === wId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Indexer checkpoints query
    if (normalized.includes("from indexer_checkpoints")) {
      return {
        rows: this.indexerCheckpoints as unknown as T[],
        rowCount: this.indexerCheckpoints.length,
      };
    }

    // Reorged events query
    if (
      normalized.includes(
        "from indexed_events where workspace_id = $1 and (removed = true or status = 'reorged')",
      )
    ) {
      const [wId] = params as [string];
      const matches = this.reorgedEvents.filter(
        (re) => re.workspace_id === wId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("TimelineService (IDX-002)", () => {
  let db: MockDatabaseClient;
  let service: TimelineService;

  const TEST_WORKSPACE =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const TEST_EXPENSE =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const OWNER_ADDR = "0x1111111111111111111111111111111111111111";
  const APPROVER_ADDR = "0x2222222222222222222222222222222222222222";
  const STRANGER_ADDR = "0x9999999999999999999999999999999999999999";

  beforeEach(() => {
    db = new MockDatabaseClient();
    service = new TimelineService(db);

    db.workspaces.push({
      workspace_id: TEST_WORKSPACE,
      created_by: OWNER_ADDR,
    });

    db.roleGrants.push({
      workspace_id: TEST_WORKSPACE,
      account_address: APPROVER_ADDR,
      role: "0x863de4094a971849a6201b1b13190875a5966373b50c5ce6007e2b172a0fc7a2", // APPROVER_ROLE
      revoked_at: null,
    });
  });

  it("rejects unauthorized callers with TimelineAuthorizationError", async () => {
    await expect(
      service.getExpenseTimeline(TEST_WORKSPACE, TEST_EXPENSE, {
        userId: "stranger-1",
        address: STRANGER_ADDR,
      }),
    ).rejects.toThrow(TimelineAuthorizationError);
  });

  it("throws TimelineNotFoundError if expense does not exist", async () => {
    await expect(
      service.getExpenseTimeline(TEST_WORKSPACE, TEST_EXPENSE, {
        userId: "owner-1",
        address: OWNER_ADDR,
      }),
    ).rejects.toThrow(TimelineNotFoundError);
  });

  it("reconstructs end-to-end multi-version lifecycle with public/private join", async () => {
    // 1. Setup expense
    db.expenses.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      created_by: OWNER_ADDR,
      current_version: 2,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T11:00:00.000Z",
    });

    // 2. Setup Version 1 (submitted, changes requested)
    db.expenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      commitment:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      previous_commitment: null,
      amount: "1000000",
      currency: "USDC",
      recipient: OWNER_ADDR,
      status: "superseded",
      submitted_at: "2026-09-17T10:05:00.000Z",
      submitted_by: OWNER_ADDR,
      submitted_transaction_hash: "0xaaa111",
      created_at: "2026-09-17T10:00:00.000Z",
    });

    db.evidenceObjects.push({
      evidence_id: "ev-1",
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      storage_key: "evidence/ev-1.pdf",
      sha256_hash: "0xee1111",
      byte_length: 2048,
      mime_type: "application/pdf",
      created_at: "2026-09-17T10:02:00.000Z",
    });

    db.projExpenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      commitment:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      submitter: OWNER_ADDR,
      is_superseded: true,
      superseded_by_version: 2,
      submitted_at_block: "100",
      submitted_at_tx: "0xaaa111",
      indexed_at: "2026-09-17T10:06:00.000Z",
    });

    db.decisions.push({
      decision_id: "dec-1",
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      commitment:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      decision_type: "request_changes",
      reviewer_address: APPROVER_ADDR,
      reason_commitment: "0xreason1",
      policy_version: 1,
      transaction_hash: "0xdec111",
      recorded_at: "2026-09-17T10:15:00.000Z",
    });

    // 3. Setup Version 2 (submitted, approved, settled)
    db.expenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      previous_commitment:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      amount: "1500000",
      currency: "USDC",
      recipient: OWNER_ADDR,
      status: "reimbursed",
      submitted_at: "2026-09-17T10:30:00.000Z",
      submitted_by: OWNER_ADDR,
      submitted_transaction_hash: "0xaaa222",
      created_at: "2026-09-17T10:20:00.000Z",
    });

    db.projExpenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      submitter: OWNER_ADDR,
      is_superseded: false,
      superseded_by_version: null,
      submitted_at_block: "150",
      submitted_at_tx: "0xaaa222",
      indexed_at: "2026-09-17T10:31:00.000Z",
    });

    db.decisions.push({
      decision_id: "dec-2",
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      decision_type: "approve",
      reviewer_address: APPROVER_ADDR,
      reason_commitment: null,
      policy_version: 1,
      transaction_hash: "0xdec222",
      recorded_at: "2026-09-17T10:45:00.000Z",
    });

    db.projDecisions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      reviewer: APPROVER_ADDR,
      decision: "approve",
      reason_commitment: null,
      recorded_at_block: "160",
      recorded_at_tx: "0xdec222",
      indexed_at: "2026-09-17T10:46:00.000Z",
    });

    db.reimbursements.push({
      reimbursement_id: "reimb-1",
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      token_address: "0xusdc",
      recipient_address: OWNER_ADDR,
      amount: "1500000",
      payment_reference: "0xpayref222",
      transaction_hash: "0xsettle222",
      status: "settled",
      settled_at: "2026-09-17T11:00:00.000Z",
      created_at: "2026-09-17T10:50:00.000Z",
    });

    db.projSettlements.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      token: "0xusdc",
      recipient: OWNER_ADDR,
      amount: "1500000",
      payment_reference: "0xpayref222",
      settled_at_block: "180",
      settled_at_tx: "0xsettle222",
      indexed_at: "2026-09-17T11:01:00.000Z",
    });

    // Checkpoint
    db.indexerCheckpoints.push({
      chain_id: "31337",
      contract_address: "0xregistry",
      last_indexed_block: "200",
      last_indexed_block_hash: "0xblock200",
    });

    const result = await service.getExpenseTimeline(
      TEST_WORKSPACE,
      TEST_EXPENSE,
      {
        userId: "approver-1",
        address: APPROVER_ADDR,
      },
    );

    expect(result.expenseId).toBe(TEST_EXPENSE);
    expect(result.currentVersion).toBe(2);
    expect(result.events.length).toBeGreaterThan(5);

    // Verify historical supersession branching
    const v1Events = result.events.filter((e) => e.version === 1);
    for (const ev of v1Events) {
      expect(ev.isSupersededBranch).toBe(true);
      expect(ev.isCurrentVersion).toBe(false);
      expect(ev.branchId).toBe("v1");
    }

    // Verify current version events
    const v2Events = result.events.filter((e) => e.version === 2);
    for (const ev of v2Events) {
      expect(ev.isSupersededBranch).toBe(false);
      expect(ev.isCurrentVersion).toBe(true);
      expect(ev.branchId).toBe("v2");
    }

    // Verify timestamp taxonomy is clearly distinguished
    const submittedV2 = result.events.find(
      (e) => e.type === "version_submitted" && e.version === 2,
    );
    expect(submittedV2).toBeDefined();
    expect(submittedV2?.timestamp.primaryType).toBe("block");
    expect(submittedV2?.timestamp.applicationTime).toBe(
      "2026-09-17T10:30:00.000Z",
    );
    expect(submittedV2?.timestamp.blockTime).toBe("2026-09-17T10:30:00.000Z");
    expect(submittedV2?.timestamp.indexerTime).toBe("2026-09-17T10:31:00.000Z");

    // Verify settlement event
    const settlementEvent = result.events.find(
      (e) => e.type === "settlement_confirmed",
    );
    expect(settlementEvent).toBeDefined();
    expect(settlementEvent?.blockNumber).toBe(180);
    expect(settlementEvent?.txHash).toBe("0xsettle222");

    // Verify indexer is synchronized
    expect(result.indexerLag.isLagging).toBe(false);
    expect(result.rpcConflict.hasConflict).toBe(false);
  });

  it("detects indexer lag when confirmed onchain block exceeds indexer checkpoint", async () => {
    db.expenses.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      created_by: OWNER_ADDR,
      current_version: 1,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T10:00:00.000Z",
    });

    db.expenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      commitment: "0x111",
      previous_commitment: null,
      amount: "100",
      currency: "USDC",
      recipient: OWNER_ADDR,
      status: "submitted",
      submitted_at: "2026-09-17T10:05:00.000Z",
      submitted_by: OWNER_ADDR,
      submitted_transaction_hash: "0xlate_tx",
      created_at: "2026-09-17T10:00:00.000Z",
    });

    // Onchain transaction is confirmed at block 500
    db.chainTransactions.push({
      transaction_id: "ctx-1",
      workspace_id: TEST_WORKSPACE,
      chain_id: "31337",
      transaction_hash: "0xlate_tx",
      action: "submitVersion",
      status: "confirmed",
      submitted_at: "2026-09-17T10:05:00.000Z",
      confirmed_at: "2026-09-17T10:05:30.000Z",
      block_number: "500",
    });

    // But indexer checkpoint is trailing at block 480
    db.indexerCheckpoints.push({
      chain_id: "31337",
      contract_address: "0xregistry",
      last_indexed_block: "480",
      last_indexed_block_hash: "0xblock480",
    });

    const result = await service.getExpenseTimeline(
      TEST_WORKSPACE,
      TEST_EXPENSE,
      {
        userId: "owner-1",
        address: OWNER_ADDR,
      },
    );

    expect(result.indexerLag.isLagging).toBe(true);
    expect(result.indexerLag.lagBlocks).toBe(20);
    expect(result.indexerLag.latestKnownBlock).toBe(500);
    expect(result.indexerLag.indexedCheckpointBlock).toBe(480);
  });

  it("detects chain reorgs and removed events", async () => {
    db.expenses.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      created_by: OWNER_ADDR,
      current_version: 1,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T10:00:00.000Z",
    });

    db.reorgedEvents.push({
      event_id: "reorg-event-1",
      workspace_id: TEST_WORKSPACE,
      chain_id: "31337",
      block_number: "300",
      block_hash: "0xreorgblock",
      transaction_hash: "0xreorgtx",
      log_index: 2,
      event_name: "DecisionRecorded",
      payload: {},
      removed: true,
      status: "reorged",
      indexed_at: "2026-09-17T10:25:00.000Z",
    });

    const result = await service.getExpenseTimeline(
      TEST_WORKSPACE,
      TEST_EXPENSE,
      {
        userId: "owner-1",
        address: OWNER_ADDR,
      },
    );

    expect(result.rpcConflict.hasConflict).toBe(true);
    expect(result.rpcConflict.conflictType).toBe("reorg_detected");

    const reorgEvent = result.events.find(
      (e) => e.type === "transaction_reorged",
    );
    expect(reorgEvent).toBeDefined();
    expect(reorgEvent?.confirmationState).toBe("reorged");
  });

  it("is idempotent and deterministically ordered on refresh", async () => {
    db.expenses.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      created_by: OWNER_ADDR,
      current_version: 1,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T10:00:00.000Z",
    });

    db.expenseVersions.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      version: 1,
      commitment: "0x111",
      previous_commitment: null,
      amount: "100",
      currency: "USDC",
      recipient: OWNER_ADDR,
      status: "submitted",
      submitted_at: "2026-09-17T10:05:00.000Z",
      submitted_by: OWNER_ADDR,
      submitted_transaction_hash: "0xtx1",
      created_at: "2026-09-17T10:00:00.000Z",
    });

    const run1 = await service.getExpenseTimeline(
      TEST_WORKSPACE,
      TEST_EXPENSE,
      {
        userId: "owner-1",
        address: OWNER_ADDR,
      },
    );

    const run2 = await service.getExpenseTimeline(
      TEST_WORKSPACE,
      TEST_EXPENSE,
      {
        userId: "owner-1",
        address: OWNER_ADDR,
      },
    );

    expect(run1.events.length).toBe(run2.events.length);
    for (let i = 0; i < run1.events.length; i++) {
      expect(run1.events[i]?.id).toBe(run2.events[i]?.id);
      expect(run1.events[i]?.timestamp.primary).toBe(
        run2.events[i]?.timestamp.primary,
      );
      expect(run1.events[i]?.type).toBe(run2.events[i]?.type);
    }
  });
});
