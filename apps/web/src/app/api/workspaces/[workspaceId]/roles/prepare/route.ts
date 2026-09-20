import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { WorkspaceService } from "@/lib/workspace/service";
import type { RoleAction } from "@/lib/workspace/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      action?: unknown;
      account?: unknown;
      role?: unknown;
      scope?: unknown;
    };

    if (body.action !== "grant" && body.action !== "revoke") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "action must be 'grant' or 'revoke'.",
          },
        },
        { status: 400 },
      );
    }

    if (
      typeof body.account !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(body.account)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "account must be a valid 20-byte EVM address.",
          },
        },
        { status: 400 },
      );
    }

    if (typeof body.role !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "role identifier or name is required.",
          },
        },
        { status: 400 },
      );
    }

    const scope = typeof body.scope === "string" ? body.scope : undefined;

    const db = getDatabaseClient();
    const service = new WorkspaceService(db);

    const preparedTransaction = await service.prepareRoleChange(
      {
        workspaceId,
        action: body.action as RoleAction,
        account: body.account as `0x${string}`,
        role: body.role,
        scope,
      },
      authContext,
    );

    return NextResponse.json(
      { ok: true, preparedTransaction },
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
        : "Failed to prepare role transaction.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
