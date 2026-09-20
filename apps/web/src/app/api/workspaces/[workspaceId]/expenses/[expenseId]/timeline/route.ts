import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";
import {
  TimelineAuthorizationError,
  TimelineNotFoundError,
  TimelineService,
} from "@/lib/timeline";

function safeJsonSerialize(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

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

    const db = getDatabaseClient();
    const service = new TimelineService(db);

    const timeline = await service.getExpenseTimeline(workspaceId, expenseId, {
      userId: authContext.userId,
      address: authContext.address,
    });

    return NextResponse.json(safeJsonSerialize(timeline), { status: 200 });
  } catch (error) {
    if (error instanceof TimelineAuthorizationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 403 },
      );
    }
    if (error instanceof TimelineNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
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
        : "Failed to retrieve expense timeline.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
