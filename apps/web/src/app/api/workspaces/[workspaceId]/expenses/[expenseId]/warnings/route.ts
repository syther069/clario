import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { WarningService } from "@/lib/warnings/service";
import type { WarningDisposition } from "@/lib/warnings/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId, expenseId } = await params;
    const warnings = await new WarningService(getDatabaseClient()).getWarnings({
      workspaceId,
      expenseId,
      context,
    });
    return NextResponse.json({ ok: true, ...warnings }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId, expenseId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      warningId?: unknown;
      disposition?: unknown;
    };
    if (
      typeof body.warningId !== "string" ||
      typeof body.disposition !== "string"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "warningId and disposition are required.",
          },
        },
        { status: 400 },
      );
    }
    const disposition = await new WarningService(
      getDatabaseClient(),
    ).recordDisposition({
      workspaceId,
      expenseId,
      warningId: body.warningId,
      disposition: body.disposition as WarningDisposition,
      context,
    });
    return NextResponse.json({ ok: true, disposition }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof RecordNotFoundError) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ProtocolError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.code === "UNAUTHORIZED" ? 403 : 400 },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Warnings could not be evaluated.",
      },
    },
    { status: 500 },
  );
}
