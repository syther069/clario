import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { AiExtractionError, AiExtractionService } from "@/lib/ai/service";
import type { AiDisposition } from "@/lib/ai/types";
import { getDatabaseClient } from "@/lib/db";

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{
      workspaceId: string;
      expenseId: string;
      analysisId: string;
    }>;
  },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId, expenseId, analysisId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      disposition?: AiDisposition;
      corrections?: Record<string, string | null>;
    };
    if (!body.disposition || body.disposition === "pending") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "A final human disposition is required.",
          },
        },
        { status: 400 },
      );
    }
    const result = await new AiExtractionService(
      getDatabaseClient(),
    ).recordDisposition({
      workspaceId,
      expenseId,
      analysisId,
      disposition: body.disposition,
      ...(body.corrections ? { corrections: body.corrections } : {}),
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
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }
    if (error instanceof ProtocolError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not record the AI suggestion disposition.",
        },
      },
      { status: 500 },
    );
  }
}
