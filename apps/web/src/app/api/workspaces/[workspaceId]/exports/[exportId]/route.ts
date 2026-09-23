/**
 * GET /api/workspaces/[workspaceId]/exports/[exportId]
 *
 * Downloads a previously generated verification package archive while
 * enforcing workspace authorization and retention expiry.
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ExportService } from "@/lib/export";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; exportId: string }> },
) {
  try {
    const context = requireAuth(req);
    const { workspaceId, exportId } = await params;

    const service = new ExportService(getDatabaseClient());
    const stored = await service.getExportPackage(
      workspaceId,
      exportId,
      context,
    );

    return new NextResponse(new Uint8Array(stored.data), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(stored.data.length),
        "Content-Disposition": `attachment; filename="clario-${stored.workspaceId}-${stored.exportId}.zip"`,
        "X-Clario-Package-Hash": stored.packageHash,
        "Cache-Control": "private, no-store",
      },
    });
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
          message: "Failed to retrieve verification package.",
        },
      },
      { status: 500 },
    );
  }
}
