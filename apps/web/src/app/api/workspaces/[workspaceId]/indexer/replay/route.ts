import { NextResponse } from "next/server";
import { parseWorkspaceId, ProtocolError } from "@clario/protocol";
import { requireWorkspaceAccess } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { EventIndexerService } from "@/lib/indexer/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: rawWorkspaceId } = await params;
    const workspaceId = parseWorkspaceId(rawWorkspaceId);
    const db = getDatabaseClient();

    const { policy, membership } = await requireWorkspaceAccess(
      db,
      req,
      workspaceId,
    );

    if (!membership.isOwner && !policy.hasRole(membership, "ADMIN_ROLE")) {
      throw new ProtocolError("UNAUTHORIZED", {
        message:
          "Only workspace owners or administrators can replay event projections.",
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const chainId = BigInt(body.chainId ? String(body.chainId) : "31337");
    const fromBlock = BigInt(body.fromBlock ? String(body.fromBlock) : "0");

    const indexer = new EventIndexerService(db);
    const result = await indexer.rebuildProjections(chainId, fromBlock);

    const sanitizedResult = JSON.parse(
      JSON.stringify(result, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );

    return NextResponse.json(
      {
        ok: true,
        workspaceId,
        result: sanitizedResult,
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
        : "Failed to replay indexer projections.";
    return NextResponse.json(
      { error: { code: "INDEXER_REPLAY_ERROR", message } },
      { status: 500 },
    );
  }
}
