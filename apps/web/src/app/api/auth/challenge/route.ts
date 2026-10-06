import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getServerConfiguration } from "@/config/server";
import { createAuthChallenge } from "@/lib/auth/challenge";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    // Limit to 20 challenge requests per minute per IP
    const rateCheck = checkRateLimit(`auth:challenge:${clientIp}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many challenge requests. Please try again shortly.",
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

    const body = await req.json().catch(() => ({}));
    const { address } = body as { address?: unknown };

    if (!address || typeof address !== "string" || !isAddress(address)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_IDENTIFIER",
            message:
              "A valid Ethereum address is required to request a challenge.",
          },
        },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const domain = (body as { domain?: string }).domain ?? url.host;
    const uri = (body as { uri?: string }).uri ?? url.origin;

    let chainId: number;
    try {
      const config = getServerConfiguration();
      chainId = config.chain.chainId;
    } catch {
      // Default to 31337 (local Anvil / Foundry) when running in unconfigured or test environment
      chainId = (body as { chainId?: number }).chainId ?? 31337;
    }

    const challenge = await createAuthChallenge({
      address,
      chainId,
      domain,
      uri,
    });

    return NextResponse.json({ challenge }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create challenge.";
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}
