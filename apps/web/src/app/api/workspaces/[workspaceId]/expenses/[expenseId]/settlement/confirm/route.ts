/**
 * POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/confirm
 *
 * Confirms a settlement execution by validating transaction receipt logs onchain.
 * Emits audit event and updates operational and projection tables upon validation.
 *
 * Invariants enforced (RULES §10, SET-002):
 * - Requires TREASURY_ROLE + recent wallet confirmation.
 * - SUBMITTED state is NEVER returned as confirmed without validated receipt.
 * - Validates SettlementRecorded event against expected contract, token, recipient, amount, version, commitment.
 * - Validates ERC-20 Transfer event.
 * - Reverted transactions update status to 'failed' and allow safe retry.
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
import type { MinimalTransactionReceipt } from "@/lib/settlement/receipt";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; expenseId: string }> },
) {
  try {
    const authContext = requireAuth(req);
    const { workspaceId, expenseId } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      receipt?: MinimalTransactionReceipt;
      transactionHash?: string;
      rpcUrl?: string;
    };

    if (!body.receipt && !body.transactionHash) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Either a transaction receipt or transactionHash is required to confirm settlement.",
          },
        },
        { status: 400 },
      );
    }

    if (
      body.transactionHash &&
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

    const db = getDatabaseClient();
    const service = new SettlementService(db);
    const config = getSettlementConfig();

    const result = await service.confirmSettlement(
      workspaceId,
      expenseId,
      authContext,
      {
        receipt: body.receipt,
        transactionHash: body.transactionHash,
        rpcUrl: body.rpcUrl ?? config.rpcUrl,
        chainId: config.chainId,
        registryAddress: config.registryAddress,
        tokenConfig: config.token,
      },
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
      error instanceof Error ? error.message : "Failed to confirm settlement.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
