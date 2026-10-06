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
    const { workspaceId } = await params;
    let db;
    try {
      db = getDatabaseClient();
    } catch {
      db = undefined;
    }

    const url = new URL(req.url);
    const addressParam = url.searchParams.get("address");
    const walletHeader = req.headers.get("x-wallet-address");

    let authAddress: string | null = null;
    if (db) {
      try {
        const authContext = requireAuth(req);
        const policy = new AuthorizationPolicy(db);
        await policy.getMembership(workspaceId, authContext);
        authAddress = authContext.address;
      } catch (authError) {
        // If neither session cookie nor query address was supplied, enforce 401
        if (!addressParam && !walletHeader) {
          throw authError;
        }
      }
    }

    const effectiveAddress = addressParam ?? walletHeader ?? authAddress;
    if (!effectiveAddress || !isValidAddress(effectiveAddress)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message: "A valid EVM address is required.",
          },
        },
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const chainIdParam = url.searchParams.get("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const service = new TransactionImportService(db);
    const result = await service.listCandidates(workspaceId, {
      address: effectiveAddress.toLowerCase() as `0x${string}`,
      chainId,
      limit,
      cursor,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 400;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status, headers: { "Content-Type": "application/json" } },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to import transactions.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
