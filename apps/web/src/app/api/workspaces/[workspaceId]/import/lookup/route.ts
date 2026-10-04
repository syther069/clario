import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { AuthorizationPolicy, RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { TransactionImportService } from "@/lib/import/service";
import { IMPORTED_FACTS_DISCLAIMER } from "@/lib/import/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const db = getDatabaseClient();

    // Verify workspace membership if session cookie is present
    try {
      const authContext = requireAuth(req);
      const policy = new AuthorizationPolicy(db);
      await policy.getMembership(workspaceId, authContext);
    } catch {
      // Allow public onchain hash lookup
    }

    const url = new URL(req.url);
    const chainIdParam = url.searchParams.get("chainId");
    const hashParam = url.searchParams.get("hash");

    if (!chainIdParam || !hashParam) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message: "Both chainId and hash query parameters are required.",
          },
        },
        { status: 400 },
      );
    }

    const chainId = parseInt(chainIdParam, 10);
    const service = new TransactionImportService(db);
    const candidate = await service.lookupByHash(
      workspaceId,
      chainId,
      hashParam,
    );

    if (!candidate) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Transaction not found on the specified chain.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        transaction: candidate,
        disclaimer: IMPORTED_FACTS_DISCLAIMER,
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
      error instanceof Error ? error.message : "Failed to lookup transaction.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
