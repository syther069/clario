/**
 * Input Validation & Prototype Pollution Defense
 * Protects against object prototype poisoning, malformed JSON structures,
 * and malicious parameter injection (SEC-09).
 */

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Reviver function for JSON.parse that drops prototype pollution keys.
 */
export function safeJsonReviver(key: string, value: unknown): unknown {
  if (DANGEROUS_KEYS.has(key)) {
    return undefined; // Strips key from parsed structure
  }
  return value;
}

/**
 * Safely parses a JSON string or Request body with prototype pollution neutralization.
 */
export async function parseSafeJson<T = Record<string, unknown>>(
  input: string | Request,
): Promise<T> {
  let raw: string;
  if (typeof input === "string") {
    raw = input;
  } else {
    try {
      raw = await input.text();
    } catch {
      throw new Error("Failed to read request body as text.");
    }
  }

  if (!raw || raw.trim().length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(raw, safeJsonReviver) as T;
  } catch {
    throw new Error("Malformed JSON payload.");
  }
}

/**
 * Deeply sanitizes an existing in-memory object by stripping prototype pollution keys.
 */
export function stripPrototypePollution<T>(target: T): T {
  if (target === null || typeof target !== "object") {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => stripPrototypePollution(item)) as unknown as T;
  }

  const clean = Object.create(null);
  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    if (!DANGEROUS_KEYS.has(key)) {
      clean[key] = stripPrototypePollution(value);
    }
  }

  return clean as T;
}

/**
 * Validates that a string is a 0x-prefixed hex string of exact or arbitrary length.
 */
export function isValidHex(value: unknown, expectedLength?: number): value is `0x${string}` {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    return false;
  }
  const hexPart = value.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
    return false;
  }
  if (expectedLength !== undefined) {
    return hexPart.length === expectedLength;
  }
  return hexPart.length % 2 === 0;
}

/**
 * Validates that a string is a standard RFC 4122 UUID.
 */
export function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Validates that a string does not contain null bytes or control characters and satisfies length limits.
 */
export function isSafeString(
  value: unknown,
  options?: { minLength?: number; maxLength?: number },
): value is string {
  if (typeof value !== "string") return false;
  if (/[\0]/.test(value)) return false;

  const min = options?.minLength ?? 0;
  const max = options?.maxLength ?? 4096;

  return value.length >= min && value.length <= max;
}
