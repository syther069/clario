"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormFieldFeedbackProps {
  /** Error message to display inline */
  error?: string | null;
  /** Helper text or requirement reminder */
  hint?: string | null;
  /** Current character count */
  charCount?: number;
  /** Maximum character count allowed */
  maxCharCount?: number;
  /** Success validation message */
  success?: string | null;
  className?: string;
}

/**
 * Montally Neo-Brutalist Inline Form Feedback
 * Renders direct, high-contrast, monospace validation alerts inline next to the input
 * avoiding disruptive modals or silent toast dismissals.
 */
export function FormFieldFeedback({
  error,
  hint,
  charCount,
  maxCharCount,
  success,
  className,
}: FormFieldFeedbackProps) {
  const hasCharCount = charCount !== undefined && maxCharCount !== undefined;
  const isOverLimit = hasCharCount && charCount > maxCharCount;

  if (!error && !hint && !success && !hasCharCount) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 mt-1.5 text-xs font-mono tracking-wider",
        className,
      )}
      role={error ? "alert" : "status"}
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {error ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="text-red-600 font-bold uppercase truncate">
              {error}
            </span>
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-emerald-700 font-bold uppercase truncate">
              {success}
            </span>
          </>
        ) : hint ? (
          <>
            <Info className="w-3.5 h-3.5 text-black/60 shrink-0" />
            <span className="text-black/60 uppercase truncate">{hint}</span>
          </>
        ) : null}
      </div>

      {hasCharCount && (
        <span
          className={cn(
            "shrink-0 font-bold text-[11px]",
            isOverLimit
              ? "text-red-600 underline"
              : charCount >= maxCharCount * 0.9
                ? "text-amber-600"
                : "text-black/50",
          )}
        >
          {charCount}/{maxCharCount}
        </span>
      )}
    </div>
  );
}

export interface AsyncStateLoaderProps {
  /** Human-readable status message that updates over time */
  status: string;
  /** Subtitle or step details */
  detail?: string;
  className?: string;
}

/**
 * Montally Neo-Brutalist Multi-Step Action Indicator
 * Avoids blank, uninformative spinners by communicating explicit progress & effort
 * (Psychological Labor Illusion & Graceful Wait States).
 */
export function AsyncStateLoader({
  status,
  detail,
  className,
}: AsyncStateLoaderProps) {
  return (
    <div
      className={cn(
        "p-4 bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-center gap-3",
        className,
      )}
    >
      <div className="w-4 h-4 rounded-full border-2 border-black border-t-[#836EF9] animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-black truncate">
          {status}
        </p>
        {detail && (
          <p className="text-[11px] font-mono text-black/60 truncate mt-0.5">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
