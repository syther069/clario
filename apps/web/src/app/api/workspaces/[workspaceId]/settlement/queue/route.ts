/**
 * GET /api/workspaces/[workspaceId]/settlement/queue
 *
 * Returns the treasury reimbursement queue: expenses with valid current approvals
 * and no active/settled reimbursements.
 *
 * Requires: TREASURY_ROLE
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { SettlementService } from "@/lib/settlement/service";
import { tryGetSettlementConfig } from "@/lib/settlement/config";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;

    const db = getDatabaseClient();
    const service = new SettlementService(db);
    const config = tryGetSettlementConfig();

    const queue = await service.getTreasuryQueue(
      workspaceId,
      authContext,
      config?.token,
    );

    return NextResponse.json(queue, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
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
      error instanceof Error ? error.message : "Failed to load treasury queue.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
