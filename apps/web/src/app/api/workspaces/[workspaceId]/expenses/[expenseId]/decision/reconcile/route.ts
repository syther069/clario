import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { verifyCsrfToken } from "@/lib/auth/session";
import { getDatabaseClient } from "@/lib/db";
import { ReviewDecisionService } from "@/lib/review/decision-service";
import type { DecisionType } from "@/lib/review/decision";

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;
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

    // Verify CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!csrfToken || !verifyCsrfToken(authContext.session, csrfToken)) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or missing CSRF token.",
          },
        },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      version?: number;
      decision?: string;
      txHash?: string;
      reason?: string;
      signature?: string;
      nonce?: number;
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

    if (
      !body.txHash ||
      typeof body.txHash !== "string" ||
      !TX_HASH_REGEX.test(body.txHash)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Valid 0x-prefixed 64-character txHash is required.",
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

    const result = await service.reconcileDecision({
      workspaceId,
      expenseId,
      version: body.version,
      decision,
      txHash: body.txHash,
      reason: body.reason,
      signature: body.signature,
      nonce: body.nonce,
      context: authContext,
    });

    return NextResponse.json({ ok: true, result }, { status: 200 });
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
      error instanceof Error ? error.message : "Failed to reconcile decision.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
