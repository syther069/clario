import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ExpenseService } from "@/lib/expense/service";
import type { ExpenseDraftPayload } from "@/lib/expense/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") ?? undefined;

    const db = getDatabaseClient();
    const service = new ExpenseService(db);

    const expenses = await service.listExpenses({
      workspaceId,
      context: authContext,
      statusFilter,
    });

    return NextResponse.json({ ok: true, expenses }, { status: 200 });
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
      error instanceof Error ? error.message : "Failed to list expenses.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      payload?: Record<string, unknown>;
    };

    const db = getDatabaseClient();
    const service = new ExpenseService(db);

    const draft = await service.createDraft({
      workspaceId,
      payload: body.payload as Partial<ExpenseDraftPayload>,
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
        : "Failed to create expense draft.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
