import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ReviewService } from "@/lib/review/service";

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ workspaceId: string; expenseId: string }>;
  },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;
    const url = new URL(req.url);

    const versionParam = url.searchParams.get("version");
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    const db = getDatabaseClient();
    const service = new ReviewService(db);

    const reviewDetail = await service.getReviewDetail({
      workspaceId,
      expenseId,
      version,
      context: authContext,
    });

    return NextResponse.json(
      { ok: true, review: reviewDetail },
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
      error instanceof Error ? error.message : "Failed to load review detail.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
