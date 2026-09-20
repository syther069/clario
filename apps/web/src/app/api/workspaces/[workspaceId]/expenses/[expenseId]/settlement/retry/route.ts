/**
 * POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/retry
 *
 * Resets a failed reimbursement attempt so a new attempt can be prepared and submitted.
 *
 * Invariants enforced (RULES §10, SET-002):
 * - Requires TREASURY_ROLE + recent wallet confirmation.
 * - Only failed or cancelled reimbursements may be reset for retry.
 * - Confirmed or actively processing reimbursements cannot be retried (duplicate guard).
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import {
  SettlementService,
  SettlementNotFoundError,
  SettlementPreConditionError,
} from "@/lib/settlement/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;

    const db = getDatabaseClient();
    const service = new SettlementService(db);

    const result = await service.retryFailedReimbursement(
      workspaceId,
      expenseId,
      authContext,
    );

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    if (
      error instanceof SettlementNotFoundError ||
      error instanceof RecordNotFoundError
    ) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof SettlementPreConditionError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 422;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to retry reimbursement.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
