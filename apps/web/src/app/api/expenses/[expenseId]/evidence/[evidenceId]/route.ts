import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { EvidenceService } from "@/lib/evidence/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ expenseId: string; evidenceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { expenseId, evidenceId } = await params;

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const preview = url.searchParams.get("preview") === "true";

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "workspaceId query parameter is required.",
          },
        },
        { status: 400 },
      );
    }

    const db = getDatabaseClient();
    const service = new EvidenceService(db);

    const result = await service.downloadEvidence({
      workspaceId,
      expenseId,
      evidenceId,
      context: authContext,
    });

    const disposition = preview
      ? "inline"
      : `attachment; filename="evidence-${evidenceId}"`;

    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": result.byteLength.toString(),
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }

    if (error instanceof ProtocolError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "INVALID_LIFECYCLE_TRANSITION"
            ? 409
            : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Evidence download failed.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ expenseId: string; evidenceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { expenseId, evidenceId } = await params;

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "workspaceId query parameter is required.",
          },
        },
        { status: 400 },
      );
    }

    const db = getDatabaseClient();
    const service = new EvidenceService(db);

    await service.deleteEvidence({
      workspaceId,
      expenseId,
      evidenceId,
      context: authContext,
    });

    return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }

    if (error instanceof ProtocolError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "INVALID_LIFECYCLE_TRANSITION"
            ? 409
            : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Evidence deletion failed.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
