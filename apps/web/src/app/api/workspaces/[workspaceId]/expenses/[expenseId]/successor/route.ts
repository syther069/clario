import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { verifyCsrfToken } from "@/lib/auth/session";
import { getDatabaseClient } from "@/lib/db";
import { ReviewDecisionService } from "@/lib/review/decision-service";
import type { ExpenseDraftPayload } from "@/lib/expense/types";

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
      payloadUpdates?: Partial<ExpenseDraftPayload>;
    };

    const db = getDatabaseClient();
    const service = new ReviewDecisionService(db);

    const draft = await service.createSuccessorDraft({
      workspaceId,
      expenseId,
      payloadUpdates: body.payloadUpdates,
      context: authContext,
    });

    return NextResponse.json({ ok: true, draft }, { status: 201 });
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
        : "Failed to create successor draft.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
