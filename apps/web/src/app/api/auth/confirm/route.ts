import { NextResponse } from "next/server";
import { verifyMessage, type Hex } from "viem";
import { getSessionSecret, requireAuth } from "@/lib/auth/context";
import { rotateSession, serializeSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const secret = getSessionSecret();
    const context = requireAuth(req, { secret });

    const body = await req.json().catch(() => ({}));
    const { message, signature } = body as {
      message?: unknown;
      signature?: unknown;
    };

    if (typeof message !== "string" || typeof signature !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TYPED_DATA",
            message:
              "Both message and signature must be provided for wallet confirmation.",
          },
        },
        { status: 400 },
      );
    }

    // Verify that the signature is from the authenticated session's wallet address
    const isValid = await verifyMessage({
      address: context.address,
      message,
      signature: signature as Hex,
    });

    if (!isValid) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message:
              "Confirmation signature does not match authenticated wallet.",
          },
        },
        { status: 401 },
      );
    }

    // Rotate session with updated confirmation timestamp
    const { token, payload } = rotateSession(context.session, secret, {
      refreshConfirmation: true,
    });

    const isSecure =
      process.env.NODE_ENV === "production" || req.url.startsWith("https://");

    const cookieValue = serializeSessionCookie(token, { secure: isSecure });

    const response = NextResponse.json(
      {
        ok: true,
        lastConfirmedAt: payload.lastConfirmedAt,
      },
      { status: 200 },
    );

    response.headers.set("Set-Cookie", cookieValue);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Confirmation failed.";
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message,
        },
      },
      { status: 401 },
    );
  }
}
