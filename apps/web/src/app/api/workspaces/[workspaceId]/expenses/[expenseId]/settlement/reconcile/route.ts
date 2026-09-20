/**
 * POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/reconcile
 *
 * Records a submitted reimbursement transaction hash in the database.
 * Marks reimbursement as 'submitted' — NOT confirmed (confirmation requires receipt, SET-002).
 *
 * Requires: TREASURY_ROLE + recent wallet confirmation
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import {
  SettlementService,
  SettlementNotFoundError,
  SettlementPreConditionError,
} from "@/lib/settlement/service";
import {
  getSettlementConfig,
  SettlementConfigError,
} from "@/lib/settlement/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      version?: number;
      commitment?: string;
      transactionHash?: string;
      idempotencyKey?: string;
    };

    if (
      !body.transactionHash ||
      !/^0x[0-9a-fA-F]{64}$/.test(body.transactionHash)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "transactionHash must be a 0x-prefixed 64-hex string.",
          },
        },
        { status: 400 },
      );
    }

    if (
      typeof body.version !== "number" ||
      !Number.isInteger(body.version) ||
      body.version < 1
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "version must be a positive integer.",
          },
        },
        { status: 400 },
      );
    }

    if (!body.commitment || !/^0x[0-9a-fA-F]{64}$/.test(body.commitment)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "commitment must be a 0x-prefixed 32-byte hex string.",
          },
        },
        { status: 400 },
      );
    }

    if (!body.idempotencyKey || typeof body.idempotencyKey !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "idempotencyKey is required.",
          },
        },
        { status: 400 },
      );
    }

    const db = getDatabaseClient();
    const service = new SettlementService(db);
    const config = getSettlementConfig();

    const result = await service.reconcileSettlement(
      workspaceId,
      expenseId,
      body.version,
      body.commitment,
      body.transactionHash,
      body.idempotencyKey,
      authContext,
      config.token,
      config.chainId,
      config.registryAddress,
    );

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    if (
      error instanceof SettlementNotFoundError ||
      error instanceof RecordNotFoundError
    ) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof SettlementPreConditionError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 },
      );
    }
    if (error instanceof SettlementConfigError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 422;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reconcile settlement.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
