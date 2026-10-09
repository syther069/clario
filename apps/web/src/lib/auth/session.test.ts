import { describe, expect, it } from "vitest";
import {
  createSessionPayload,
  parseSessionCookie,
  rotateSession,
  serializeLogoutCookie,
  serializeSessionCookie,
  signSessionToken,
  verifyCsrfToken,
  verifySessionToken,
} from "./session";
import { getSessionSecret } from "./context";

describe("Secure Session Management and CSRF Defense (APP-002)", () => {
  const secret = "test-secret-at-least-16-characters-long!";
  const userId = "11111111-1111-1111-1111-111111111111";
  const address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  it("creates, signs, and verifies a valid session payload", () => {
    const payload = createSessionPayload({ userId, address });
    const token = signSessionToken(payload, secret);

    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const verified = verifySessionToken(token, secret);
    expect(verified.userId).toBe(userId);
    expect(verified.address.toLowerCase()).toBe(address.toLowerCase());
    expect(verified.sessionId).toBe(payload.sessionId);
    expect(verified.csrfToken).toBe(payload.csrfToken);
  });

  it("fails closed when the session token is tampered", () => {
    const payload = createSessionPayload({ userId, address });
    const token = signSessionToken(payload, secret);

    const [, sig] = token.split(".");
    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...payload,
        userId: "99999999-9999-9999-9999-999999999999",
      }),
    ).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${sig}`;

    expect(() => verifySessionToken(tamperedToken, secret)).toThrow(
      /tampered/i,
    );
  });

  it("fails closed when signed with a different secret", () => {
    const payload = createSessionPayload({ userId, address });
    const otherSecret = "different-secret-16-characters!";
    const token = signSessionToken(payload, otherSecret);

    expect(() => verifySessionToken(token, secret)).toThrow(/tampered/i);
  });

  it("fails closed if the session has expired", () => {
    // Session that expired 10 seconds ago
    const payload = createSessionPayload({
      userId,
      address,
      ttlSeconds: -10,
    });
    const token = signSessionToken(payload, secret);

    expect(() => verifySessionToken(token, secret)).toThrow(/expired/i);
  });

  it("rotates session generating a new session ID and CSRF token", () => {
    const original = createSessionPayload({ userId, address });
    const { token, payload: rotated } = rotateSession(original, secret);

    expect(rotated.userId).toBe(original.userId);
    expect(rotated.address).toBe(original.address);
    expect(rotated.sessionId).not.toBe(original.sessionId);
    expect(rotated.csrfToken).not.toBe(original.csrfToken);

    const verified = verifySessionToken(token, secret);
    expect(verified.sessionId).toBe(rotated.sessionId);
  });

  it("serializes and parses HTTP-only same-site session cookies", () => {
    const payload = createSessionPayload({ userId, address });
    const token = signSessionToken(payload, secret);

    const cookieStr = serializeSessionCookie(token, { secure: true });
    expect(cookieStr).toContain(`clario_session=${token}`);
    expect(cookieStr).toContain("HttpOnly");
    expect(cookieStr).toContain("SameSite=Strict");
    expect(cookieStr).toContain("Secure");
    expect(cookieStr).toContain("Path=/");

    const parsed = parseSessionCookie(
      `other=123; clario_session=${token}; foo=bar`,
    );
    expect(parsed).toBe(token);
  });

  it("serializes logout cookie that expires immediately", () => {
    const logoutCookie = serializeLogoutCookie();
    expect(logoutCookie).toContain("clario_session=");
    expect(logoutCookie).toContain("Max-Age=0");
    expect(logoutCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("validates and enforces CSRF tokens", () => {
    const payload = createSessionPayload({ userId, address });

    // Valid CSRF
    expect(verifyCsrfToken(payload, payload.csrfToken)).toBe(true);

    // Missing CSRF
    expect(verifyCsrfToken(payload, undefined)).toBe(false);
    expect(verifyCsrfToken(payload, null)).toBe(false);
    expect(verifyCsrfToken(payload, "")).toBe(false);

    // Mismatched CSRF
    expect(verifyCsrfToken(payload, "invalid-csrf-token")).toBe(false);
  });

  it("fails closed in production if session secret is missing or too short", () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    const originalSecret = env.SESSION_SECRET;
    const originalClarioSecret = env.CLARIO_SESSION_SECRET;
    const originalPrivySecret = env.PRIVY_APP_SECRET;

    try {
      env.NODE_ENV = "production";
      delete env.SESSION_SECRET;
      delete env.CLARIO_SESSION_SECRET;
      delete env.PRIVY_APP_SECRET;

      expect(() => getSessionSecret()).toThrow(/FATAL SECURITY CONFIGURATION/);

      // Too short (<32 chars) should also fail
      env.SESSION_SECRET = "short-secret";
      expect(() => getSessionSecret()).toThrow(/FATAL SECURITY CONFIGURATION/);

      // Valid 32+ char secret succeeds
      env.SESSION_SECRET = "secure-production-secret-must-be-at-least-32-chars-long";
      expect(getSessionSecret()).toBe("secure-production-secret-must-be-at-least-32-chars-long");
    } finally {
      env.NODE_ENV = originalEnv;
      if (originalSecret) env.SESSION_SECRET = originalSecret;
      else delete env.SESSION_SECRET;
      if (originalClarioSecret) env.CLARIO_SESSION_SECRET = originalClarioSecret;
      else delete env.CLARIO_SESSION_SECRET;
      if (originalPrivySecret) env.PRIVY_APP_SECRET = originalPrivySecret;
      else delete env.PRIVY_APP_SECRET;
    }
  });
});
