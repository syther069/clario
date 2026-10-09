import { describe, expect, it } from "vitest";
import {
  redactSensitiveString,
  sanitizeAuditPayload,
  formatSecurityAnomalyEvent,
  REDACTED_MASK,
} from "./audit-logger";

describe("Security Audit Logger & Redaction Guard", () => {
  describe("redactSensitiveString", () => {
    it("redacts bearer tokens in string messages", () => {
      const input = "User authenticated with Bearer eyJhbGciOiJIUzI1NiJ9.testToken";
      const sanitized = redactSensitiveString(input);
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiJ9.testToken");
      expect(sanitized).toContain("Bearer [REDACTED]");
    });

    it("redacts provider API keys matching alch_ or sbp_ patterns", () => {
      const input = "Failed request to provider with key alch_0123456789abcdef0123456789";
      const sanitized = redactSensitiveString(input);
      expect(sanitized).not.toContain("alch_0123456789abcdef0123456789");
      expect(sanitized).toContain("[REDACTED_API_KEY]");
    });

    it("preserves non-sensitive transaction hashes and block numbers", () => {
      const input = "Transaction 0x1111111111111111111111111111111111111111111111111111111111111111 confirmed at block 12345";
      const sanitized = redactSensitiveString(input);
      expect(sanitized).toBe(input);
    });
  });

  describe("sanitizeAuditPayload", () => {
    it("redacts sensitive object keys including password, secret, salt, token", () => {
      const payload = {
        workspaceId: "ws-123",
        actor: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
        salt: "0x7777777777777777777777777777777777777777777777777777777777777777",
        secret: "super-secret-value",
        token: "session-secret-jwt",
        password: "user-password",
      };

      const clean = sanitizeAuditPayload(payload);
      expect(clean.workspaceId).toBe("ws-123");
      expect(clean.actor).toBe("0x742d35cc6634c0532925a3b844bc454e4438f44e");
      expect(clean.salt).toBe(REDACTED_MASK);
      expect(clean.secret).toBe(REDACTED_MASK);
      expect(clean.token).toBe(REDACTED_MASK);
      expect(clean.password).toBe(REDACTED_MASK);
    });

    it("redacts nested sensitive keys within deep objects and arrays", () => {
      const nested = {
        event: "action",
        metadata: {
          session: "session-token-value",
          config: {
            apiKey: "alch_testkey1234567890123456",
          },
        },
        items: [
          { name: "item1", secret: "secret1" },
          { name: "item2", secret: "secret2" },
        ],
      };

      const clean = sanitizeAuditPayload(nested);
      expect(clean.metadata.session).toBe(REDACTED_MASK);
      expect(clean.metadata.config.apiKey).toBe(REDACTED_MASK);
      expect(clean.items[0]?.secret).toBe(REDACTED_MASK);
      expect(clean.items[1]?.secret).toBe(REDACTED_MASK);
      expect(clean.items[0]?.name).toBe("item1");
    });

    it("drops prototype pollution keys (__proto__, constructor, prototype)", () => {
      const maliciousPayload = JSON.parse(
        '{"name":"legit","__proto__":{"polluted":"yes"}}',
      );

      const clean = sanitizeAuditPayload(maliciousPayload);
      expect(clean.name).toBe("legit");
      expect(Object.prototype.hasOwnProperty.call(clean, "__proto__")).toBe(false);
      expect((clean as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("preserves benign domain fields like token_symbol and token_address", () => {
      const payload = {
        token_symbol: "USDC",
        token_address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
        amount: "500000000",
      };

      const clean = sanitizeAuditPayload(payload);
      expect(clean.token_symbol).toBe("USDC");
      expect(clean.token_address).toBe("0x754704Bc059F8C67012fEd69BC8A327a5aafb603");
      expect(clean.amount).toBe("500000000");
    });
  });

  describe("formatSecurityAnomalyEvent", () => {
    it("formats anomaly events with default UTC timestamp and unique UUID", () => {
      const event = formatSecurityAnomalyEvent({
        eventType: "ssrf_blocked",
        actorIp: "203.0.113.195",
        targetResource: "http://169.254.169.254/latest/meta-data",
        severity: "critical",
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(event.eventType).toBe("ssrf_blocked");
      expect(event.severity).toBe("critical");
      expect(event.actorIp).toBe("203.0.113.195");
    });

    it("automatically sanitizes sensitive details in anomaly events", () => {
      const event = formatSecurityAnomalyEvent({
        eventType: "suspicious_payload",
        actorAddress: "0x742D35CC6634C0532925A3B844BC454E4438F44E",
        details: {
          submittedToken: "Bearer testTokenSecret",
          passwordAttempt: "secretPassword123",
        },
      });

      expect(event.actorAddress).toBe("0x742d35cc6634c0532925a3b844bc454e4438f44e");
      const details = event.details as Record<string, unknown>;
      expect(details.passwordAttempt).toBe(REDACTED_MASK);
    });
  });
});
