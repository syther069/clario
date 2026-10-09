/**
 * Safe Error Handler & Sanitizer
 * Prevents stack traces, database schema leaks, credentials, and internal server paths
 * from leaking to user-facing API responses (Security Prompt Pack Section 5, SEC-10).
 */

import { NextResponse } from "next/server";
import { ProtocolError } from "@clario/protocol";

export interface SafeErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const SENSITIVE_PATTERNS = [
  /relation\s+["'].*?["']\s+does not exist/i,
  /syntax error at or near/i,
  /duplicate key value violates unique constraint/i,
  /violates foreign key constraint/i,
  /password/i,
  /postgres(ql)?:\/\//i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /at\s+([A-Za-z]:\\|\/)/, // Stack trace paths
  /\.tsx?:\d+:\d+/,
  /\.jsx?:\d+:\d+/,
  /PGRST\d{3}/i, // PostgREST codes
];

/**
 * Checks if a string contains internal database errors or sensitive debug traces.
 */
export function isSensitiveErrorMessage(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitizes an error message string by replacing internal database/system details
 * with a clean fallback message.
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred.",
): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (isSensitiveErrorMessage(raw)) {
    return fallback;
  }
  return raw;
}

/**
 * Maps any internal or unknown error into a sanitized, safe public error response.
 * Detailed technical errors are logged server-side only.
 */
export function handleSafeApiError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred.",
): NextResponse<SafeErrorResponse> {
  // 1. Clario ProtocolError
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

  // 2. RecordNotFoundError
  if (
    error instanceof Error &&
    (error.name === "RecordNotFoundError" ||
      error.constructor?.name === "RecordNotFoundError")
  ) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      },
      { status: 404 },
    );
  }

  // 3. Settlement Domain Errors
  if (error instanceof Error) {
    const name = error.name || error.constructor?.name;
    if (name === "SettlementNotFoundError") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (name === "SettlementPreConditionError") {
      return NextResponse.json(
        { error: { code: "PRECONDITION_FAILED", message: error.message } },
        { status: 412 },
      );
    }
    if (name === "SettlementConflictError") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: error.message } },
        { status: 409 },
      );
    }
  }

  // 4. Log raw technical error on server side only
  const internalMessage =
    error instanceof Error ? error.message : String(error);
  console.error("[SafeApiError Caught]:", internalMessage);

  // 5. Fail closed with sanitized 500 response
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
