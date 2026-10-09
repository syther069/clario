import { NextResponse } from "next/server";
import {
  queryClarioCopilot,
  type CopilotMessage,
  type CopilotContext,
} from "@/lib/ai/copilot";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { sanitizeErrorMessage } from "@/lib/security/safe-error";
import { parseSafeJson } from "@/lib/security/input-validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`ai:copilot:${clientIp}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many AI Copilot requests. Please wait before asking another question.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
          },
        },
      );
    }

    const body = await parseSafeJson<{
      messages: CopilotMessage[];
      context: CopilotContext;
    }>(req);
    const { messages, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: 'messages' array is required." },
        { status: 400 },
      );
    }

    const reply = await queryClarioCopilot(
      messages,
      context || {
        transactions: [],
        subscriptions: [],
        budgets: [],
        activeMode: "personal",
      },
    );

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const msg = sanitizeErrorMessage(error, "Failed to process request.");
    return NextResponse.json(
      { error: `Copilot error: ${msg}` },
      { status: 500 },
    );
  }
}
