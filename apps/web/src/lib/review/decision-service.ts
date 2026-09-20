/**
 * Clario Review Decision Service
 *
 * Implements exact-version human decision preparation, onchain calldata / EIP-712
 * typed data generation, offchain database reconciliation, self-approval prevention,
 * and immutable successor version drafting for supersession flows.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { type DatabaseClient, withTransaction } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import { keccak256, stringToBytes } from "viem";

import {
  AuthorizationPolicy,
  type AuthContext,
  RecordNotFoundError,
} from "../auth/policy";
import {
  decryptEvidence,
  encryptEvidence,
  generateDataEncryptionKey,
  unwrapKey,
  wrapKey,
} from "../evidence/crypto";
import { getEvidenceKek } from "../evidence/service";
import {
  getDefaultStorageDriver,
  type StorageDriver,
} from "../evidence/storage";
import {
  DEFAULT_TOKEN,
  findTokenAsset,
  normalizeAddress,
  parseBaseUnits,
} from "../expense/amount";
import type { ExpenseDraftPayload, ExpenseDraftRecord } from "../expense/types";
import { validateExpenseDraft } from "../expense/validation";
import {
  buildClarioApprovalTypedData,
  computeReasonCommitment,
  encodeRecordDecisionCalldata,
  type DecisionType,
} from "./decision";

interface StoredDraftEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: string;
  keyId: string;
  kekIv: string;
  kekAuthTag: string;
}

interface StoredSaltEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface PreparedDecision {
  workspaceId: string;
  expenseId: string;
  version: number;
  decision: DecisionType;
  commitment: `0x${string}`;
  reasonCommitment: `0x${string}`;
  reasonText?: string | undefined;
  policyVersion: number;
  nonce: string;
  deadline: string;
  chainId: number;
  registryAddress: `0x${string}`;
  calldata: `0x${string}`;
  typedData: Record<string, unknown>;
}

export interface ReconcileDecisionParams {
  workspaceId: string;
  expenseId: string;
  version: number;
  decision: DecisionType;
  txHash: string;
  reason?: string | undefined;
  signature?: string | undefined;
  nonce?: bigint | number | undefined;
  context: AuthContext;
}

export interface ReconcileDecisionResult {
  success: boolean;
  decisionId: string;
  expenseId: string;
  version: number;
  decision: DecisionType;
  txHash: string;
  recordedAt: string;
}

export interface CreateSuccessorDraftParams {
  workspaceId: string;
  expenseId: string;
  payloadUpdates?: Partial<ExpenseDraftPayload> | undefined;
  context: AuthContext;
}

export class ReviewDecisionService {
  private readonly policy: AuthorizationPolicy;
  private readonly storage: StorageDriver;
  private readonly kek: Buffer;

  constructor(
    private readonly db: DatabaseClient,
    storage?: StorageDriver,
    kek?: Buffer,
    policy?: AuthorizationPolicy,
  ) {
    this.storage = storage ?? getDefaultStorageDriver();
    this.kek = kek ?? getEvidenceKek();
    this.policy = policy ?? new AuthorizationPolicy(db);
  }

  /**
   * Encrypts the draft payload using AES-256-GCM envelope encryption.
   */
  private encryptPayload(
    workspaceId: string,
    expenseId: string,
    version: number,
    payload: ExpenseDraftPayload,
  ): { recordCiphertext: string; saltCiphertext: string } {
    const dek = generateDataEncryptionKey();
    const wrapResult = wrapKey(dek, this.kek, "kek-v1");

    const recordContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_record",
    };
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const encRecord = encryptEvidence(plaintext, dek, recordContext);

    const recordEnvelope: StoredDraftEnvelope = {
      ciphertext: encRecord.ciphertext.toString("hex"),
      iv: encRecord.iv.toString("hex"),
      authTag: encRecord.authTag.toString("hex"),
      wrappedKey: wrapResult.wrappedKey.toString("hex"),
      keyId: wrapResult.keyId,
      kekIv: wrapResult.iv.toString("hex"),
      kekAuthTag: wrapResult.authTag.toString("hex"),
    };

    const salt = randomBytes(32);
    const saltContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_salt",
    };
    const encSalt = encryptEvidence(salt, dek, saltContext);

    const saltEnvelope: StoredSaltEnvelope = {
      ciphertext: encSalt.ciphertext.toString("hex"),
      iv: encSalt.iv.toString("hex"),
      authTag: encSalt.authTag.toString("hex"),
    };

    return {
      recordCiphertext: JSON.stringify(recordEnvelope),
      saltCiphertext: JSON.stringify(saltEnvelope),
    };
  }

  /**
   * Decrypts the draft payload from envelope ciphertext.
   */
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

    const recordContext = {
      workspaceId: workspaceId.toLowerCase(),
      expenseId: expenseId.toLowerCase(),
      version,
      evidenceId: "draft_record",
    };

    const plaintext = decryptEvidence(
      Buffer.from(envelope.ciphertext, "hex"),
      dek,
      Buffer.from(envelope.iv, "hex"),
      Buffer.from(envelope.authTag, "hex"),
      recordContext,
    );

    return JSON.parse(plaintext.toString("utf8")) as ExpenseDraftPayload;
  }

  /**
   * Asserts caller has approver authority (APPROVER_ROLE or OWNER_ROLE).
   */
  private async assertApproverAuthority(
    workspaceId: string,
    context: AuthContext,
  ): Promise<void> {
    const membership = await this.policy.getMembership(workspaceId, context);
    const hasAuthority =
      this.policy.hasRole(membership, "APPROVER_ROLE") ||
      this.policy.hasRole(membership, "OWNER_ROLE");

    if (!hasAuthority) {
      throw new ProtocolError("UNAUTHORIZED", {
        message:
          "Caller lacks APPROVER_ROLE or OWNER_ROLE authority in workspace.",
      });
    }
  }

  /**
   * Prepares onchain calldata and EIP-712 typed data envelope for recording a decision.
   *
   * Enforces:
   * 1. Approver authority.
   * 2. Self-approval prevention: submitter cannot approve own expense.
   * 3. Target version must be current version and not superseded.
   * 4. Single-decision invariant: version has not already been decided.
   * 5. Mandatory reason commitment for reject / request_changes.
   */
  async prepareDecision(params: {
    workspaceId: string;
    expenseId: string;
    version: number;
    decision: DecisionType;
    reason?: string | undefined;
    context: AuthContext;
  }): Promise<PreparedDecision> {
    const { workspaceId, expenseId, version, decision, reason, context } =
      params;

    // 1. Assert approver authority
    await this.assertApproverAuthority(workspaceId, context);

    // 2. Query expense header
    const expRes = await this.db.query<{
      created_by: string;
      current_version: number;
    }>(
      `SELECT created_by, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense not found");
    }
    const expense = expRes.rows[0]!;

    // 3. Query target version row
    const verRes = await this.db.query<{
      version: number;
      commitment: string;
      status: string;
      submitted_by: string | null;
    }>(
      `SELECT version, commitment, status, submitted_by
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, version],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense version not found");
    }
    const versionRow = verRes.rows[0]!;

    // 4. Invariant: Self-approval prohibition
    if (decision === "approve") {
      const isSubmitter =
        expense.created_by.toLowerCase() === context.address.toLowerCase() ||
        (versionRow.submitted_by !== null &&
          versionRow.submitted_by.toLowerCase() ===
            context.address.toLowerCase());

      if (isSubmitter) {
        throw new ProtocolError("UNAUTHORIZED", {
          message:
            "Self-approval is strictly prohibited: submitters cannot approve their own expenses.",
        });
      }
    }

    // 5. Invariant: Version must be current version and not superseded
    if (version !== expense.current_version) {
      throw new ProtocolError("EXPENSE_VERSION_SUPERSEDED", {
        message: `Cannot record decision: version ${version} is not the current version (current is ${expense.current_version}).`,
      });
    }

    if (versionRow.status === "superseded") {
      throw new ProtocolError("EXPENSE_VERSION_SUPERSEDED", {
        message: `Cannot record decision: version ${version} has already been superseded.`,
      });
    }

    // 6. Invariant: Single decision per version
    const decRes = await this.db.query<{ decision_id: string }>(
      `SELECT decision_id FROM decisions WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, version],
    );

    if (decRes.rows.length > 0) {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `A decision has already been recorded for version ${version}.`,
      });
    }

    // 7. Compute reason commitment (enforces mandatory reason for reject / request_changes)
    const reasonCommitment = computeReasonCommitment({ decision, reason });

    // 8. Resolve workspace policy version
    const polRes = await this.db.query<{ policy_version: number }>(
      `SELECT policy_version FROM workspace_policies WHERE workspace_id = $1 ORDER BY policy_version DESC LIMIT 1;`,
      [workspaceId],
    );
    const policyVersion =
      polRes.rows.length > 0 ? polRes.rows[0]!.policy_version : 1;

    // 9. Resolve registry address & chain ID
    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337", 10);
    const registryAddress = (process.env
      .NEXT_PUBLIC_DECISION_REGISTRY_ADDRESS ??
      "0x2000000000000000000000000000000000000003") as `0x${string}`;

    // 10. Compute nonce for reviewer
    const nonceRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM decisions WHERE reviewer_address = $1 AND signature IS NOT NULL;`,
      [context.address.toLowerCase()],
    );
    const nonce = BigInt(nonceRes.rows[0]?.count ?? "0");

    // 11. Deadline: 1 hour from current timestamp
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // 12. Normalize commitment
    const commitment = (
      versionRow.commitment.startsWith("0x")
        ? versionRow.commitment
        : `0x${versionRow.commitment}`
    ) as `0x${string}`;

    // 13. Encode calldata for direct onchain transaction
    const calldata = encodeRecordDecisionCalldata({
      workspaceId: workspaceId as `0x${string}`,
      expenseId: expenseId as `0x${string}`,
      version,
      decision,
      commitment,
      reasonCommitment,
    });

    // 14. Build EIP-712 typed data envelope
    const typedData = buildClarioApprovalTypedData({
      workspaceId: workspaceId as `0x${string}`,
      expenseId: expenseId as `0x${string}`,
      version,
      commitment,
      decision,
      reviewer: context.address as `0x${string}`,
      reasonCommitment,
      policyVersion,
      nonce,
      deadline,
      chainId,
      verifyingContract: registryAddress,
    });

    return {
      workspaceId,
      expenseId,
      version,
      decision,
      commitment,
      reasonCommitment,
      reasonText: reason,
      policyVersion,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      chainId,
      registryAddress,
      calldata,
      typedData: {
        ...typedData,
        message: {
          ...typedData.message,
          nonce: typedData.message.nonce.toString(),
          expiration: typedData.message.expiration.toString(),
        },
      },
    };
  }

  /**
   * Reconciles a recorded decision after transaction submission / confirmation.
   *
   * Updates `decisions` table, updates `expense_versions.status`, logs into
   * `chain_transactions`, and emits an immutable `audit_events` row.
   */
  async reconcileDecision(
    params: ReconcileDecisionParams,
  ): Promise<ReconcileDecisionResult> {
    const {
      workspaceId,
      expenseId,
      version,
      decision,
      txHash,
      reason,
      signature,
      nonce = 0,
      context,
    } = params;

    // 1. Assert approver authority
    await this.assertApproverAuthority(workspaceId, context);

    // 2. Query expense header
    const expRes = await this.db.query<{
      created_by: string;
      current_version: number;
    }>(
      `SELECT created_by, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense not found");
    }
    const expense = expRes.rows[0]!;

    // 3. Query target version row
    const verRes = await this.db.query<{
      version: number;
      commitment: string;
      status: string;
      submitted_by: string | null;
    }>(
      `SELECT version, commitment, status, submitted_by
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, version],
    );

    if (verRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense version not found");
    }
    const versionRow = verRes.rows[0]!;

    // 4. Invariant: Self-approval prohibition
    if (decision === "approve") {
      const isSubmitter =
        expense.created_by.toLowerCase() === context.address.toLowerCase() ||
        (versionRow.submitted_by !== null &&
          versionRow.submitted_by.toLowerCase() ===
            context.address.toLowerCase());

      if (isSubmitter) {
        throw new ProtocolError("UNAUTHORIZED", {
          message:
            "Self-approval is strictly prohibited: submitters cannot approve their own expenses.",
        });
      }
    }

    // 5. Invariant: Version must be current version and not superseded
    if (version !== expense.current_version) {
      throw new ProtocolError("EXPENSE_VERSION_SUPERSEDED", {
        message: `Cannot record decision: version ${version} is not the current version (current is ${expense.current_version}).`,
      });
    }

    if (versionRow.status === "superseded") {
      throw new ProtocolError("EXPENSE_VERSION_SUPERSEDED", {
        message: `Cannot record decision: version ${version} has already been superseded.`,
      });
    }

    // 6. Check existing decision for idempotency
    const existingDec = await this.db.query<{
      decision_id: string;
      transaction_hash: string | null;
      recorded_at: string;
    }>(
      `SELECT decision_id, transaction_hash, recorded_at
       FROM decisions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, version],
    );

    if (existingDec.rows.length > 0) {
      const existing = existingDec.rows[0]!;
      if (
        existing.transaction_hash &&
        existing.transaction_hash.toLowerCase() === txHash.toLowerCase()
      ) {
        return {
          success: true,
          decisionId: existing.decision_id,
          expenseId,
          version,
          decision,
          txHash,
          recordedAt: existing.recorded_at,
        };
      }
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message: `A decision has already been recorded for version ${version}.`,
      });
    }

    // 7. Compute reason commitment
    const reasonCommitment = computeReasonCommitment({ decision, reason });

    // 8. Policy version
    const polRes = await this.db.query<{ policy_version: number }>(
      `SELECT policy_version FROM workspace_policies WHERE workspace_id = $1 ORDER BY policy_version DESC LIMIT 1;`,
      [workspaceId],
    );
    const policyVersion =
      polRes.rows.length > 0 ? polRes.rows[0]!.policy_version : 1;

    const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337", 10);
    const commitment = (
      versionRow.commitment.startsWith("0x")
        ? versionRow.commitment
        : `0x${versionRow.commitment}`
    ) as `0x${string}`;

    // 9. Execute atomic database update
    return await withTransaction(this.db, async (tx) => {
      const decisionId = randomUUID();
      const now = new Date().toISOString();

      // Insert into decisions table
      await tx.query(
        `INSERT INTO decisions (
           decision_id, workspace_id, expense_id, version, commitment, decision_type,
           reviewer_address, reason_commitment, policy_version, nonce,
           signature, transaction_hash, recorded_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          decisionId,
          workspaceId,
          expenseId,
          version,
          commitment,
          decision,
          context.address.toLowerCase(),
          decision === "approve" && (!reason || reason.trim().length === 0)
            ? null
            : reasonCommitment,
          policyVersion,
          Number(nonce),
          signature ?? null,
          txHash.toLowerCase(),
          now,
        ],
      );

      // If approved, update expense_versions status to 'current'
      if (decision === "approve") {
        await tx.query(
          `UPDATE expense_versions
           SET status = 'current'
           WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
          [workspaceId, expenseId, version],
        );
      }

      // Record in chain_transactions
      const actionName =
        decision === "approve"
          ? "approve_expense_version"
          : decision === "reject"
            ? "reject_expense_version"
            : "request_changes_expense_version";

      await tx.query(
        `INSERT INTO chain_transactions (
           workspace_id, chain_id, transaction_hash, action,
           status, submitted_at, confirmed_at
         ) VALUES ($1, $2, $3, $4, 'confirmed', $5, $5)
         ON CONFLICT (chain_id, transaction_hash) DO NOTHING;`,
        [workspaceId, chainId, txHash.toLowerCase(), actionName, now],
      );

      // Record in audit_events
      const eventType =
        decision === "approve"
          ? "expense_version_approved"
          : decision === "reject"
            ? "expense_version_rejected"
            : "expense_version_changes_requested";

      await tx.query(
        `INSERT INTO audit_events (
           workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at
         ) VALUES ($1, $2, $3, 'expense_version', $4, $5, $6);`,
        [
          workspaceId,
          context.address.toLowerCase(),
          eventType,
          `${expenseId}:v${version}`,
          JSON.stringify({
            expenseId,
            version,
            decision,
            commitment,
            reasonCommitment,
            reasonText: reason ?? null,
            txHash: txHash.toLowerCase(),
            signature: signature ?? null,
          }),
          now,
        ],
      );

      return {
        success: true,
        decisionId,
        expenseId,
        version,
        decision,
        txHash,
        recordedAt: now,
      };
    });
  }

  /**
   * Creates an immutable successor draft version (V+1) when changes are requested
   * or a material update is required.
   *
   * Enforces:
   * 1. Creator or workspace OWNER_ROLE / ADMIN_ROLE authority.
   * 2. Supersession: marks predecessor versions as superseded.
   * 3. Lineage binding: sets previous_commitment to the current version's commitment.
   * 4. Copies evidence attachments forward so provenance remains continuous.
   */
  async createSuccessorDraft(
    params: CreateSuccessorDraftParams,
  ): Promise<ExpenseDraftRecord> {
    const { workspaceId, expenseId, payloadUpdates, context } = params;

    // 1. Verify workspace membership
    await this.policy.getMembership(workspaceId, context);

    // 2. Fetch expense header
    const expRes = await this.db.query<{
      created_by: string;
      current_version: number;
    }>(
      `SELECT created_by, current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      throw new RecordNotFoundError("Expense not found");
    }
    const expense = expRes.rows[0]!;

    // Assert caller is creator or owner/admin
    const membership = await this.policy.getMembership(workspaceId, context);
    const isOwnerOrAdmin =
      this.policy.hasRole(membership, "OWNER_ROLE") ||
      this.policy.hasRole(membership, "ADMIN_ROLE");
    const isCreator =
      expense.created_by.toLowerCase() === context.address.toLowerCase();

    if (!isCreator && !isOwnerOrAdmin) {
      throw new ProtocolError("UNAUTHORIZED", {
        message:
          "Only the expense submitter or workspace owner can create a successor version.",
      });
    }

    // 3. Fetch current version record
    const curRes = await this.db.query<{
      version: number;
      commitment: string;
      record_ciphertext: string;
      salt_ciphertext: string;
      status: string;
      amount: string;
      currency: string;
      recipient: string;
      submitted_by: string | null;
    }>(
      `SELECT version, commitment, record_ciphertext, salt_ciphertext, status, amount, currency, recipient, submitted_by
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, expense.current_version],
    );

    if (curRes.rows.length === 0) {
      throw new RecordNotFoundError("Current expense version not found");
    }
    const currentVer = curRes.rows[0]!;

    // Cannot create successor if current version is still an unsubmitted draft
    if (currentVer.status === "draft") {
      throw new ProtocolError("INVALID_LIFECYCLE_TRANSITION", {
        message:
          "Version is already an editable draft. Modify the existing draft instead of creating a successor.",
      });
    }

    const nextVersion = currentVer.version + 1;

    // 4. Decrypt current payload and merge updates
    const currentPayload = this.decryptPayload(
      workspaceId,
      expenseId,
      currentVer.version,
      currentVer.record_ciphertext,
    );

    const newPayload: ExpenseDraftPayload = {
      ...currentPayload,
      ...(payloadUpdates ?? {}),
      recipient: normalizeAddress(
        payloadUpdates?.recipient ??
          currentPayload.recipient ??
          context.address,
      ),
      claimAsset: normalizeAddress(
        payloadUpdates?.claimAsset ??
          currentPayload.claimAsset ??
          DEFAULT_TOKEN.address,
      ),
    };

    // 5. Validate draft payload
    const validation = validateExpenseDraft(newPayload, false);
    if (!validation.valid) {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: `Successor draft validation failed: ${Object.values(validation.errors).join(", ")}`,
      });
    }

    // 6. Encrypt new payload and salt bound to nextVersion AAD
    const { recordCiphertext, saltCiphertext } = this.encryptPayload(
      workspaceId,
      expenseId,
      nextVersion,
      newPayload,
    );

    const tokenMeta = findTokenAsset(newPayload.claimAsset);
    const decimals = tokenMeta?.decimals ?? 6;
    let baseUnits = "0";
    try {
      baseUnits = parseBaseUnits(newPayload.claimAmount, decimals).toString();
    } catch {
      baseUnits = "0";
    }

    // Preliminary draft commitment
    const nextCommitment = keccak256(
      stringToBytes(
        `draft:${expenseId.toLowerCase()}:${nextVersion}:${Date.now()}`,
      ),
    );

    // 7. Atomic transaction
    return await withTransaction(this.db, async (tx) => {
      // Mark predecessor versions as superseded
      await tx.query(
        `UPDATE expense_versions
         SET status = 'superseded'
         WHERE workspace_id = $1 AND expense_id = $2 AND version <= $3 AND status != 'superseded';`,
        [workspaceId, expenseId, currentVer.version],
      );

      // Insert version V+1 (draft)
      await tx.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'kek-v1', $7, 'kek-v1', $8, $9, $10, 'draft');`,
        [
          workspaceId,
          expenseId,
          nextVersion,
          nextCommitment,
          currentVer.commitment,
          saltCiphertext,
          recordCiphertext,
          baseUnits,
          normalizeAddress(newPayload.claimAsset),
          normalizeAddress(newPayload.recipient),
        ],
      );

      // Copy evidence objects from predecessor to successor
      await tx.query(
        `INSERT INTO evidence_objects (
           workspace_id, expense_id, version, storage_key, sha256_hash,
           byte_length, mime_type, encryption_metadata, created_at
         )
         SELECT workspace_id, expense_id, $1, storage_key, sha256_hash,
                byte_length, mime_type, encryption_metadata, NOW()
         FROM evidence_objects
         WHERE workspace_id = $2 AND expense_id = $3 AND version = $4;`,
        [nextVersion, workspaceId, expenseId, currentVer.version],
      );

      // Update current_version on expenses header
      await tx.query(
        `UPDATE expenses
         SET current_version = $1, updated_at = NOW()
         WHERE workspace_id = $2 AND expense_id = $3;`,
        [nextVersion, workspaceId, expenseId],
      );

      // Fetch timestamps
      const tsRes = await tx.query<{ created_at: string }>(
        `SELECT created_at FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
        [workspaceId, expenseId, nextVersion],
      );

      // Insert audit event
      await tx.query(
        `INSERT INTO audit_events (
           workspace_id, actor_address, event_type, entity_type, entity_id, metadata, occurred_at
         ) VALUES ($1, $2, $3, 'expense', $4, $5, NOW());`,
        [
          workspaceId,
          context.address.toLowerCase(),
          "successor_draft_created",
          expenseId,
          JSON.stringify({
            predecessorVersion: currentVer.version,
            predecessorCommitment: currentVer.commitment,
            successorVersion: nextVersion,
            successorDraftCommitment: nextCommitment,
          }),
        ],
      );

      return {
        workspaceId,
        expenseId,
        version: nextVersion,
        createdBy: currentVer.submitted_by ?? context.address.toLowerCase(),
        status: "draft",
        amount: baseUnits,
        currency: normalizeAddress(newPayload.claimAsset),
        recipient: normalizeAddress(newPayload.recipient),
        payload: newPayload,
        evidence: [],
        createdAt: tsRes.rows[0]?.created_at ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previousCommitment: currentVer.commitment,
      };
    });
  }
}
