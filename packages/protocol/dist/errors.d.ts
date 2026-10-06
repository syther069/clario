import { type RequestId } from "./identifiers.js";
/**
 * Stable protocol error codes defined across Clario architecture.
 * See architecture.md §10.7 and TASKS.md PRO-003 requirements.
 */
export declare const PROTOCOL_ERROR_CODES: readonly ["UNAUTHORIZED", "VERSION_MISMATCH", "EXPENSE_VERSION_SUPERSEDED", "STALE_APPROVAL", "DUPLICATE_SETTLEMENT", "UNSUPPORTED_CHAIN", "UNSUPPORTED_TOKEN", "UNVERIFIABLE_EVIDENCE", "INVALID_COMMITMENT", "INVALID_IDENTIFIER", "INVALID_LIFECYCLE_TRANSITION", "INVALID_TYPED_DATA", "RATE_LIMITED", "INTERNAL_ERROR"];
export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];
/**
 * Type guard checking if a string is a valid ProtocolErrorCode.
 */
export declare function isProtocolErrorCode(val: unknown): val is ProtocolErrorCode;
/**
 * Standard safe human-readable messages that guide the user without leaking
 * private evidence, merchant/purpose data, salts, credentials, or infrastructure details.
 */
export declare const DEFAULT_SAFE_ERROR_MESSAGES: Readonly<Record<ProtocolErrorCode, string>>;
export declare const DEFAULT_RETRYABLE_FLAGS: Readonly<Record<ProtocolErrorCode, boolean>>;
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
export declare class ProtocolError extends Error {
    readonly code: ProtocolErrorCode;
    readonly requestId: RequestId;
    readonly retryable: boolean;
    constructor(code: ProtocolErrorCode, options?: CreateProtocolErrorOptions);
    toEnvelope(): ProtocolErrorEnvelope;
    toJSON(): ProtocolErrorEnvelope;
}
/**
 * Convenience factory to create a ProtocolError instance.
 */
export declare function createProtocolError(code: ProtocolErrorCode, options?: CreateProtocolErrorOptions): ProtocolError;
/**
 * Safe parser for error envelopes crossing runtime, API, or serialization boundaries.
 * Fails closed if the envelope is malformed or if the code is unknown.
 */
export declare function parseProtocolErrorEnvelope(val: unknown): ProtocolErrorEnvelope;
//# sourceMappingURL=errors.d.ts.map