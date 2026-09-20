import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ReviewService } from "@/lib/review/service";
import type { ReviewQueueFilter } from "@/lib/review/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;
    const url = new URL(req.url);

    const statusParam = url.searchParams.get("status") as
      "pending" | "all" | "approved" | "rejected" | "changes_requested" | null;
    const assignedTo = url.searchParams.get("assignedTo") as
      "me" | "all" | null;

    const filter: ReviewQueueFilter = {
      status: statusParam ?? "pending",
      assignedTo: assignedTo ?? "all",
    };

    const db = getDatabaseClient();
    const service = new ReviewService(db);

    const queue = await service.getReviewQueue({
      workspaceId,
      context: authContext,
      filter,
    });

    return NextResponse.json({ ok: true, ...queue }, { status: 200 });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof ProtocolError) {
      let status = 400;
      if (error.code === "UNAUTHORIZED") {
        status =
          error.message.toLowerCase().includes("session") ||
          error.message.toLowerCase().includes("authenticat")
            ? 401
            : 403;
      }
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to load review queue.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
