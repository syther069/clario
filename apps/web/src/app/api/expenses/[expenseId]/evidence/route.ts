import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { EvidenceService } from "@/lib/evidence/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { expenseId } = await params;

    let workspaceId: string | undefined;
    let version: number | undefined;
    let fileBuffer: Buffer | undefined;
    let mimeType = "application/octet-stream";
    let filename: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      workspaceId = formData.get("workspaceId")?.toString();
      const verStr = formData.get("version")?.toString();
      version = verStr ? parseInt(verStr, 10) : undefined;

      const file = formData.get("file");
      if (file instanceof Blob) {
        const arrayBuf = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuf);
        mimeType = file.type || "application/octet-stream";
        if ("name" in file && typeof file.name === "string") {
          filename = file.name;
        }
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        workspaceId?: unknown;
        version?: unknown;
        data?: unknown;
        mimeType?: unknown;
        filename?: unknown;
      };

      workspaceId =
        typeof body.workspaceId === "string" ? body.workspaceId : undefined;
      version =
        typeof body.version === "number"
          ? body.version
          : typeof body.version === "string"
            ? parseInt(body.version, 10)
            : undefined;
      mimeType = typeof body.mimeType === "string" ? body.mimeType : mimeType;
      filename = typeof body.filename === "string" ? body.filename : undefined;

      if (typeof body.data === "string") {
        fileBuffer = Buffer.from(body.data, "base64");
      }
    }

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "workspaceId is required.",
          },
        },
        { status: 400 },
      );
    }

    if (typeof version !== "number" || isNaN(version) || version < 1) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "version must be a positive integer.",
          },
        },
        { status: 400 },
      );
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "File data is required and cannot be empty.",
          },
        },
        { status: 400 },
      );
    }

    const db = getDatabaseClient();
    const service = new EvidenceService(db);

    const result = await service.uploadEvidence({
      workspaceId,
      expenseId,
      version,
      data: fileBuffer,
      mimeType,
      context: authContext,
      filename,
    });

    return NextResponse.json({ ok: true, evidence: result }, { status: 201 });
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
      error instanceof Error ? error.message : "Evidence upload failed.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
