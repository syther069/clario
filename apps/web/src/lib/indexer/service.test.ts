import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  OnchainDecision,
  parseBytes32,
  parseCommitmentHash,
  parseEvmAddress,
  parseExpenseId,
  parseExpenseVersion,
  parsePaymentReference,
  parsePolicyCommitment,
  parsePolicyVersion,
  parseWorkspaceId,
  type DecisionRecordedEvent,
  type ExpenseVersionSubmittedEvent,
  type ExpenseVersionSupersededEvent,
  type PolicyUpdatedEvent,
  type RoleGrantedEvent,
  type RoleRevokedEvent,
  type SettlementRecordedEvent,
  type WorkspaceCreatedEvent,
} from "@clario/protocol";
import {
  assertPublicProjectionPrivacy,
  ProjectionPrivacyViolationError,
} from "./privacy";
import { EventIndexerService } from "./service";
import type { LogMetadata } from "./types";

const TEST_CHAIN_ID = 31337n;
const TEST_REGISTRY_ADDRESS = parseEvmAddress(
  "0x1111111111111111111111111111111111111111",
);
const TEST_WORKSPACE_ID = parseWorkspaceId(
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
const TEST_EXPENSE_ID = parseExpenseId(
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
);
const TEST_COMMITMENT_V1 = parseCommitmentHash(
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
);
const TEST_COMMITMENT_V2 = parseCommitmentHash(
  "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);
const TEST_OWNER = parseEvmAddress(
  "0x2222222222222222222222222222222222222222",
);
const TEST_REVIEWER = parseEvmAddress(
  "0x3333333333333333333333333333333333333333",
);
const TEST_SUBMITTER = parseEvmAddress(
  "0x4444444444444444444444444444444444444444",
);
const TEST_RECIPIENT = parseEvmAddress(
  "0x5555555555555555555555555555555555555555",
);
const TEST_TOKEN = parseEvmAddress(
  "0x6666666666666666666666666666666666666666",
);
const TEST_POLICY_COMMITMENT = parsePolicyCommitment(
  "0x7777777777777777777777777777777777777777777777777777777777777777",
);

class MockDatabase implements DatabaseClient {
  indexedEvents: Array<{
    event_id: string;
    chain_id: string;
    block_number: string;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    contract_address: string;
    workspace_id: string | null;
    payload: Record<string, unknown>;
    removed: boolean;
    status: string;
  }> = [];

  checkpoints: Array<{
    chain_id: string;
    contract_address: string;
    last_indexed_block: string;
    last_indexed_block_hash: string;
    updated_at: Date;
  }> = [];

  deadLetters: Array<{
    dead_letter_id: string;
    chain_id: string;
    block_number: string;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    contract_address: string;
    payload: Record<string, unknown>;
    error_message: string;
    attempts: number;
    created_at: Date;
    resolved_at: Date | null;
  }> = [];

  projectionWorkspaces: Array<{
    workspace_id: string;
    owner_address: string;
    policy_commitment: string;
    current_policy_version: number;
    created_at_block: string;
    created_at_tx: string;
    updated_at: Date;
  }> = [];

  projectionRoleGrants: Array<{
    grant_id: string;
    workspace_id: string;
    account_address: string;
    role: string;
    scope: string;
    active: boolean;
    granted_at_block: string;
    granted_at_tx: string;
    revoked_at_block: string | null;
    revoked_at_tx: string | null;
    updated_at: Date;
  }> = [];

  projectionPolicyVersions: Array<{
    workspace_id: string;
    policy_version: number;
    policy_commitment: string;
    updated_at_block: string;
    updated_at_tx: string;
    indexed_at: Date;
  }> = [];

  projectionExpenses: Array<{
    workspace_id: string;
    expense_id: string;
    current_version: number;
    current_commitment: string;
    latest_submitter: string;
    submitted_at_block: string;
    submitted_at_tx: string;
    updated_at: Date;
  }> = [];

  projectionExpenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    submitter: string;
    is_superseded: boolean;
    superseded_by_version: number | null;
    submitted_at_block: string;
    submitted_at_tx: string;
    indexed_at: Date;
  }> = [];

  projectionDecisions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    reviewer: string;
    decision: "approve" | "reject" | "request_changes";
    reason_commitment: string | null;
    recorded_at_block: string;
    recorded_at_tx: string;
    indexed_at: Date;
  }> = [];

  projectionSettlements: Array<{
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
    indexed_at: Date;
  }> = [];

  workspaces: Array<{
    workspace_id: string;
    name: string;
    created_by: string;
  }> = [];
  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
  }> = [];
  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    current_version: number;
  }> = [];
  chainTransactions: Array<{
    chain_id: string;
    transaction_hash: string;
    status: string;
  }> = [];
  reimbursements: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
  }> = [];

  failNextHandler = false;

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim().toUpperCase();

    // 1. SELECT indexed_events
    if (s.startsWith("SELECT EVENT_ID, REMOVED, STATUS FROM INDEXED_EVENTS")) {
      const chainId = String(params[0]);
      const txHash = String(params[1]);
      const logIdx = Number(params[2]);
      const match = this.indexedEvents.find(
        (e) =>
          e.chain_id === chainId &&
          e.transaction_hash.toLowerCase() === txHash.toLowerCase() &&
          e.log_index === logIdx,
      );
      if (match) {
        return {
          rows: [
            {
              event_id: match.event_id,
              removed: match.removed,
              status: match.status,
            } as T,
          ],
        };
      }
      return { rows: [] };
    }

    // 2. INSERT INTO indexed_events
    if (s.startsWith("INSERT INTO INDEXED_EVENTS")) {
      if (this.failNextHandler) {
        throw new Error("Simulated database failure during event ingestion");
      }
      const chainId = String(params[0]);
      const blockNum = String(params[1]);
      const blockHash = String(params[2]);
      const txHash = String(params[3]);
      const logIdx = Number(params[4]);
      const eventName = String(params[5]);
      const contract = String(params[6]);
      const wsId = params[7] ? String(params[7]) : null;
      const payload = JSON.parse(String(params[8])) as Record<string, unknown>;

      const existingIdx = this.indexedEvents.findIndex(
        (e) =>
          e.chain_id === chainId &&
          e.transaction_hash.toLowerCase() === txHash.toLowerCase() &&
          e.log_index === logIdx,
      );

      const eventId = "ev_" + (this.indexedEvents.length + 1);
      const row = {
        event_id: eventId,
        chain_id: chainId,
        block_number: blockNum,
        block_hash: blockHash,
        transaction_hash: txHash,
        log_index: logIdx,
        event_name: eventName,
        contract_address: contract,
        workspace_id: wsId,
        payload,
        removed: false,
        status: "confirmed",
      };

      if (existingIdx >= 0) {
        this.indexedEvents[existingIdx] = row;
      } else {
        this.indexedEvents.push(row);
      }

      return { rows: [{ event_id: eventId } as T] };
    }

    // 3. Checkpoints
    if (s.startsWith("SELECT CHAIN_ID, CONTRACT_ADDRESS, LAST_INDEXED_BLOCK")) {
      const chainId = String(params[0]);
      const contract = String(params[1]).toLowerCase();
      const match = this.checkpoints.find(
        (c) =>
          c.chain_id === chainId &&
          c.contract_address.toLowerCase() === contract,
      );
      if (match) {
        return {
          rows: [
            {
              chain_id: match.chain_id,
              contract_address: match.contract_address,
              last_indexed_block: match.last_indexed_block,
              last_indexed_block_hash: match.last_indexed_block_hash,
              updated_at: match.updated_at,
            } as T,
          ],
        };
      }
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO INDEXER_CHECKPOINTS")) {
      const chainId = String(params[0]);
      const contract = String(params[1]).toLowerCase();
      const block = String(params[2]);
      const hash = String(params[3]);

      const idx = this.checkpoints.findIndex(
        (c) =>
          c.chain_id === chainId &&
          c.contract_address.toLowerCase() === contract,
      );
      if (idx >= 0) {
        this.checkpoints[idx]!.last_indexed_block = block;
        this.checkpoints[idx]!.last_indexed_block_hash = hash;
        this.checkpoints[idx]!.updated_at = new Date();
      } else {
        this.checkpoints.push({
          chain_id: chainId,
          contract_address: contract,
          last_indexed_block: block,
          last_indexed_block_hash: hash,
          updated_at: new Date(),
        });
      }
      return { rows: [] };
    }

    // 4. Dead Letters
    if (s.startsWith("INSERT INTO INDEXER_DEAD_LETTERS")) {
      const deadLetterId = "dl_" + (this.deadLetters.length + 1);
      this.deadLetters.push({
        dead_letter_id: deadLetterId,
        chain_id: String(params[0]),
        block_number: String(params[1]),
        block_hash: String(params[2]),
        transaction_hash: String(params[3]),
        log_index: Number(params[4]),
        event_name: String(params[5]),
        contract_address: String(params[6]),
        payload: JSON.parse(String(params[7])) as Record<string, unknown>,
        error_message: String(params[8]),
        attempts: Number(params[9]),
        created_at: new Date(),
        resolved_at: null,
      });
      return { rows: [{ dead_letter_id: deadLetterId } as T] };
    }

    // 5. Handlers Projections
    // WorkspaceCreated
    if (s.startsWith("INSERT INTO WORKSPACES")) {
      this.workspaces.push({
        workspace_id: String(params[0]),
        name: String(params[1]),
        created_by: String(params[2]),
      });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO PROJECTION_WORKSPACES")) {
      this.projectionWorkspaces.push({
        workspace_id: String(params[0]),
        owner_address: String(params[1]),
        policy_commitment: String(params[2]),
        current_policy_version: 1,
        created_at_block: String(params[3]),
        created_at_tx: String(params[4]),
        updated_at: new Date(),
      });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO PROJECTION_POLICY_VERSIONS")) {
      this.projectionPolicyVersions.push({
        workspace_id: String(params[0]),
        policy_version: Number(params[1]),
        policy_commitment: String(params[2]),
        updated_at_block: String(params[3]),
        updated_at_tx: String(params[4]),
        indexed_at: new Date(),
      });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO PROJECTION_ROLE_GRANTS")) {
      this.projectionRoleGrants.push({
        grant_id: "grant_" + (this.projectionRoleGrants.length + 1),
        workspace_id: String(params[0]),
        account_address: String(params[1]),
        role: String(params[2]),
        scope: String(params[3]),
        active: true,
        granted_at_block: String(params[4]),
        granted_at_tx: String(params[5]),
        revoked_at_block: null,
        revoked_at_tx: null,
        updated_at: new Date(),
      });
      return { rows: [] };
    }

    if (s.startsWith("UPDATE PROJECTION_ROLE_GRANTS")) {
      const revBlock = String(params[0]);
      const revTx = String(params[1]);
      const wsId = String(params[2]);
      const acct = String(params[3]).toLowerCase();
      const role = String(params[4]);
      const scope = String(params[5]);

      for (const g of this.projectionRoleGrants) {
        if (
          g.workspace_id === wsId &&
          g.account_address.toLowerCase() === acct &&
          g.role === role &&
          g.scope === scope &&
          g.active
        ) {
          g.active = false;
          g.revoked_at_block = revBlock;
          g.revoked_at_tx = revTx;
          g.updated_at = new Date();
        }
      }
      return { rows: [] };
    }

    if (s.startsWith("UPDATE PROJECTION_WORKSPACES")) {
      const polVer = Number(params[0]);
      const polComm = String(params[1]);
      const wsId = String(params[2]);
      const match = this.projectionWorkspaces.find(
        (w) => w.workspace_id === wsId,
      );
      if (match) {
        match.current_policy_version = polVer;
        match.policy_commitment = polComm;
        match.updated_at = new Date();
      }
      return { rows: [] };
    }

    // ExpenseVersionSubmitted
    if (s.startsWith("INSERT INTO PROJECTION_EXPENSE_VERSIONS")) {
      this.projectionExpenseVersions.push({
        workspace_id: String(params[0]),
        expense_id: String(params[1]),
        version: Number(params[2]),
        commitment: String(params[3]),
        submitter: String(params[4]),
        is_superseded: false,
        superseded_by_version: null,
        submitted_at_block: String(params[5]),
        submitted_at_tx: String(params[6]),
        indexed_at: new Date(),
      });
      return { rows: [] };
    }

    if (s.startsWith("INSERT INTO PROJECTION_EXPENSES")) {
      const wsId = String(params[0]);
      const expId = String(params[1]);
      const ver = Number(params[2]);
      const comm = String(params[3]);
      const sub = String(params[4]);
      const bNum = String(params[5]);
      const tx = String(params[6]);

      const match = this.projectionExpenses.find(
        (e) => e.workspace_id === wsId && e.expense_id === expId,
      );
      if (match) {
        if (ver >= match.current_version) {
          match.current_version = ver;
          match.current_commitment = comm;
          match.latest_submitter = sub;
          match.submitted_at_block = bNum;
          match.submitted_at_tx = tx;
          match.updated_at = new Date();
        }
      } else {
        this.projectionExpenses.push({
          workspace_id: wsId,
          expense_id: expId,
          current_version: ver,
          current_commitment: comm,
          latest_submitter: sub,
          submitted_at_block: bNum,
          submitted_at_tx: tx,
          updated_at: new Date(),
        });
      }
      return { rows: [] };
    }

    // ExpenseVersionSuperseded
    if (s.startsWith("UPDATE PROJECTION_EXPENSE_VERSIONS")) {
      const newVer = Number(params[0]);
      const wsId = String(params[1]);
      const expId = String(params[2]);
      const oldVer = Number(params[3]);

      const match = this.projectionExpenseVersions.find(
        (ev) =>
          ev.workspace_id === wsId &&
          ev.expense_id === expId &&
          ev.version === oldVer,
      );
      if (match) {
        match.is_superseded = true;
        match.superseded_by_version = newVer;
      }
      return { rows: [] };
    }

    // DecisionRecorded
    if (s.startsWith("INSERT INTO PROJECTION_DECISIONS")) {
      this.projectionDecisions.push({
        workspace_id: String(params[0]),
        expense_id: String(params[1]),
        version: Number(params[2]),
        commitment: String(params[3]),
        reviewer: String(params[4]),
        decision: params[5] as "approve" | "reject" | "request_changes",
        reason_commitment: params[6] ? String(params[6]) : null,
        recorded_at_block: String(params[7]),
        recorded_at_tx: String(params[8]),
        indexed_at: new Date(),
      });
      return { rows: [] };
    }

    // SettlementRecorded
    if (s.startsWith("INSERT INTO PROJECTION_SETTLEMENTS")) {
      this.projectionSettlements.push({
        workspace_id: String(params[0]),
        expense_id: String(params[1]),
        version: Number(params[2]),
        commitment: String(params[3]),
        token: String(params[4]),
        recipient: String(params[5]),
        amount: String(params[6]),
        payment_reference: String(params[7]),
        settled_at_block: String(params[8]),
        settled_at_tx: String(params[9]),
        indexed_at: new Date(),
      });
      return { rows: [] };
    }

    // Replay: SELECT from indexed_events in chronological order
    if (
      s.includes("FROM INDEXED_EVENTS") &&
      s.includes("ORDER BY BLOCK_NUMBER ASC, LOG_INDEX ASC")
    ) {
      const chainId = String(params[0]);
      const fromBlock = BigInt(String(params[1]));

      const validEvents = this.indexedEvents
        .filter(
          (e) =>
            e.chain_id === chainId &&
            BigInt(e.block_number) >= fromBlock &&
            !e.removed,
        )
        .sort((a, b) => {
          const blockDiff = Number(
            BigInt(a.block_number) - BigInt(b.block_number),
          );
          if (blockDiff !== 0) return blockDiff;
          return a.log_index - b.log_index;
        });

      return {
        rows: validEvents.map((e) => ({
          event_name: e.event_name,
          contract_address: e.contract_address,
          block_number: e.block_number,
          block_hash: e.block_hash,
          transaction_hash: e.transaction_hash,
          log_index: e.log_index,
          payload: e.payload,
        })) as T[],
      };
    }

    // Deletes during replay (full table clear without WHERE clause)
    if (s.startsWith("DELETE FROM PROJECTION_") && !s.includes("WHERE")) {
      if (s.includes("PROJECTION_SETTLEMENTS")) this.projectionSettlements = [];
      if (s.includes("PROJECTION_DECISIONS")) this.projectionDecisions = [];
      if (s.includes("PROJECTION_EXPENSE_VERSIONS"))
        this.projectionExpenseVersions = [];
      if (s.includes("PROJECTION_EXPENSES")) this.projectionExpenses = [];
      if (s.includes("PROJECTION_POLICY_VERSIONS")) {
        this.projectionPolicyVersions = this.projectionPolicyVersions.filter(
          (p) => p.policy_version === 1,
        );
      }
      if (s.includes("PROJECTION_ROLE_GRANTS")) this.projectionRoleGrants = [];
      if (s.includes("PROJECTION_WORKSPACES")) this.projectionWorkspaces = [];
      return { rows: [] };
    }

    // Reorg rollback
    if (
      s.startsWith(
        "SELECT WORKSPACE_ID, TRANSACTION_HASH, LOG_INDEX, EVENT_NAME FROM INDEXED_EVENTS",
      )
    ) {
      const chainId = String(params[0]);
      const fromBlock = BigInt(String(params[1]));
      const matches = this.indexedEvents.filter(
        (e) =>
          e.chain_id === chainId &&
          BigInt(e.block_number) >= fromBlock &&
          !e.removed,
      );
      return {
        rows: matches.map((m) => ({
          workspace_id: m.workspace_id,
          transaction_hash: m.transaction_hash,
          log_index: m.log_index,
          event_name: m.event_name,
        })) as T[],
      };
    }

    if (
      s.startsWith(
        "UPDATE INDEXED_EVENTS SET REMOVED = TRUE, STATUS = 'REORGED'",
      )
    ) {
      const chainId = String(params[0]);
      const fromBlock = BigInt(String(params[1]));
      for (const e of this.indexedEvents) {
        if (
          e.chain_id === chainId &&
          BigInt(e.block_number) >= fromBlock &&
          !e.removed
        ) {
          e.removed = true;
          e.status = "reorged";
        }
      }
      return { rows: [] };
    }

    if (
      s.startsWith(
        "DELETE FROM PROJECTION_DECISIONS WHERE RECORDED_AT_BLOCK >=",
      )
    ) {
      const fromBlock = BigInt(String(params[0]));
      this.projectionDecisions = this.projectionDecisions.filter(
        (d) => BigInt(d.recorded_at_block) < fromBlock,
      );
      return { rows: [] };
    }

    if (
      s.startsWith(
        "DELETE FROM PROJECTION_SETTLEMENTS WHERE SETTLED_AT_BLOCK >=",
      )
    ) {
      const fromBlock = BigInt(String(params[0]));
      this.projectionSettlements = this.projectionSettlements.filter(
        (s) => BigInt(s.settled_at_block) < fromBlock,
      );
      return { rows: [] };
    }

    if (
      s.startsWith(
        "DELETE FROM PROJECTION_EXPENSE_VERSIONS WHERE SUBMITTED_AT_BLOCK >=",
      )
    ) {
      const fromBlock = BigInt(String(params[0]));
      this.projectionExpenseVersions = this.projectionExpenseVersions.filter(
        (ev) => BigInt(ev.submitted_at_block) < fromBlock,
      );
      return { rows: [] };
    }

    // Replay counts
    if (s.startsWith("SELECT COUNT(*) AS COUNT FROM PROJECTION_")) {
      let count = 0;
      if (s.includes("PROJECTION_WORKSPACES"))
        count = this.projectionWorkspaces.length;
      if (s.includes("PROJECTION_ROLE_GRANTS"))
        count = this.projectionRoleGrants.length;
      if (s.includes("PROJECTION_POLICY_VERSIONS"))
        count = this.projectionPolicyVersions.length;
      if (s.includes("PROJECTION_EXPENSES"))
        count = this.projectionExpenses.length;
      if (s.includes("PROJECTION_EXPENSE_VERSIONS"))
        count = this.projectionExpenseVersions.length;
      if (s.includes("PROJECTION_DECISIONS"))
        count = this.projectionDecisions.length;
      if (s.includes("PROJECTION_SETTLEMENTS"))
        count = this.projectionSettlements.length;
      return { rows: [{ count }] as T[] };
    }

    // Projection query getters
    if (s.startsWith("SELECT WORKSPACE_ID, OWNER_ADDRESS")) {
      const wsId = String(params[0]);
      const match = this.projectionWorkspaces.find(
        (w) => w.workspace_id === wsId,
      );
      return { rows: match ? [match as T] : [] };
    }

    if (s.startsWith("SELECT GRANT_ID, WORKSPACE_ID, ACCOUNT_ADDRESS")) {
      const wsId = String(params[0]);
      const matches = this.projectionRoleGrants.filter(
        (g) => g.workspace_id === wsId,
      );
      return { rows: matches as T[] };
    }

    if (s.startsWith("SELECT WORKSPACE_ID, POLICY_VERSION")) {
      const wsId = String(params[0]);
      const matches = this.projectionPolicyVersions.filter(
        (p) => p.workspace_id === wsId,
      );
      return { rows: matches as T[] };
    }

    if (s.startsWith("SELECT WORKSPACE_ID, EXPENSE_ID, CURRENT_VERSION")) {
      const wsId = String(params[0]);
      const expId = String(params[1]);
      const match = this.projectionExpenses.find(
        (e) => e.workspace_id === wsId && e.expense_id === expId,
      );
      return { rows: match ? [match as T] : [] };
    }

    if (
      s.startsWith(
        "SELECT WORKSPACE_ID, EXPENSE_ID, VERSION, COMMITMENT, SUBMITTER",
      )
    ) {
      const wsId = String(params[0]);
      const expId = String(params[1]);
      const ver = Number(params[2]);
      const match = this.projectionExpenseVersions.find(
        (ev) =>
          ev.workspace_id === wsId &&
          ev.expense_id === expId &&
          ev.version === ver,
      );
      return { rows: match ? [match as T] : [] };
    }

    if (
      s.startsWith(
        "SELECT WORKSPACE_ID, EXPENSE_ID, VERSION, COMMITMENT, REVIEWER",
      )
    ) {
      const wsId = String(params[0]);
      const expId = String(params[1]);
      const ver = Number(params[2]);
      const match = this.projectionDecisions.find(
        (d) =>
          d.workspace_id === wsId &&
          d.expense_id === expId &&
          d.version === ver,
      );
      return { rows: match ? [match as T] : [] };
    }

    if (
      s.startsWith(
        "SELECT WORKSPACE_ID, EXPENSE_ID, VERSION, COMMITMENT, TOKEN",
      )
    ) {
      const wsId = String(params[0]);
      const expId = String(params[1]);
      const ver = Number(params[2]);
      const match = this.projectionSettlements.find(
        (s) =>
          s.workspace_id === wsId &&
          s.expense_id === expId &&
          s.version === ver,
      );
      return { rows: match ? [match as T] : [] };
    }

    // Default / no-op
    return { rows: [] };
  }
}

describe("IDX-001 — Idempotent Event Indexing and Projections Suite", () => {
  let db: MockDatabase;
  let indexer: EventIndexerService;

  beforeEach(() => {
    db = new MockDatabase();
    indexer = new EventIndexerService(db);
  });

  function makeMeta(
    blockNumber: bigint,
    txHash: string,
    logIndex: number,
  ): LogMetadata {
    return {
      chainId: TEST_CHAIN_ID,
      contractAddress: TEST_REGISTRY_ADDRESS,
      blockNumber,
      blockHash: parseBytes32(
        "0x1000000000000000000000000000000000000000000000000000000000000000",
      ),
      transactionHash: parseBytes32(txHash),
      logIndex,
    };
  }

  it("processes all 8 protocol events and builds authoritative public projections", async () => {
    // 1. WorkspaceCreated
    const wsEvent: WorkspaceCreatedEvent = {
      eventName: "WorkspaceCreated",
      workspaceId: TEST_WORKSPACE_ID,
      owner: TEST_OWNER,
      policyCommitment: TEST_POLICY_COMMITMENT,
      blockNumber: 100n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000100",
      ),
      logIndex: 0,
    };
    const wsRes = await indexer.ingestEvent(
      wsEvent,
      makeMeta(100n, wsEvent.transactionHash, 0),
    );
    expect(wsRes.status).toBe("indexed");

    const wsProj = await indexer.getWorkspaceProjection(TEST_WORKSPACE_ID);
    expect(wsProj).not.toBeNull();
    expect(wsProj?.ownerAddress).toBe(TEST_OWNER);
    expect(wsProj?.currentPolicyVersion).toBe(1);

    // 2. RoleGranted
    const APPROVER_ROLE = parseBytes32(
      "0x8543782163b41d4715b7c7b415a77f3a9e69c6e5a0c3bb20cf67ef0885f80b2a",
    );
    const roleEvent: RoleGrantedEvent = {
      eventName: "RoleGranted",
      workspaceId: TEST_WORKSPACE_ID,
      account: TEST_REVIEWER,
      role: APPROVER_ROLE,
      scope: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
      blockNumber: 101n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000101",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      roleEvent,
      makeMeta(101n, roleEvent.transactionHash, 0),
    );

    const roles = await indexer.getRoleGrantsProjection(TEST_WORKSPACE_ID);
    expect(
      roles.some((r) => r.accountAddress === TEST_REVIEWER && r.active),
    ).toBe(true);

    // 2b. RoleRevoked
    const revokeEvent: RoleRevokedEvent = {
      eventName: "RoleRevoked",
      workspaceId: TEST_WORKSPACE_ID,
      account: TEST_REVIEWER,
      role: APPROVER_ROLE,
      scope: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
      blockNumber: 101n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000101",
      ),
      logIndex: 1,
    };
    await indexer.ingestEvent(
      revokeEvent,
      makeMeta(101n, revokeEvent.transactionHash, 1),
    );

    const rolesAfterRevoke =
      await indexer.getRoleGrantsProjection(TEST_WORKSPACE_ID);
    expect(
      rolesAfterRevoke.find(
        (r) => r.accountAddress === TEST_REVIEWER && r.role === APPROVER_ROLE,
      )?.active,
    ).toBe(false);

    // 3. PolicyUpdated
    const NEW_POLICY_COMMIT = parsePolicyCommitment(
      "0x8888888888888888888888888888888888888888888888888888888888888888",
    );
    const policyEvent: PolicyUpdatedEvent = {
      eventName: "PolicyUpdated",
      workspaceId: TEST_WORKSPACE_ID,
      policyVersion: parsePolicyVersion(2),
      policyCommitment: NEW_POLICY_COMMIT,
      blockNumber: 102n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000102",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      policyEvent,
      makeMeta(102n, policyEvent.transactionHash, 0),
    );

    const policies =
      await indexer.getPolicyVersionsProjection(TEST_WORKSPACE_ID);
    expect(policies).toHaveLength(2);
    expect(policies[1]?.policyVersion).toBe(2);

    // 4. ExpenseVersionSubmitted (Version 1)
    const submitV1Event: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      submitter: TEST_SUBMITTER,
      blockNumber: 103n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000103",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      submitV1Event,
      makeMeta(103n, submitV1Event.transactionHash, 0),
    );

    const expV1 = await indexer.getExpenseVersionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    expect(expV1).not.toBeNull();
    expect(expV1?.commitment).toBe(TEST_COMMITMENT_V1);
    expect(expV1?.isSuperseded).toBe(false);

    // 5. ExpenseVersionSuperseded
    const superEvent: ExpenseVersionSupersededEvent = {
      eventName: "ExpenseVersionSuperseded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      oldVersion: parseExpenseVersion(1),
      newVersion: parseExpenseVersion(2),
      blockNumber: 104n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000104",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      superEvent,
      makeMeta(104n, superEvent.transactionHash, 0),
    );

    const expV1AfterSuper = await indexer.getExpenseVersionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    expect(expV1AfterSuper?.isSuperseded).toBe(true);
    expect(expV1AfterSuper?.supersededByVersion).toBe(2);

    // 6. ExpenseVersionSubmitted (Version 2)
    const submitV2Event: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(2),
      commitment: TEST_COMMITMENT_V2,
      submitter: TEST_SUBMITTER,
      blockNumber: 105n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000105",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      submitV2Event,
      makeMeta(105n, submitV2Event.transactionHash, 0),
    );

    const expAnchor = await indexer.getExpenseProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
    );
    expect(expAnchor?.currentVersion).toBe(2);
    expect(expAnchor?.currentCommitment).toBe(TEST_COMMITMENT_V2);

    // 7. DecisionRecorded (Approve Version 2)
    const decEvent: DecisionRecordedEvent = {
      eventName: "DecisionRecorded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(2),
      commitment: TEST_COMMITMENT_V2,
      reviewer: TEST_REVIEWER,
      decision: OnchainDecision.Approve,
      reasonCommitment: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
      blockNumber: 106n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000106",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      decEvent,
      makeMeta(106n, decEvent.transactionHash, 0),
    );

    const decProj = await indexer.getDecisionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(2),
    );
    expect(decProj?.decision).toBe("approve");
    expect(decProj?.reviewer).toBe(TEST_REVIEWER);

    // 8. SettlementRecorded
    const setEvent: SettlementRecordedEvent = {
      eventName: "SettlementRecorded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(2),
      commitment: TEST_COMMITMENT_V2,
      token: TEST_TOKEN,
      recipient: TEST_RECIPIENT,
      amount: 150000000n, // 150 USDC (6 decimals)
      paymentReference: parsePaymentReference(
        "0x9999999999999999999999999999999999999999999999999999999999999999",
      ),
      blockNumber: 107n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000107",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(
      setEvent,
      makeMeta(107n, setEvent.transactionHash, 0),
    );

    const setProj = await indexer.getSettlementProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(2),
    );
    expect(setProj?.amount).toBe(150000000n);
    expect(setProj?.recipient).toBe(TEST_RECIPIENT);
  });

  it("is strictly idempotent: reprocessing the same event produces zero side effects", async () => {
    const event: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      submitter: TEST_SUBMITTER,
      blockNumber: 200n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000200",
      ),
      logIndex: 1,
    };
    const meta = makeMeta(200n, event.transactionHash, 1);

    // First ingestion
    const firstRes = await indexer.ingestEvent(event, meta);
    expect(firstRes.status).toBe("indexed");
    const initialEventsCount = db.indexedEvents.length;
    const initialExpVerCount = db.projectionExpenseVersions.length;

    // Second ingestion (exact duplicate)
    const secondRes = await indexer.ingestEvent(event, meta);
    expect(secondRes.status).toBe("already_processed");
    expect(secondRes.eventId).toBe(firstRes.eventId);

    // Projections and event log must not have grown
    expect(db.indexedEvents.length).toBe(initialEventsCount);
    expect(db.projectionExpenseVersions.length).toBe(initialExpVerCount);
  });

  it("rebuilding from genesis produces 100% equivalent projections", async () => {
    // Ingest a timeline of 4 events
    const ev1: WorkspaceCreatedEvent = {
      eventName: "WorkspaceCreated",
      workspaceId: TEST_WORKSPACE_ID,
      owner: TEST_OWNER,
      policyCommitment: TEST_POLICY_COMMITMENT,
      blockNumber: 300n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000300",
      ),
      logIndex: 0,
    };
    const ev2: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      submitter: TEST_SUBMITTER,
      blockNumber: 301n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000301",
      ),
      logIndex: 0,
    };
    const ev3: DecisionRecordedEvent = {
      eventName: "DecisionRecorded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      reviewer: TEST_REVIEWER,
      decision: OnchainDecision.Approve,
      reasonCommitment: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
      blockNumber: 302n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000302",
      ),
      logIndex: 0,
    };
    const ev4: SettlementRecordedEvent = {
      eventName: "SettlementRecorded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      token: TEST_TOKEN,
      recipient: TEST_RECIPIENT,
      amount: 50000000n,
      paymentReference: parsePaymentReference(
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ),
      blockNumber: 303n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000303",
      ),
      logIndex: 0,
    };

    await indexer.ingestEvent(ev1, makeMeta(300n, ev1.transactionHash, 0));
    await indexer.ingestEvent(ev2, makeMeta(301n, ev2.transactionHash, 0));
    await indexer.ingestEvent(ev3, makeMeta(302n, ev3.transactionHash, 0));
    await indexer.ingestEvent(ev4, makeMeta(303n, ev4.transactionHash, 0));

    // Capture pre-rebuild state
    const preExp = await indexer.getExpenseProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
    );
    const preDec = await indexer.getDecisionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    const preSet = await indexer.getSettlementProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );

    // Rebuild projections from genesis (block 0)
    const rebuildRes = await indexer.rebuildProjections(TEST_CHAIN_ID, 0n);
    expect(rebuildRes.totalEventsReplayed).toBe(4);
    expect(rebuildRes.projectionsRebuilt.workspaces).toBe(1);
    expect(rebuildRes.projectionsRebuilt.expenses).toBe(1);
    expect(rebuildRes.projectionsRebuilt.decisions).toBe(1);
    expect(rebuildRes.projectionsRebuilt.settlements).toBe(1);

    // Compare post-rebuild state
    const postExp = await indexer.getExpenseProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
    );
    const postDec = await indexer.getDecisionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    const postSet = await indexer.getSettlementProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );

    expect(postExp?.currentCommitment).toBe(preExp?.currentCommitment);
    expect(postDec?.decision).toBe(preDec?.decision);
    expect(postSet?.amount).toBe(preSet?.amount);
  });

  it("handles chain reorganizations: retracts affected projections and restores state", async () => {
    // 1. Submit version 1 at block 400
    const ev1: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      submitter: TEST_SUBMITTER,
      blockNumber: 400n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000400",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(ev1, makeMeta(400n, ev1.transactionHash, 0));

    // 2. Decision recorded at block 410 on losing fork
    const ev2: DecisionRecordedEvent = {
      eventName: "DecisionRecorded",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      reviewer: TEST_REVIEWER,
      decision: OnchainDecision.Approve,
      reasonCommitment: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
      blockNumber: 410n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000410",
      ),
      logIndex: 0,
    };
    await indexer.ingestEvent(ev2, makeMeta(410n, ev2.transactionHash, 0));

    expect(
      await indexer.getDecisionProjection(
        TEST_WORKSPACE_ID,
        TEST_EXPENSE_ID,
        parseExpenseVersion(1),
      ),
    ).not.toBeNull();

    // 3. Reorg occurs: Roll back from block 405
    const reorgRes = await indexer.handleReorganization(TEST_CHAIN_ID, 405n);
    expect(reorgRes.rolledBackFromBlock).toBe(405n);
    expect(reorgRes.markedRemovedCount).toBe(1); // Decision event removed

    // Decision projection at block 410 must be retracted
    const decAfterReorg = await indexer.getDecisionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    expect(decAfterReorg).toBeNull();

    // Expense version 1 at block 400 remains intact
    const expV1AfterReorg = await indexer.getExpenseVersionProjection(
      TEST_WORKSPACE_ID,
      TEST_EXPENSE_ID,
      parseExpenseVersion(1),
    );
    expect(expV1AfterReorg).not.toBeNull();
  });

  it("handles transient failure with retries and dead-letters after max attempts", async () => {
    db.failNextHandler = true;

    const ev: ExpenseVersionSubmittedEvent = {
      eventName: "ExpenseVersionSubmitted",
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: parseExpenseVersion(1),
      commitment: TEST_COMMITMENT_V1,
      submitter: TEST_SUBMITTER,
      blockNumber: 500n,
      transactionHash: parseBytes32(
        "0x0000000000000000000000000000000000000000000000000000000000000500",
      ),
      logIndex: 0,
    };

    const res = await indexer.ingestEvent(
      ev,
      makeMeta(500n, ev.transactionHash, 0),
      { retryAttempts: 3 },
    );

    expect(res.status).toBe("dead_lettered");
    expect(res.error).toContain("Simulated database failure");
    expect(db.deadLetters).toHaveLength(1);
    expect(db.deadLetters[0]?.attempts).toBe(3);
  });

  it("enforces R-001 privacy rule: public projections contain zero private fields", () => {
    const validProjection = {
      workspaceId: TEST_WORKSPACE_ID,
      expenseId: TEST_EXPENSE_ID,
      version: 1,
      commitment: TEST_COMMITMENT_V1,
      token: TEST_TOKEN,
      recipient: TEST_RECIPIENT,
      amount: "150000000",
      paymentReference: "0x9999",
      blockNumber: "100",
    };

    // Valid projection passes
    expect(() => assertPublicProjectionPrivacy(validProjection)).not.toThrow();

    // Injected private merchant field fails immediately
    const leakedMerchant = {
      ...validProjection,
      merchant: "Secret Hotel Corp",
    };
    expect(() => assertPublicProjectionPrivacy(leakedMerchant)).toThrow(
      ProjectionPrivacyViolationError,
    );

    // Injected private receipt URL fails immediately
    const leakedReceipt = {
      ...validProjection,
      receipt_url: "https://private.bucket/rec.pdf",
    };
    expect(() => assertPublicProjectionPrivacy(leakedReceipt)).toThrow(
      ProjectionPrivacyViolationError,
    );

    // Injected encryption salt fails immediately
    const leakedSalt = { ...validProjection, salt: "0xsecret" };
    expect(() => assertPublicProjectionPrivacy(leakedSalt)).toThrow(
      ProjectionPrivacyViolationError,
    );
  });
});
