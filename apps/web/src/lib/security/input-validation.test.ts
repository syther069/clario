import { describe, it, expect } from "vitest";
import {
  parseSafeJson,
  stripPrototypePollution,
  isValidHex,
  isValidUuid,
  isSafeString,
} from "./input-validation";

describe("Input Validation & Prototype Pollution Defense (SEC-09)", () => {
  it("strips prototype pollution keys when parsing JSON", async () => {
    const maliciousJson = '{"title":"Lunch","__proto__":{"polluted":true},"nested":{"constructor":{"admin":true}}}';
    const parsed = await parseSafeJson<Record<string, unknown>>(maliciousJson);

    expect(parsed.title).toBe("Lunch");
    // Verify __proto__ was stripped and not set on Object.prototype
    expect((parsed as Record<string, unknown>).__proto__).not.toHaveProperty("polluted");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("handles parseSafeJson with clean payloads", async () => {
    const cleanJson = '{"amount":"150.00","currency":"USD"}';
    const parsed = await parseSafeJson<{ amount: string; currency: string }>(cleanJson);

    expect(parsed.amount).toBe("150.00");
    expect(parsed.currency).toBe("USD");
  });

  it("fails closed on malformed JSON", async () => {
    await expect(parseSafeJson("{unquoted: 123}")).rejects.toThrow(/Malformed JSON/);
  });

  it("strips prototype pollution recursively from in-memory objects", () => {
    const input = {
      user: "alice",
      __proto__: { isAdmin: true },
      settings: {
        constructor: { root: true },
        theme: "dark",
      },
    };

    const clean = stripPrototypePollution(input);
    expect(clean.user).toBe("alice");
    expect(clean.settings.theme).toBe("dark");
    expect(Object.prototype.hasOwnProperty.call(clean, "__proto__")).toBe(false);
  });

  it("validates 0x hex strings accurately", () => {
    expect(isValidHex("0x1234")).toBe(true);
    expect(isValidHex("0x1111111111111111111111111111111111111111111111111111111111111111", 64)).toBe(true);
    // Invalid
    expect(isValidHex("1234")).toBe(false);
    expect(isValidHex("0xZZZZ")).toBe(false);
    expect(isValidHex("0x123", 64)).toBe(false);
  });

  it("validates UUIDs accurately", () => {
    expect(isValidUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isValidUuid("invalid-uuid-format")).toBe(false);
  });

  it("rejects strings containing null bytes", () => {
    expect(isSafeString("Hello world")).toBe(true);
    expect(isSafeString("Hello\0World")).toBe(false);
    expect(isSafeString("a".repeat(10), { maxLength: 5 })).toBe(false);
  });
});
