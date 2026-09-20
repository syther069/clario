import { NextResponse } from "next/server";
import { parseWorkspaceId, ProtocolError } from "@clario/protocol";
import { requireWorkspaceAccess } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { EventIndexerService } from "@/lib/indexer/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: rawWorkspaceId } = await params;
    const workspaceId = parseWorkspaceId(rawWorkspaceId);
    const db = getDatabaseClient();

    await requireWorkspaceAccess(db, req, workspaceId);

    const indexer = new EventIndexerService(db);

    const [workspaceProj, rolesProj, policiesProj] = await Promise.all([
      indexer.getWorkspaceProjection(workspaceId),
      indexer.getRoleGrantsProjection(workspaceId),
      indexer.getPolicyVersionsProjection(workspaceId),
    ]);

    const sanitizedProjection = JSON.parse(
      JSON.stringify(
        {
          workspace: workspaceProj,
          roleGrants: rolesProj,
          policyVersions: policiesProj,
          activeRoleCount: rolesProj.filter((r) => r.active).length,
        },
        (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      ),
    );

    return NextResponse.json(
      {
        ok: true,
        workspaceId,
        projection: sanitizedProjection,
      },
      { status: 200 },
    );
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
        : "Failed to retrieve indexer status.";
    return NextResponse.json(
      { error: { code: "INDEXER_ERROR", message } },
      { status: 500 },
    );
  }
}
