/**
 * POST /api/workspaces/[workspaceId]/exports
 *
 * Generates a portable verification package archive after explicit caller
 * selection of FULL or REDACTED disclosure.
 */

import { NextResponse } from "next/server";
import { ProtocolError, type DisclosureLevel } from "@clario/protocol";
import { requireAuth } from "@/lib/auth/context";
import { RecordNotFoundError } from "@/lib/auth/policy";
import { getDatabaseClient } from "@/lib/db";
import { ExportService } from "@/lib/export";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

interface ExportRequestBody {
  disclosureLevel?: DisclosureLevel | undefined;
  expenseIds?: string[] | undefined;
  retentionHours?: number | undefined;
}

async function parseBody(req: Request): Promise<ExportRequestBody> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }
    return body as ExportRequestBody;
  } catch {
    return {};
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`exports:create:${clientIp}`, {
      maxRequests: 15,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many export requests. Please try again shortly.",
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

    const context = requireAuth(req);
    const { workspaceId } = await params;
    const body = await parseBody(req);

    const disclosureLevel = body.disclosureLevel;
    if (disclosureLevel !== "FULL" && disclosureLevel !== "REDACTED") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message: "disclosureLevel must be either FULL or REDACTED.",
          },
        },
        { status: 400 },
      );
    }

    const expenseIds = Array.isArray(body.expenseIds)
      ? body.expenseIds.filter(
          (expenseId): expenseId is string =>
            typeof expenseId === "string" && expenseId.trim().length > 0,
        )
      : undefined;

    const retentionHours =
      typeof body.retentionHours === "number" &&
      Number.isFinite(body.retentionHours) &&
      body.retentionHours > 0
        ? body.retentionHours
        : undefined;

    const service = new ExportService(getDatabaseClient());
    const result = await service.generateExportPackage(
      workspaceId,
      {
        disclosureLevel,
        expenseIds,
        retentionHours,
      },
      context,
    );

    return NextResponse.json(
      {
        ok: true,
        export: {
          exportId: result.exportId,
          workspaceId: result.workspaceId,
          disclosureLevel: result.disclosureLevel,
          packageHash: result.packageHash,
          manifest: result.manifest,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    if (error instanceof ProtocolError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 422;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate verification package.",
        },
      },
      { status: 500 },
    );
  }
}
