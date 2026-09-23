/**
 * GET /api/workspaces/[workspaceId]/exports/preview
 *
 * Returns a disclosure preview before generating a verification package.
 * The service enforces exporter authority and recent wallet confirmation.
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ExportService } from "@/lib/export";

function parseExpenseIds(req: Request): string[] | undefined {
  const url = new URL(req.url);
  const expenseIds = url.searchParams
    .getAll("expenseId")
    .map((value) => value.trim())
    .filter(Boolean);
  return expenseIds.length > 0 ? expenseIds : undefined;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId } = await params;

    const service = new ExportService(getDatabaseClient());
    const preview = await service.previewDisclosure(
      workspaceId,
      { expenseIds: parseExpenseIds(req) },
      context,
    );

    return NextResponse.json({ ok: true, preview }, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 422;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to preview verification package disclosure.",
        },
      },
      { status: 500 },
    );
  }
}
