/**
 * POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/prepare
 *
 * Prepares a reimbursement for the current approved expense version.
 * Returns calldata for ClarioSettlementRegistryV1.reimburse() and ERC-20 approve() if needed.
 *
 * Requires: TREASURY_ROLE + recent wallet confirmation
 * Does NOT broadcast a transaction.
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
  type SettlementSimulationOptions,
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
      treasuryBalance?: string;
      treasuryAllowance?: string;
    };

    const simulationOptions: SettlementSimulationOptions | undefined =
      body.treasuryBalance !== undefined || body.treasuryAllowance !== undefined
        ? {
            treasuryBalance:
              body.treasuryBalance !== undefined
                ? BigInt(body.treasuryBalance)
                : undefined,
            treasuryAllowance:
              body.treasuryAllowance !== undefined
                ? BigInt(body.treasuryAllowance)
                : undefined,
          }
        : undefined;

    const db = getDatabaseClient();
    const service = new SettlementService(db);
    const config = getSettlementConfig();

    const prepared = await service.prepareSettlement(
      workspaceId,
      expenseId,
      authContext,
      config.token,
      config.registryAddress,
      config.chainId,
      simulationOptions,
    );

    return NextResponse.json({ ok: true, prepared }, { status: 200 });
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
      error instanceof Error ? error.message : "Failed to prepare settlement.";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 },
    );
  }
}
