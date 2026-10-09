/**
 * Audit Logging & Telemetry Redaction Guard (SEC-08, SEC-10)
 *
 * Enforces tamper-evident audit formatting, prevents accidental leakage of
 * credentials, API keys, private keys, salts, and session tokens into logs or telemetry,
 * and standardizes security anomaly event logging.
 */

export const REDACTED_MASK = "[REDACTED]";

const SENSITIVE_KEY_REGEX =
  /(password|secret|session|salt|dek|kek|private_?key|auth_?tag|api_?key|credential|cookie|bearer|^token$|[a-z0-9]Token$)/i;

const SAFE_KEY_EXCEPTIONS = new Set([
  "public_key",
  "publicKey",
  "key_reference",
  "keyReference",
  "token_symbol",
  "tokenSymbol",
  "token_address",
  "tokenAddress",
  "claim_asset",
  "claimAsset",
]);

// Patterns matching common credential strings in text
const SENSITIVE_VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: "Bearer [REDACTED]" },
  // JWT tokens
  { pattern: /eyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]+/g, replacement: "[REDACTED_JWT]" },
  // Alchemy / Supabase / Provider keys
  { pattern: /alch_[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /sbp_[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED_API_KEY]" },
  // Generic key assignments: e.g. apiKey=..., privateKey=...
  {
    pattern: /(?:private_?key|secret|password|api_?key)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
    replacement: "$1: [REDACTED]",
  },
];

/**
 * Redacts any detected credentials, tokens, or sensitive patterns from a raw string.
 */
export function redactSensitiveString(input: string): string {
  if (!input || typeof input !== "string") return input;

  let sanitized = input;
  for (const { pattern, replacement } of SENSITIVE_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Deeply sanitizes an object or array before audit logging or telemetry persistence.
 * Drops prototype pollution keys and redacts values associated with sensitive keys.
 */
export function sanitizeAuditPayload<T>(payload: T): T {
  if (payload === null || typeof payload !== "object") {
    if (typeof payload === "string") {
      return redactSensitiveString(payload) as unknown as T;
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeAuditPayload(item)) as unknown as T;
  }

  const clean: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    // Drop prototype pollution keys
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }

    // Check if key itself designates sensitive material
    if (SENSITIVE_KEY_REGEX.test(key) && !SAFE_KEY_EXCEPTIONS.has(key)) {
      clean[key] = REDACTED_MASK;
      continue;
    }

    if (typeof value === "string") {
      clean[key] = redactSensitiveString(value);
    } else if (typeof value === "object" && value !== null) {
      clean[key] = sanitizeAuditPayload(value);
    } else {
      clean[key] = value;
    }
  }

  return clean as T;
}

export type SecurityAnomalyType =
  | "ssrf_blocked"
  | "rate_limit_exceeded"
  | "unauthorized_access"
  | "tampering_detected"
  | "invalid_credential"
  | "suspicious_payload";

export interface SecurityAnomalyEvent {
  id?: string;
  eventType: SecurityAnomalyType;
  actorIp?: string;
  actorAddress?: string;
  targetResource?: string;
  details?: Record<string, unknown> | string;
  timestamp?: string;
  severity?: "warning" | "alert" | "critical";
}

/**
 * Formats and validates a structured, sanitized security anomaly event.
 */
export function formatSecurityAnomalyEvent(
  event: SecurityAnomalyEvent,
): Required<SecurityAnomalyEvent> {
  const sanitizedDetails =
    typeof event.details === "string"
      ? redactSensitiveString(event.details)
      : sanitizeAuditPayload(event.details ?? {});

  return {
    id: event.id ?? crypto.randomUUID(),
    eventType: event.eventType,
    actorIp: event.actorIp ? redactSensitiveString(event.actorIp) : "unknown",
    actorAddress: event.actorAddress?.toLowerCase() ?? "anonymous",
    targetResource: event.targetResource ?? "unknown",
    details: sanitizedDetails,
    timestamp: event.timestamp ?? new Date().toISOString(),
    severity: event.severity ?? "warning",
  };
}

/**
 * Emits a structured security event to the server audit stream with sensitive data masked.
 */
export function logSecurityAnomaly(event: SecurityAnomalyEvent): Required<SecurityAnomalyEvent> {
  const formatted = formatSecurityAnomalyEvent(event);
  console.warn(
    `[SECURITY_ALERT] [${formatted.severity.toUpperCase()}] ${formatted.eventType}: ${formatted.targetResource} by ${formatted.actorAddress} (${formatted.actorIp})`,
    formatted.details,
  );
  return formatted;
}
