"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  type CopilotMessage,
  type CopilotContext,
  detectFinancialAnomalies,
} from "@/lib/ai/copilot";
import { TextRoll, ArrowIcon } from "@/components/ui/skiper-effects";

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotContext;
}

export function CopilotDrawer({
  isOpen,
  onClose,
  context,
}: CopilotDrawerProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: "assistant",
      content: `Hello! I am Clario. I analyze your cash flows, track subscriptions, inspect OCR receipts, and verify cryptographic proof records. What would you like to explore today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const insights = useMemo(() => detectFinancialAnomalies(context), [context]);

  const samplePrompts =
    context.activeMode === "freelancer"
      ? [
          "What are my total deductible expenses this year?",
          "Summarize my unpaid client invoices",
          "Calculate my estimated quarterly tax reserve",
          "Which client generated the highest revenue?",
        ]
      : context.activeMode === "family"
        ? [
            "What is our total household spend this month?",
            "Which bills are due in the next 14 days?",
            "Who owes money in our household settlements?",
            "How are our shared grocery and utility budgets?",
          ]
        : context.activeMode === "business"
          ? [
              "What is our corporate spend velocity across departments?",
              "Are there any pending reimbursement claims to approve?",
              "Check for any expense policy violations",
              "Summarize corporate software and travel expenses",
            ]
          : [
              "What is my net cash flow this month?",
              "Analyze my recurring subscriptions",
              "How much have I spent on food & dining?",
              "Check my verified receipt proofs on Monad",
            ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  async function handleSend(textToSend?: string) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: CopilotMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          context,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: data.reply || "Sorry, I couldn't process that query.",
        },
      ]);
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "Encountered a connection error contacting the financial analysis service. Please verify your network and AI API keys.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Slide Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-2 border-[#121212] bg-white shadow-[-6px_0_0_0_rgba(18,18,18,0.1)] text-[#121212]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#121212] px-6 py-4 bg-[#f8f9fa]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                <TextRoll className="text-base font-black">
                  Clario
                </TextRoll>
                <span className="neo-badge neo-badge-purple">ASSISTANT</span>
              </h2>
              <p className="text-xs text-slate-500">
                Zero hallucination · Monad-anchored records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close Clario"
              className="size-11 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Real-time Anomalies & Multi-Mode Insights Banner */}
        {insights.length > 0 && (
          <div className="border-b-2 border-[#121212] bg-[#fffbeb] px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-600"
                  aria-hidden="true"
                />
                <span>Detected Intelligence Signals ({insights.length})</span>
              </span>
              <span className="text-[9px] font-mono uppercase bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded border border-amber-900 font-bold">
                Rule 40 Grounded
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {insights.map((ins) => (
                <button
                  key={ins.id}
                  onClick={() =>
                    ins.actionPrompt && handleSend(ins.actionPrompt)
                  }
                  className={`shrink-0 text-left px-2.5 py-1.5 rounded-lg border-2 border-[#121212] text-[11px] transition shadow-[1px_1px_0_0_#121212] ${
                    ins.type === "warning"
                      ? "bg-rose-50 hover:bg-rose-100 text-rose-900"
                      : ins.type === "compliance"
                        ? "bg-purple-50 hover:bg-purple-100 text-purple-900"
                        : "bg-white hover:bg-slate-50 text-slate-900"
                  }`}
                >
                  <div className="font-bold text-[11px] leading-tight flex items-center gap-1">
                    <span>{ins.title}</span>
                  </div>
                  <div className="text-[9px] text-slate-600 font-medium truncate max-w-[200px]">
                    {ins.message}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-grid">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black border-2 border-[#121212] shadow-[1px_1px_0_0_#121212] ${
                  m.role === "user"
                    ? "bg-[#836EF9] text-white"
                    : "bg-white text-[#836EF9]"
                }`}
              >
                {m.role === "user" ? (
                  <User className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Bot className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              <div
                className={`rounded-xl px-4 py-3 text-xs leading-relaxed max-w-[85%] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] ${
                  m.role === "user"
                    ? "bg-[#836EF9] text-white"
                    : "bg-white text-[#121212] whitespace-pre-wrap"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#836EF9] border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]">
                <Loader2
                  className="h-4 w-4 animate-spin text-[#836EF9]"
                  aria-hidden="true"
                />
              </div>
              <div className="rounded-xl bg-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] px-4 py-3 text-xs text-slate-600 font-semibold">
                Analyzing ledger data and calculating metrics...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        <div className="border-t-2 border-[#121212] px-6 py-3 bg-[#f8f9fa]">
          <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                disabled={loading}
                className="group shrink-0 inline-flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-white px-3 py-1 text-slate-800 font-bold transition hover:bg-[#f3f0ff] hover:text-[#836EF9] shadow-[1px_1px_0_0_#121212]"
              >
                <span>{p}</span>
                <div className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                  <ArrowIcon />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <div className="border-t-2 border-[#121212] p-4 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your finances or ledger..."
              className="flex-1 neo-input"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message to Clario"
              className="neo-btn neo-btn-primary min-w-[44px] min-h-[44px] size-11 p-0 shrink-0 inline-flex items-center justify-center"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
