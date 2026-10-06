import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";
import { WorkspaceService } from "@/lib/workspace/service";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { handleSafeApiError } from "@/lib/security/safe-error";

export async function GET(req: Request) {
  try {
    const authContext = requireAuth(req);
    const db = getDatabaseClient();
    const service = new WorkspaceService(db);

    const workspaces = await service.listUserWorkspaces(authContext);
    return NextResponse.json({ ok: true, workspaces }, { status: 200 });
  } catch (error) {
    return handleSafeApiError(error, "Failed to list workspaces.");
  }
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    // Rate limit workspace creations to 10 per minute per IP
    const rateCheck = checkRateLimit(`workspaces:create:${clientIp}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many workspace creation attempts. Please retry shortly.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
          },
        },
      );
    }

    const authContext = requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      policyCommitment?: unknown;
    };

    if (typeof body.name !== "string" || body.name.trim().length === 0) {
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

    // Backend validation: restrict excessive string lengths (Prompt 4 of Security Pack)
    if (body.name.trim().length > 64) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Workspace name cannot exceed 64 characters.",
          },
        },
        { status: 400 },
      );
    }

    const trimmedName = body.name.trim();

    const policyCommitment =
      typeof body.policyCommitment === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(body.policyCommitment)
        ? (body.policyCommitment as `0x${string}`)
        : undefined;

    const db = getDatabaseClient();
    const service = new WorkspaceService(db);

    const result = await service.createWorkspace({
      name: trimmedName,
      context: authContext,
      policyCommitment,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return handleSafeApiError(error, "Failed to create workspace.");
  }
}
