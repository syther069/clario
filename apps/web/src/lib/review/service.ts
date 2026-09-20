import { ProtocolError, type CanonicalExpenseV1 } from "@clario/protocol";
import type { DatabaseClient } from "@clario/database";
import {
  AuthorizationPolicy,
  GLOBAL_SCOPE,
  type AuthContext,
  type WorkspaceMembershipInfo,
} from "../auth/policy";
import { unwrapKey, decryptEvidence } from "../evidence/crypto";
import { getEvidenceKek } from "../evidence/service";
import type { ExpenseDraftPayload } from "../expense/types";
import { buildCanonicalExpenseRecord } from "../expense/submission";
import { computeMaterialDiff } from "./diff";
import type {
  ReviewDetail,
  ReviewEvidenceItem,
  ReviewQueueFilter,
  ReviewQueueItem,
  ReviewQueueResponse,
  ReviewerAuthorityInfo,
  ProofSpineStep,
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

export class ReviewService {
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

  /**
   * Asserts that the authenticated caller has authorization to view the review queue.
   * Reviewers must hold APPROVER_ROLE, OWNER_ROLE, ADMIN_ROLE, or AUDITOR_ROLE.
   */
  async assertReviewQueueAccess(
    workspaceId: string,
    context: AuthContext,
    targetScope = GLOBAL_SCOPE,
  ): Promise<{
    membership: WorkspaceMembershipInfo;
    authority: ReviewerAuthorityInfo;
  }> {
    const membership = await this.policy.getMembership(workspaceId, context);

    const hasApproverRole = this.policy.hasRole(
      membership,
      "APPROVER_ROLE",
      targetScope,
    );
    const isOwner = membership.isOwner;
    const isAdmin = this.policy.hasRole(membership, "ADMIN_ROLE", targetScope);
    const isAuditor = this.policy.hasRole(
      membership,
      "AUDITOR_ROLE",
      targetScope,
    );

    const hasReviewAccess = isOwner || hasApproverRole || isAdmin || isAuditor;

    if (!hasReviewAccess) {
      throw new ProtocolError("UNAUTHORIZED", {
        message:
          "You are not authorized to view the review queue for this workspace.",
      });
    }

    return {
      membership,
      authority: {
        address: context.address,
        hasApproverRole,
        isOwner,
        isAdmin,
        isAuditor,
        policyVersion: 1,
        targetScope,
      },
    };
  }

  /**
   * Decrypts confidential draft payload from stored record envelope.
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
   * Retrieves the authorized review queue for a workspace.
   */
  async getReviewQueue(params: {
    workspaceId: string;
    context: AuthContext;
    filter?: ReviewQueueFilter | undefined;
  }): Promise<ReviewQueueResponse> {
    const { workspaceId, context, filter } = params;

    const { authority } = await this.assertReviewQueueAccess(
      workspaceId,
      context,
    );

    // Query expenses and current or submitted versions
    const query = `
      SELECT e.expense_id, e.workspace_id, e.created_by, e.current_version,
             e.created_at, e.updated_at,
             ev.version, ev.status, ev.commitment, ev.predecessor_commitment,
             ev.manifest_hash, ev.record_ciphertext, ev.submitted_at,
             ev.amount, ev.currency, ev.recipient,
             COALESCE(eo.cnt, 0) as evidence_count,
             st.source_chain_id, st.source_transaction_hash, st.status as source_status,
             d.decision_type, d.reviewer_address, d.recorded_at as decision_recorded_at, d.reason_commitment
      FROM expenses e
      JOIN expense_versions ev
        ON e.workspace_id = ev.workspace_id
       AND e.expense_id = ev.expense_id
       AND e.current_version = ev.version
      LEFT JOIN (
        SELECT workspace_id, expense_id, version, COUNT(*) as cnt
        FROM evidence_objects
        GROUP BY workspace_id, expense_id, version
      ) eo
        ON ev.workspace_id = eo.workspace_id
       AND ev.expense_id = eo.expense_id
       AND ev.version = eo.version
      LEFT JOIN source_transactions st
        ON e.workspace_id = st.workspace_id
       AND e.expense_id = st.expense_id
      LEFT JOIN decisions d
        ON ev.workspace_id = d.workspace_id
       AND ev.expense_id = d.expense_id
       AND ev.version = d.version
      WHERE e.workspace_id = $1
        AND ev.status != 'draft'
      ORDER BY ev.submitted_at DESC NULLS LAST, e.updated_at DESC;
    `;

    const result = await this.db.query<{
      expense_id: string;
      workspace_id: string;
      created_by: string;
      current_version: number;
      created_at: string;
      updated_at: string;
      version: number;
      status: string;
      commitment: string;
      predecessor_commitment: string | null;
      manifest_hash: string | null;
      record_ciphertext: string;
      submitted_at: string | null;
      amount: string;
      currency: string;
      recipient: string;
      evidence_count: string;
      source_chain_id: number | null;
      source_transaction_hash: string | null;
      source_status: string | null;
      decision_type: "approve" | "reject" | "request_changes" | null;
      reviewer_address: string | null;
      decision_recorded_at: string | null;
      reason_commitment: string | null;
    }>(query, [workspaceId]);

    const items: ReviewQueueItem[] = [];
    let pendingCount = 0;

    for (const r of result.rows) {
      const isPending =
        r.status === "submitted" ||
        r.status === "in_review" ||
        r.status === "changes_requested";

      if (isPending) {
        pendingCount++;
      }

      // Filter by status if specified
      if (filter?.status) {
        if (filter.status === "pending" && !isPending) {
          continue;
        } else if (filter.status === "approved" && r.status !== "approved") {
          continue;
        } else if (filter.status === "rejected" && r.status !== "rejected") {
          continue;
        } else if (
          filter.status === "changes_requested" &&
          r.status !== "changes_requested"
        ) {
          continue;
        }
      }

      // Decrypt confidential fields
      let title = "Untitled Expense";
      let businessPurpose = "";
      let category = "other";
      let project: string | null = null;
      let merchant = "Unknown";
      let expenseDate = r.created_at.slice(0, 10);
      let claimAmount = "0";
      let claimAsset = r.currency;
      let recipient = r.recipient;
      let paymentSource = "manual";

      try {
        const payload = this.decryptPayload(
          r.workspace_id,
          r.expense_id,
          r.version,
          r.record_ciphertext,
        );
        title = payload.title || title;
        businessPurpose = payload.businessPurpose || "";
        category = payload.category || "other";
        project = payload.project || null;
        merchant = payload.merchant || "Unknown";
        expenseDate = payload.expenseDate || expenseDate;
        claimAmount = payload.claimAmount || "0";
        claimAsset = payload.claimAsset || r.currency;
        recipient = payload.recipient || r.recipient;
        paymentSource = payload.paymentSource || "manual";
      } catch {
        // Safe masked defaults if decryption fails
      }

      const isSelfExpense =
        r.created_by.toLowerCase() === context.address.toLowerCase();

      // Approval requires APPROVER_ROLE or OWNER_ROLE, NOT self-expense, and MUST be current version
      const canApprove =
        !isSelfExpense &&
        (authority.hasApproverRole || authority.isOwner) &&
        r.version === r.current_version &&
        r.status !== "approved";

      items.push({
        expenseId: r.expense_id,
        workspaceId: r.workspace_id,
        version: r.version,
        commitment: r.commitment,
        predecessorCommitment: r.predecessor_commitment,
        status: r.status,
        title,
        businessPurpose,
        category,
        project,
        merchant,
        expenseDate,
        claimAmount,
        currency: r.currency,
        claimAsset,
        recipient,
        paymentSource,
        submittedAt: r.submitted_at || r.updated_at,
        createdBy: r.created_by,
        isSelfExpense,
        canApprove,
        evidenceCount: Number(r.evidence_count),
        hasSourceTransaction: !!r.source_transaction_hash,
        sourceTransaction: r.source_transaction_hash
          ? {
              chainId: Number(r.source_chain_id),
              txHash: r.source_transaction_hash,
              status: r.source_status || "confirmed",
            }
          : null,
        latestDecision: r.decision_type
          ? {
              decisionType: r.decision_type,
              reviewerAddress: r.reviewer_address!,
              recordedAt: r.decision_recorded_at!,
              reasonCommitment: r.reason_commitment,
            }
          : null,
      });
    }

    return {
      items,
      totalCount: items.length,
      pendingCount,
      reviewerRole: authority,
    };
  }

  /**
   * Retrieves full review detail for an expense version, including decrypted canonical record,
   * evidence items, predecessor material diff, and Proof Spine milestones.
   */
  async getReviewDetail(params: {
    workspaceId: string;
    expenseId: string;
    version?: number | undefined;
    context: AuthContext;
  }): Promise<ReviewDetail> {
    const { workspaceId, expenseId, context } = params;

    // Verify workspace membership and caller review access
    const { authority } = await this.assertReviewQueueAccess(
      workspaceId,
      context,
    );

    // Verify expense access
    await this.policy.authorizeExpense(workspaceId, expenseId, context, "read");

    // Fetch expense header
    const expenseRes = await this.db.query<{
      expense_id: string;
      workspace_id: string;
      created_by: string;
      current_version: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT expense_id, workspace_id, created_by, current_version, created_at, updated_at
       FROM expenses
       WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    if (expenseRes.rows.length === 0) {
      throw new ProtocolError("UNAUTHORIZED", {
        message: "The requested expense was not found in this workspace.",
      });
    }

    const expense = expenseRes.rows[0]!;
    const targetVersion = params.version ?? expense.current_version;

    // Fetch targeted expense version
    const versionRes = await this.db.query<{
      version: number;
      status: string;
      commitment: string;
      predecessor_commitment: string | null;
      manifest_hash: string | null;
      record_ciphertext: string;
      submitted_at: string | null;
      amount: string;
      currency: string;
      recipient: string;
    }>(
      `SELECT version, status, commitment, predecessor_commitment, manifest_hash,
              record_ciphertext, submitted_at, amount, currency, recipient
       FROM expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, targetVersion],
    );

    if (versionRes.rows.length === 0) {
      throw new ProtocolError("UNAUTHORIZED", {
        message: `Version ${targetVersion} of this expense was not found.`,
      });
    }

    const versionRow = versionRes.rows[0]!;

    // Decrypt current targeted payload
    const payload = this.decryptPayload(
      workspaceId,
      expenseId,
      versionRow.version,
      versionRow.record_ciphertext,
    );

    // Reconstruct canonical expense record
    let canonicalRecord: CanonicalExpenseV1 | null = null;
    try {
      const manifestHashBytes = (
        versionRow.manifest_hash && versionRow.manifest_hash.startsWith("0x")
          ? versionRow.manifest_hash
          : `0x${versionRow.manifest_hash || "00".repeat(32)}`
      ) as `0x${string}`;

      const { canonicalExpense } = buildCanonicalExpenseRecord({
        workspaceId: workspaceId as `0x${string}`,
        expenseId: expenseId as `0x${string}`,
        version: versionRow.version,
        payload,
        evidenceManifestHash: manifestHashBytes,
        submittedBy: expense.created_by as `0x${string}`,
        submittedAt: versionRow.submitted_at
          ? new Date(versionRow.submitted_at).toISOString().slice(0, 19) + "Z"
          : undefined,
      });
      canonicalRecord = canonicalExpense;
    } catch {
      // If canonical construction fails, canonicalRecord remains null
    }

    // Fetch evidence objects for this version
    const evidenceRes = await this.db.query<{
      evidence_id: string;
      original_filename: string;
      mime_type: string;
      byte_size: number;
      sha256_hash: string;
    }>(
      `SELECT evidence_id, original_filename, mime_type, byte_size, sha256_hash
       FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       ORDER BY evidence_id ASC;`,
      [workspaceId, expenseId, targetVersion],
    );

    const evidence: ReviewEvidenceItem[] = evidenceRes.rows.map((eo) => ({
      evidenceId: eo.evidence_id,
      originalFilename: eo.original_filename,
      mimeType: eo.mime_type,
      byteSize: Number(eo.byte_size),
      sha256Hash: eo.sha256_hash,
      downloadUrl: `/api/expenses/${expenseId}/evidence/${eo.evidence_id}`,
      previewAvailable:
        eo.mime_type.startsWith("image/") || eo.mime_type === "application/pdf",
    }));

    // Fetch source transaction
    const sourceTxRes = await this.db.query<{
      source_chain_id: number;
      source_transaction_hash: string;
      status: string;
    }>(
      `SELECT source_chain_id, source_transaction_hash, status
       FROM source_transactions
       WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    const sourceTransaction =
      sourceTxRes.rows.length > 0
        ? {
            chainId: Number(sourceTxRes.rows[0]!.source_chain_id),
            txHash: sourceTxRes.rows[0]!.source_transaction_hash,
            status: sourceTxRes.rows[0]!.status,
          }
        : null;

    // Fetch latest decision for this version
    const decisionRes = await this.db.query<{
      decision_type: "approve" | "reject" | "request_changes";
      reviewer_address: string;
      recorded_at: string;
      reason_commitment: string | null;
    }>(
      `SELECT decision_type, reviewer_address, recorded_at, reason_commitment
       FROM decisions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
      [workspaceId, expenseId, targetVersion],
    );

    const latestDecision =
      decisionRes.rows.length > 0
        ? {
            decisionType: decisionRes.rows[0]!.decision_type,
            reviewerAddress: decisionRes.rows[0]!.reviewer_address,
            recordedAt: decisionRes.rows[0]!.recorded_at,
            reasonCommitment: decisionRes.rows[0]!.reason_commitment,
          }
        : null;

    // Compute predecessor material diff if version > 1
    let materialDiff = null;
    if (targetVersion > 1 && canonicalRecord) {
      const predRes = await this.db.query<{
        version: number;
        record_ciphertext: string;
        manifest_hash: string | null;
        submitted_at: string | null;
      }>(
        `SELECT version, record_ciphertext, manifest_hash, submitted_at
         FROM expense_versions
         WHERE workspace_id = $1 AND expense_id = $2 AND version = $3;`,
        [workspaceId, expenseId, targetVersion - 1],
      );

      if (predRes.rows.length > 0) {
        try {
          const predPayload = this.decryptPayload(
            workspaceId,
            expenseId,
            predRes.rows[0]!.version,
            predRes.rows[0]!.record_ciphertext,
          );

          const predManifestHashBytes = (
            predRes.rows[0]!.manifest_hash &&
            predRes.rows[0]!.manifest_hash.startsWith("0x")
              ? predRes.rows[0]!.manifest_hash
              : `0x${predRes.rows[0]!.manifest_hash || "00".repeat(32)}`
          ) as `0x${string}`;

          const { canonicalExpense: predCanonical } =
            buildCanonicalExpenseRecord({
              workspaceId: workspaceId as `0x${string}`,
              expenseId: expenseId as `0x${string}`,
              version: predRes.rows[0]!.version,
              payload: predPayload,
              evidenceManifestHash: predManifestHashBytes,
              submittedBy: expense.created_by as `0x${string}`,
              submittedAt: predRes.rows[0]!.submitted_at
                ? new Date(predRes.rows[0]!.submitted_at)
                    .toISOString()
                    .slice(0, 19) + "Z"
                : undefined,
            });

          materialDiff = computeMaterialDiff(
            canonicalRecord,
            predCanonical,
            targetVersion - 1,
          );
        } catch {
          // If predecessor cannot be decoded, materialDiff remains null
        }
      }
    }

    const isCurrentVersion = targetVersion === expense.current_version;
    const isSuperseded = targetVersion < expense.current_version;
    const isSelfExpense =
      expense.created_by.toLowerCase() === context.address.toLowerCase();

    const canApprove =
      !isSelfExpense &&
      (authority.hasApproverRole || authority.isOwner) &&
      isCurrentVersion &&
      versionRow.status !== "approved";

    // Build Proof Spine milestones
    const proofSpine: ProofSpineStep[] = [
      {
        step: "draft_created",
        title: "Draft Created",
        description: `Created by ${expense.created_by.slice(0, 6)}...${expense.created_by.slice(-4)}`,
        timestamp: expense.created_at,
        status: "completed",
        actor: expense.created_by,
      },
      {
        step: "version_submitted",
        title: `Version ${targetVersion} Committed`,
        description: `Salted commitment anchored on Monad`,
        timestamp: versionRow.submitted_at,
        status: isSuperseded ? "superseded" : "completed",
        commitment: versionRow.commitment,
      },
      {
        step: "human_review",
        title: latestDecision
          ? `Decision: ${latestDecision.decisionType.toUpperCase()}`
          : "Authorized Human Review",
        description: latestDecision
          ? `Decided by ${latestDecision.reviewerAddress.slice(0, 6)}...${latestDecision.reviewerAddress.slice(-4)}`
          : "Awaiting human review by authorized APPROVER_ROLE",
        timestamp: latestDecision?.recordedAt ?? null,
        status: latestDecision
          ? latestDecision.decisionType === "approve"
            ? "completed"
            : "failed"
          : isSuperseded
            ? "superseded"
            : "active",
        actor: latestDecision?.reviewerAddress,
      },
      {
        step: "settlement",
        title: "Monad Reimbursement",
        description: "Requires approved current version and TREASURY_ROLE",
        timestamp: null,
        status:
          latestDecision?.decisionType === "approve" && isCurrentVersion
            ? "active"
            : "pending",
      },
    ];

    return {
      expenseId: expense.expense_id,
      workspaceId: expense.workspace_id,
      version: versionRow.version,
      commitment: versionRow.commitment,
      predecessorCommitment: versionRow.predecessor_commitment,
      status: versionRow.status,
      title: payload.title || "Untitled Expense",
      businessPurpose: payload.businessPurpose || "",
      category: payload.category || "other",
      project: payload.project || null,
      merchant: payload.merchant || "Unknown",
      expenseDate: payload.expenseDate || expense.created_at.slice(0, 10),
      claimAmount: payload.claimAmount || "0",
      currency: versionRow.currency,
      claimAsset: payload.claimAsset || versionRow.currency,
      recipient: payload.recipient || versionRow.recipient,
      paymentSource: payload.paymentSource || "manual",
      submittedAt: versionRow.submitted_at || expense.updated_at,
      createdBy: expense.created_by,
      isSelfExpense,
      canApprove,
      evidenceCount: evidence.length,
      hasSourceTransaction: !!sourceTransaction,
      sourceTransaction,
      latestDecision,
      canonicalRecord,
      evidence,
      manifestHash: versionRow.manifest_hash,
      isCurrentVersion,
      currentVersion: expense.current_version,
      isSuperseded,
      materialDiff,
      selfApprovalBlocked: isSelfExpense,
      proofSpine,
    };
  }
}
