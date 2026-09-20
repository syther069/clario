import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ReviewDecisionService } from "@/lib/review/decision-service";
import type { DecisionType } from "@/lib/review/decision";

const VALID_DECISIONS: Set<DecisionType> = new Set([
  "approve",
  "reject",
  "request_changes",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      version?: number;
      decision?: string;
      reason?: string;
    };

    if (
      typeof body.version !== "number" ||
      !Number.isInteger(body.version) ||
      body.version < 1
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "A positive integer version is required.",
          },
        },
        { status: 400 },
      );
    }

    if (!body.decision || !VALID_DECISIONS.has(body.decision as DecisionType)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Decision must be one of 'approve', 'reject', or 'request_changes'.",
          },
        },
        { status: 400 },
      );
    }

    const decision = body.decision as DecisionType;

    if (
      (decision === "reject" || decision === "request_changes") &&
      (!body.reason || body.reason.trim().length === 0)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Reason is strictly required for rejection or requesting changes.",
          },
        },
        { status: 400 },
      );
    }

    const db = getDatabaseClient();
    const service = new ReviewDecisionService(db);

    const prepared = await service.prepareDecision({
      workspaceId,
      expenseId,
      version: body.version,
      decision,
      reason: body.reason,
      context: authContext,
    });

    return NextResponse.json({ ok: true, prepared }, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to prepare decision intent.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
