import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { AiExtractionError, AiExtractionService } from "@/lib/ai/service";
import { getDatabaseClient } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId, expenseId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      evidenceIds?: unknown;
      consent?: unknown;
    };
    if (
      !Array.isArray(body.evidenceIds) ||
      !body.evidenceIds.every((id) => typeof id === "string")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "evidenceIds must be an array of evidence identifiers.",
          },
        },
        { status: 400 },
      );
    }
    const service = new AiExtractionService(getDatabaseClient());
    const result = await service.runExtraction({
      workspaceId,
      expenseId,
      evidenceIds: body.evidenceIds,
      consent: body.consent === true,
      context,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof AiExtractionError) {
      const status =
        error.code === "AI_PROVIDER_DISABLED"
          ? 503
          : error.code.includes("PROVIDER") || error.code.includes("TIMEOUT")
            ? 503
            : 400;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            manualFallback: true,
          },
        },
        { status },
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
          message: "AI extraction failed. Continue with manual entry.",
          manualFallback: true,
        },
      },
      { status: 500 },
    );
  }
}
