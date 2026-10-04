import { NextResponse } from "next/server";
import {
  queryClarioCopilot,
  type CopilotMessage,
  type CopilotContext,
} from "@/lib/ai/copilot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, context } = body as {
      messages: CopilotMessage[];
      context: CopilotContext;
    };

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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Copilot error: ${msg}` },
      { status: 500 },
    );
  }
}
