import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getServerConfiguration } from "@/config/server";
import { createAuthChallenge } from "@/lib/auth/challenge";

export async function POST(req: Request) {
  try {
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
