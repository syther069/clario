/**
 * GET /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/status
 *
 * Returns the current settlement lifecycle status for an expense, including:
 * - Current settlement status (unsubmitted, submitted, confirming, confirmed, failed)
 * - Onchain transaction attempt history
 * - Settlement proof (if confirmed) with block number and explorer URL
 * - Retry eligibility (canRetry: true for failed/cancelled)
 *
 * Invariants enforced (RULES §10, SET-002):
 * - Enforces workspace authorization.
 * - SUBMITTED state is NEVER labeled confirmed or final.
 * - Proof strictly surfaces truthful onchain data.
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import {
  SettlementService,
  SettlementNotFoundError,
} from "@/lib/settlement/service";
import { tryGetSettlementConfig } from "@/lib/settlement/config";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;

    const db = getDatabaseClient();
    const service = new SettlementService(db);
    const config = tryGetSettlementConfig();
    const chainId = config?.chainId ?? 31337;
    const decimals = config?.token.decimals ?? 6;

    const result = await service.getSettlementStatus(
      workspaceId,
      expenseId,
      authContext,
      chainId,
      decimals,
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
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get settlement status.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
