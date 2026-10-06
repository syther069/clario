/**
 * Safe Error Handler & Sanitizer
 * Prevents stack traces, database schema leaks, and internal server paths
 * from leaking to user-facing API responses (Security Prompt Pack Section 5).
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";

export interface SafeErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Maps any internal or unknown error into a sanitized, safe public error response.
 * Detailed technical errors are logged server-side only.
 */
export function handleSafeApiError(error: unknown, fallbackMessage = "An unexpected error occurred."): NextResponse<SafeErrorResponse> {
  // If it's already a well-typed Clario protocol error, map to authorized envelope
  if (error instanceof ProtocolError) {
    const statusMap: Record<string, number> = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      INVALID_IDENTIFIER: 400,
      INVALID_REQUEST: 400,
      CONFLICT: 409,
      RATE_LIMITED: 429,
    };
    const status = statusMap[error.code] || 400;
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status },
    );
  }

  // Never leak database errors, postgres constraint messages, or file paths
  const internalMessage = error instanceof Error ? error.message : String(error);
  console.error("[SafeApiError Caught]:", internalMessage);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: fallbackMessage,
      },
    },
    { status: 500 },
  );
}
