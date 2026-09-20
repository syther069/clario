import { type RequestId, parseRequestId } from "./identifiers.js";

/**
 * Stable protocol error codes defined across Clario architecture.
 * See architecture.md §10.7 and TASKS.md PRO-003 requirements.
 */
export const PROTOCOL_ERROR_CODES = [
  "UNAUTHORIZED",
  "VERSION_MISMATCH",
  "EXPENSE_VERSION_SUPERSEDED",
  "STALE_APPROVAL",
  "DUPLICATE_SETTLEMENT",
  "UNSUPPORTED_CHAIN",
  "UNSUPPORTED_TOKEN",
  "UNVERIFIABLE_EVIDENCE",
  "INVALID_COMMITMENT",
  "INVALID_IDENTIFIER",
  "INVALID_LIFECYCLE_TRANSITION",
  "INVALID_TYPED_DATA",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

const PROTOCOL_ERROR_CODE_SET: ReadonlySet<string> = new Set(
  PROTOCOL_ERROR_CODES,
);

/**
 * Type guard checking if a string is a valid ProtocolErrorCode.
 */
export function isProtocolErrorCode(val: unknown): val is ProtocolErrorCode {
  return typeof val === "string" && PROTOCOL_ERROR_CODE_SET.has(val);
}

/**
 * Standard safe human-readable messages that guide the user without leaking
 * private evidence, merchant/purpose data, salts, credentials, or infrastructure details.
 */
export const DEFAULT_SAFE_ERROR_MESSAGES: Readonly<
  Record<ProtocolErrorCode, string>
> = {
  UNAUTHORIZED:
    "The requested action is not authorized for this account or role.",
  VERSION_MISMATCH: "The specified version does not match the active version.",
  EXPENSE_VERSION_SUPERSEDED:
    "This expense version has been superseded by a newer version.",
  STALE_APPROVAL:
    "The approval decision is stale or has been invalidated by a material edit.",
  DUPLICATE_SETTLEMENT:
    "This expense version has already been reimbursed or settled.",
  UNSUPPORTED_CHAIN: "The requested blockchain network is not supported.",
  UNSUPPORTED_TOKEN: "The requested settlement token is not supported.",
  UNVERIFIABLE_EVIDENCE:
    "The submitted evidence cannot be verified against the commitment.",
  INVALID_COMMITMENT: "The cryptographic commitment is malformed or invalid.",
  INVALID_IDENTIFIER: "One or more identifiers are malformed or invalid.",
  INVALID_LIFECYCLE_TRANSITION:
    "The requested lifecycle state transition is invalid.",
  INVALID_TYPED_DATA:
    "The provided typed data structure or message values are invalid.",
  RATE_LIMITED: "Request rate limit exceeded. Please retry later.",
  INTERNAL_ERROR: "An internal protocol error occurred.",
};

export const DEFAULT_RETRYABLE_FLAGS: Readonly<
  Record<ProtocolErrorCode, boolean>
> = {
  UNAUTHORIZED: false,
  VERSION_MISMATCH: false,
  EXPENSE_VERSION_SUPERSEDED: false,
  STALE_APPROVAL: false,
  DUPLICATE_SETTLEMENT: false,
  UNSUPPORTED_CHAIN: false,
  UNSUPPORTED_TOKEN: false,
  UNVERIFIABLE_EVIDENCE: false,
  INVALID_COMMITMENT: false,
  INVALID_IDENTIFIER: false,
  INVALID_LIFECYCLE_TRANSITION: false,
  INVALID_TYPED_DATA: false,
  RATE_LIMITED: true,
  INTERNAL_ERROR: true,
};

/**
 * Detail object inside the standard protocol error envelope.
 */
export interface ProtocolErrorDetail {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly requestId: RequestId;
  readonly retryable: boolean;
}

/**
 * Standard error response envelope matching architecture.md §10.7:
 * {
 *   "error": {
 *     "code": "EXPENSE_VERSION_SUPERSEDED",
 *     "message": "...",
 *     "requestId": "opaque-id",
 *     "retryable": false
 *   }
 * }
 */
export interface ProtocolErrorEnvelope {
  readonly error: ProtocolErrorDetail;
}

export interface CreateProtocolErrorOptions {
  message?: string;
  requestId?: RequestId | string;
  retryable?: boolean;
  cause?: unknown;
}

/**
 * Error class representing a stable protocol error with an envelope representation.
 */
export class ProtocolError extends Error {
  readonly code: ProtocolErrorCode;
  readonly requestId: RequestId;
  readonly retryable: boolean;

  constructor(
    code: ProtocolErrorCode,
    options: CreateProtocolErrorOptions = {},
  ) {
    if (!isProtocolErrorCode(code)) {
      throw new Error(`Invalid protocol error code: ${String(code)}`);
    }

    const safeMessage = options.message ?? DEFAULT_SAFE_ERROR_MESSAGES[code];
    super(safeMessage);
    this.name = "ProtocolError";
    this.code = code;

    const rawReqId = options.requestId ?? "req_0000000000000000";
    this.requestId = parseRequestId(rawReqId);
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE_FLAGS[code];

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  toEnvelope(): ProtocolErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId: this.requestId,
        retryable: this.retryable,
      },
    };
  }

  toJSON(): ProtocolErrorEnvelope {
    return this.toEnvelope();
  }
}

/**
 * Convenience factory to create a ProtocolError instance.
 */
export function createProtocolError(
  code: ProtocolErrorCode,
  options?: CreateProtocolErrorOptions,
): ProtocolError {
  return new ProtocolError(code, options);
}

/**
 * Safe parser for error envelopes crossing runtime, API, or serialization boundaries.
 * Fails closed if the envelope is malformed or if the code is unknown.
 */
export function parseProtocolErrorEnvelope(
  val: unknown,
): ProtocolErrorEnvelope {
  if (typeof val !== "object" || val === null || !("error" in val)) {
    throw new ProtocolError("INTERNAL_ERROR", {
      message: "Invalid error envelope: expected object with error property.",
    });
  }

  const errObj = (val as { error: unknown }).error;
  if (typeof errObj !== "object" || errObj === null) {
    throw new ProtocolError("INTERNAL_ERROR", {
      message: "Invalid error detail: expected object.",
    });
  }

  const { code, message, requestId, retryable } = errObj as Record<
    string,
    unknown
  >;

  if (!isProtocolErrorCode(code)) {
    throw new ProtocolError("INTERNAL_ERROR", {
      message: `Unknown or unrecognized protocol error code: ${String(code)}`,
    });
  }

  if (typeof message !== "string" || message.length === 0) {
    throw new ProtocolError("INTERNAL_ERROR", {
      message: "Invalid error message: must be a non-empty string.",
    });
  }

  let parsedReqId: RequestId;
  try {
    parsedReqId = parseRequestId(requestId);
  } catch {
    throw new ProtocolError("INVALID_IDENTIFIER", {
      message: "Invalid requestId in error envelope.",
    });
  }

  if (typeof retryable !== "boolean") {
    throw new ProtocolError("INTERNAL_ERROR", {
      message: "Invalid retryable flag: must be a boolean.",
    });
  }

  return {
    error: {
      code,
      message,
      requestId: parsedReqId,
      retryable,
    },
  };
}
