import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { AuthorizationPolicy, RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { TransactionImportService } from "@/lib/import/service";
import { isValidAddress } from "@/lib/expense/amount";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId } = await params;
    const db = getDatabaseClient();

    // Verify workspace membership
    const policy = new AuthorizationPolicy(db);
    await policy.getMembership(workspaceId, authContext);

    const url = new URL(req.url);
    const addressParam = url.searchParams.get("address") ?? authContext.address;
    if (!isValidAddress(addressParam)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message: "A valid EVM address is required.",
          },
        },
        { status: 400 },
      );
    }

    const chainIdParam = url.searchParams.get("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const service = new TransactionImportService(db);
    const result = await service.listCandidates(workspaceId, {
      address: addressParam.toLowerCase() as `0x${string}`,
      chainId,
      limit,
      cursor,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
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
      error instanceof Error ? error.message : "Failed to import transactions.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
