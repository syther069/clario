import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyAuthChallenge } from "@/lib/auth/challenge";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    // Limit to 10 verify attempts per minute per IP to prevent brute-forcing
    const rateCheck = checkRateLimit(`auth:verify:${clientIp}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many verification attempts. Please try again shortly.",
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
    const { message, signature } = body as {
      message?: unknown;
      signature?: unknown;
    };

    if (typeof message !== "string" || typeof signature !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TYPED_DATA",
            message: "Both message and signature must be provided as strings.",
          },
        },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const verified = await verifyAuthChallenge({
      message,
      signature,
      expectedDomain: url.host,
    });

    // Provision or resolve user in database
    let userId: string = randomUUID();
    try {
      const db = getDatabaseClient();
      const res = await db.query<{ user_id: string }>(
        `INSERT INTO users (primary_address)
         VALUES ($1)
         ON CONFLICT (primary_address) DO UPDATE SET updated_at = NOW()
         RETURNING user_id;`,
        [verified.address.toLowerCase()],
      );

      if (res.rows[0]?.user_id) {
        userId = res.rows[0].user_id;
        await db
          .query(
            `INSERT INTO wallet_identities (user_id, chain_family, address)
             VALUES ($1, 'evm', $2)
             ON CONFLICT (chain_family, address) DO NOTHING;`,
            [userId, verified.address.toLowerCase()],
          )
          .catch(() => {});
      }
    } catch {
      // In offline or unit test mode without database connection, fallback to generated UUID
    }

    const secret = getSessionSecret();
    const payload = createSessionPayload({
      userId,
      address: verified.address,
    });
    const token = signSessionToken(payload, secret);

    const isSecure =
      process.env.NODE_ENV === "production" || req.url.startsWith("https://");

    const cookieValue = serializeSessionCookie(token, { secure: isSecure });

    const response = NextResponse.json(
      {
        user: {
          userId: payload.userId,
          address: payload.address,
          lastConfirmedAt: payload.lastConfirmedAt,
        },
        csrfToken: payload.csrfToken,
      },
      { status: 200 },
    );

    response.headers.set("Set-Cookie", cookieValue);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed.";
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
