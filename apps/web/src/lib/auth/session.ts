import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { getAddress, isAddress } from "viem";

export const DEFAULT_SESSION_TTL_SECONDS = 86400; // 24 hours
export const SESSION_COOKIE_NAME = "clario_session";

export interface SessionPayload {
  readonly sessionId: string;
  readonly userId: string;
  readonly address: `0x${string}`;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly lastConfirmedAt: number;
  readonly csrfToken: string;
}

export interface CreateSessionOptions {
  userId: string;
  address: string;
  ttlSeconds?: number | undefined;
  lastConfirmedAt?: number | undefined;
}

export interface CookieOptions {
  secure?: boolean | undefined;
  maxAge?: number | undefined;
  path?: string | undefined;
  domain?: string | undefined;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function computeHmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/**
 * Creates a fresh session payload with a unique session ID and CSRF token.
 */
export function createSessionPayload(
  options: CreateSessionOptions,
): SessionPayload {
  if (!options.userId || typeof options.userId !== "string") {
    throw new Error("Session requires a valid userId.");
  }

  if (!isAddress(options.address)) {
    throw new Error(
      `Session requires a valid Ethereum address: ${options.address}`,
    );
  }

  const now = Date.now();
  const ttl = options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = now + ttl * 1000;
  const lastConfirmedAt = options.lastConfirmedAt ?? now;

  return {
    sessionId: randomUUID(),
    userId: options.userId,
    address: getAddress(options.address),
    issuedAt: now,
    expiresAt,
    lastConfirmedAt,
    csrfToken: randomBytes(24).toString("hex"),
  };
}

/**
 * Signs a session payload into a tamper-evident HMAC-SHA256 token.
 */
export function signSessionToken(
  payload: SessionPayload,
  secret: string,
): string {
  if (!secret || secret.length < 16) {
    throw new Error("Session signing secret must be at least 16 characters.");
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const hmac = computeHmac(encodedPayload, secret);
  const signature = hmac.toString("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 * Enforces cryptographic HMAC signature and expiration checks.
 */
export function verifySessionToken(
  token: string,
  secret: string,
): SessionPayload {
  if (!secret || secret.length < 16) {
    throw new Error(
      "Session verification secret must be at least 16 characters.",
    );
  }

  if (!token || typeof token !== "string") {
    throw new Error("Missing or invalid session token.");
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Malformed session token format.");
  }

  const [encodedPayload, encodedSignature] = parts;

  const expectedHmac = computeHmac(encodedPayload, secret);
  const actualHmac = Buffer.from(encodedSignature, "base64url");

  if (
    expectedHmac.length !== actualHmac.length ||
    !timingSafeEqual(expectedHmac, actualHmac)
  ) {
    throw new Error("Invalid session token signature: token tampered.");
  }

  let rawPayload: unknown;
  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    rawPayload = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse session payload JSON.");
  }

  if (typeof rawPayload !== "object" || rawPayload === null) {
    throw new Error("Session payload must be an object.");
  }

  const payload = rawPayload as Record<string, unknown>;

  if (
    typeof payload.sessionId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.address !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    typeof payload.lastConfirmedAt !== "number" ||
    typeof payload.csrfToken !== "string" ||
    !isAddress(payload.address)
  ) {
    throw new Error("Session payload has invalid schema or missing fields.");
  }

  const now = Date.now();
  if (now > payload.expiresAt) {
    throw new Error("Session token has expired.");
  }

  // Reject clock-skew tokens issued far in the future (> 60s)
  if (payload.issuedAt > now + 60_000) {
    throw new Error("Session token issued in the future.");
  }

  return {
    sessionId: payload.sessionId,
    userId: payload.userId,
    address: getAddress(payload.address),
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    lastConfirmedAt: payload.lastConfirmedAt,
    csrfToken: payload.csrfToken,
  };
}

/**
 * Rotates a session, generating a new session ID and CSRF token while preserving
 * identity and confirmation state (mitigating session fixation).
 */
export function rotateSession(
  current: SessionPayload,
  secret: string,
  options?: {
    ttlSeconds?: number;
    refreshConfirmation?: boolean;
  },
): { token: string; payload: SessionPayload } {
  const now = Date.now();
  const ttl = options?.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const newPayload: SessionPayload = {
    sessionId: randomUUID(),
    userId: current.userId,
    address: current.address,
    issuedAt: now,
    expiresAt: now + ttl * 1000,
    lastConfirmedAt: options?.refreshConfirmation
      ? now
      : current.lastConfirmedAt,
    csrfToken: randomBytes(24).toString("hex"),
  };

  const token = signSessionToken(newPayload, secret);
  return { token, payload: newPayload };
}

/**
 * Serializes a session token into a standard Set-Cookie header value.
 * HTTP-only, SameSite=Strict, Path=/
 */
export function serializeSessionCookie(
  token: string,
  options?: CookieOptions,
): string {
  const maxAge = options?.maxAge ?? DEFAULT_SESSION_TTL_SECONDS;
  const path = options?.path ?? "/";
  const secure = options?.secure ?? false;

  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  return parts.join("; ");
}

/**
 * Serializes a cookie that clears the session.
 */
export function serializeLogoutCookie(options?: {
  path?: string;
  domain?: string;
}): string {
  const path = options?.path ?? "/";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=${path}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  return parts.join("; ");
}

/**
 * Extracts the session token from a Cookie header string.
 */
export function parseSessionCookie(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const token = trimmed.substring(SESSION_COOKIE_NAME.length + 1).trim();
      return token.length > 0 ? token : null;
    }
  }

  return null;
}

/**
 * Validates a CSRF token header against the authenticated session using constant-time comparison.
 */
export function verifyCsrfToken(
  session: SessionPayload,
  headerToken: string | null | undefined,
): boolean {
  if (!headerToken || typeof headerToken !== "string") {
    return false;
  }

  const expectedBuf = Buffer.from(session.csrfToken, "utf8");
  const actualBuf = Buffer.from(headerToken, "utf8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
}
