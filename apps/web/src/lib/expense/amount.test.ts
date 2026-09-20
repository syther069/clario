import { describe, expect, it } from "vitest";
import {
  findTokenAsset,
  formatBaseUnits,
  isValidAddress,
  normalizeAddress,
  parseBaseUnits,
  SUPPORTED_TOKENS,
} from "./amount";

describe("Expense Amount & Asset Utilities", () => {
  describe("Token Assets", () => {
    it("provides default supported tokens with valid configurations", () => {
      expect(SUPPORTED_TOKENS.length).toBeGreaterThanOrEqual(3);
      for (const token of SUPPORTED_TOKENS) {
        expect(token.decimals).toBeGreaterThan(0);
        expect(isValidAddress(token.address)).toBe(true);
        expect(token.symbol.length).toBeGreaterThan(0);
      }
    });

    it("looks up tokens by symbol or address case-insensitively", () => {
      const usdc = findTokenAsset("usdc");
      expect(usdc).toBeDefined();
      expect(usdc?.decimals).toBe(6);

      const byAddr = findTokenAsset(usdc!.address.toUpperCase());
      expect(byAddr).toBeDefined();
      expect(byAddr?.symbol).toBe("USDC");

      expect(findTokenAsset("UNKNOWN")).toBeUndefined();
    });
  });

  describe("Address Normalization & Validation", () => {
    it("validates 0x-prefixed 40-character hex addresses", () => {
      expect(isValidAddress("0x0000000000000000000000000000000000001001")).toBe(
        true,
      );
      expect(isValidAddress("0xAbCdEf1234567890abcdef1234567890ABCDEF12")).toBe(
        true,
      );
      expect(isValidAddress("0x123")).toBe(false);
      expect(isValidAddress("not-an-address")).toBe(false);
      expect(isValidAddress(null)).toBe(false);
      expect(isValidAddress(123)).toBe(false);
    });

    it("normalizes addresses to lowercase", () => {
      const addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
      expect(normalizeAddress(addr)).toBe(addr.toLowerCase());
    });

    it("throws when normalizing invalid address", () => {
      expect(() => normalizeAddress("invalid")).toThrow(/Invalid EVM address/);
    });
  });

  describe("parseBaseUnits", () => {
    it("parses integer amounts correctly", () => {
      expect(parseBaseUnits("100", 6)).toBe(100_000_000n);
      expect(parseBaseUnits("0", 6)).toBe(0n);
      expect(parseBaseUnits("1", 18)).toBe(1_000_000_000_000_000_000n);
    });

    it("parses fractional amounts correctly", () => {
      expect(parseBaseUnits("100.5", 6)).toBe(100_500_000n);
      expect(parseBaseUnits("100.50", 6)).toBe(100_500_000n);
      expect(parseBaseUnits("0.000001", 6)).toBe(1n);
      expect(parseBaseUnits("0.123456", 6)).toBe(123_456n);
    });

    it("rejects amounts exceeding decimal precision", () => {
      expect(() => parseBaseUnits("10.1234567", 6)).toThrow(
        /exceeds allowed precision of 6 decimal places/,
      );
    });

    it("rejects negative, signed, or malformed inputs", () => {
      expect(() => parseBaseUnits("-50", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("+50", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("1e6", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("abc", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("  ", 6)).toThrow(
        /Invalid decimal amount format/,
      );
      expect(() => parseBaseUnits("10.5.5", 6)).toThrow(
        /Invalid decimal amount format/,
      );
    });

    it("rejects invalid decimals specification", () => {
      expect(() => parseBaseUnits("100", -1)).toThrow(/Invalid token decimals/);
      expect(() => parseBaseUnits("100", 40)).toThrow(/Invalid token decimals/);
    });
  });

  describe("formatBaseUnits", () => {
    it("formats base units to human-readable strings", () => {
      expect(formatBaseUnits(100_000_000n, 6)).toBe("100");
      expect(formatBaseUnits(100_500_000n, 6)).toBe("100.5");
      expect(formatBaseUnits(123_456n, 6)).toBe("0.123456");
      expect(formatBaseUnits(1n, 6)).toBe("0.000001");
      expect(formatBaseUnits(0n, 6)).toBe("0");
    });

    it("preserves trailing zeros when requested", () => {
      expect(formatBaseUnits(100_500_000n, 6, false)).toBe("100.500000");
      expect(formatBaseUnits(0n, 6, false)).toBe("0.000000");
    });

    it("supports 0 decimals", () => {
      expect(formatBaseUnits(150n, 0)).toBe("150");
    });

    it("rejects negative base units", () => {
      expect(() => formatBaseUnits(-100n, 6)).toThrow(
        /Base units must be non-negative/,
      );
    });
  });
});
