import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { AuthorizationPolicy, RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { TransactionImportService } from "@/lib/import/service";
import {
  type NormalizedTransaction,
  IMPORTED_FACTS_DISCLAIMER,
} from "@/lib/import/types";

export async function POST(
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

    const body = (await req.json().catch(() => ({}))) as {
      expenseId?: string;
      transaction?: NormalizedTransaction;
      claimSlot?: number;
    };

    if (!body.expenseId || !body.transaction) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message: "Both expenseId and transaction are required.",
          },
        },
        { status: 400 },
      );
    }

    const service = new TransactionImportService(db);
    const claim = await service.claimTransaction({
      workspaceId,
      expenseId: body.expenseId,
      transaction: body.transaction,
      claimSlot: body.claimSlot,
    });

    return NextResponse.json(
      {
        ok: true,
        claim,
        disclaimer: IMPORTED_FACTS_DISCLAIMER,
      },
      { status: 201 },
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
      error instanceof Error ? error.message : "Failed to claim transaction.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
