import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { verifyCsrfToken } from "@/lib/auth/session";
import { getDatabaseClient } from "@/lib/db";
import { ExpenseService } from "@/lib/expense/service";

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

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
      txHash?: string;
    };

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

    const db = getDatabaseClient();
    const service = new ExpenseService(db);

    const result = await service.reconcileSubmission({
      workspaceId,
      expenseId,
      txHash: body.txHash.toLowerCase() as `0x${string}`,
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
      error instanceof Error
        ? error.message
        : "Failed to reconcile submission.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
