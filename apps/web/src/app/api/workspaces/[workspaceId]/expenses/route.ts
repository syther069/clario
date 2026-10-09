import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";
import { ExpenseService } from "@/lib/expense/service";
import type { ExpenseDraftPayload } from "@/lib/expense/types";
import { handleSafeApiError } from "@/lib/security/safe-error";
import { parseSafeJson } from "@/lib/security/input-validation";

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
    return handleSafeApiError(error, "Failed to list expenses.");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;
    const body = await parseSafeJson<{
      payload?: Record<string, unknown>;
    }>(req);

    const db = getDatabaseClient();
    const service = new ExpenseService(db);

    const draft = await service.createDraft({
      workspaceId,
      payload: (body.payload ?? {}) as Partial<ExpenseDraftPayload>,
      context: authContext,
    });

    return NextResponse.json({ ok: true, draft }, { status: 201 });
  } catch (error) {
    return handleSafeApiError(error, "Failed to create expense draft.");
  }
}
