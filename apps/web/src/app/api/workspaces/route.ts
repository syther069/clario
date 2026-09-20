import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";
import { WorkspaceService } from "@/lib/workspace/service";

export async function GET(req: Request) {
  try {
    const authContext = requireAuth(req);
    const db = getDatabaseClient();
    const service = new WorkspaceService(db);

    const workspaces = await service.listUserWorkspaces(authContext);
    return NextResponse.json({ ok: true, workspaces }, { status: 200 });
  } catch (error) {
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to list workspaces.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authContext = requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      policyCommitment?: unknown;
    };

    if (typeof body.name !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Workspace name is required.",
          },
        },
        { status: 400 },
      );
    }

    const policyCommitment =
      typeof body.policyCommitment === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(body.policyCommitment)
        ? (body.policyCommitment as `0x${string}`)
        : undefined;

    const db = getDatabaseClient();
    const service = new WorkspaceService(db);

    const result = await service.createWorkspace({
      name: body.name,
      context: authContext,
      policyCommitment,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof ProtocolError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "INVALID_IDENTIFIER"
            ? 400
            : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to create workspace.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
