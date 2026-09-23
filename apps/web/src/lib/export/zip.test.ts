import { describe, it, expect } from "vitest";
import {
  computeCrc32,
  createDeterministicZip,
  extractZipEntries,
  normalizeZipPath,
} from "./zip";

describe("Deterministic ZIP module", () => {
  describe("computeCrc32", () => {
    it("computes standard IEEE 802.3 CRC-32 for '123456789'", () => {
      const input = Buffer.from("123456789", "utf8");
      // Standard check value: 0xCBF43926 = 3421780262
      expect(computeCrc32(input)).toBe(0xcbf43926);
    });

    it("computes 0 for empty buffer", () => {
      expect(computeCrc32(Buffer.alloc(0))).toBe(0);
    });
  });

  describe("normalizeZipPath", () => {
    it("normalizes backslashes to forward slashes and trims slashes", () => {
      expect(normalizeZipPath("clario-export\\manifest.json")).toBe(
        "clario-export/manifest.json",
      );
      expect(normalizeZipPath("/foo/bar/baz.txt/")).toBe("foo/bar/baz.txt");
    });

    it("rejects path traversal", () => {
      expect(() => normalizeZipPath("../secret.txt")).toThrow(/Path traversal/);
      expect(() => normalizeZipPath("foo/../../bar")).toThrow(/Path traversal/);
    });

    it("rejects empty paths", () => {
      expect(() => normalizeZipPath("")).toThrow(/Invalid empty/);
      expect(() => normalizeZipPath("///")).toThrow(/Invalid empty/);
    });
  });

  describe("createDeterministicZip & extractZipEntries", () => {
    it("creates a zip and extracts entries identically (round-trip)", () => {
      const files = [
        {
          path: "clario-export/manifest.json",
          data: Buffer.from('{"version": 1}', "utf8"),
        },
        {
          path: "clario-export/workspace-policy.json",
          data: Buffer.from('{"rules": []}', "utf8"),
        },
        {
          path: "clario-export/expenses/exp_1/v1/record.json",
          data: Buffer.from('{"amount": 100}', "utf8"),
        },
      ];

      const zipBuf = createDeterministicZip(files);
      expect(zipBuf.length).toBeGreaterThan(0);

      const extracted = extractZipEntries(zipBuf);
      expect(extracted.length).toBe(3);

      // Verify lexicographical order
      expect(extracted[0]!.path).toBe(
        "clario-export/expenses/exp_1/v1/record.json",
      );
      expect(extracted[1]!.path).toBe("clario-export/manifest.json");
      expect(extracted[2]!.path).toBe("clario-export/workspace-policy.json");

      expect(extracted[0]!.data.toString("utf8")).toBe('{"amount": 100}');
      expect(extracted[1]!.data.toString("utf8")).toBe('{"version": 1}');
      expect(extracted[2]!.data.toString("utf8")).toBe('{"rules": []}');
    });

    it("produces bit-for-bit identical zip bytes regardless of input order", () => {
      const filesA = [
        { path: "b.txt", data: Buffer.from("content B") },
        { path: "a.txt", data: Buffer.from("content A") },
      ];

      const filesB = [
        { path: "a.txt", data: Buffer.from("content A") },
        { path: "b.txt", data: Buffer.from("content B") },
      ];

      const zipA = createDeterministicZip(filesA);
      const zipB = createDeterministicZip(filesB);

      expect(zipA.equals(zipB)).toBe(true);
    });

    it("rejects duplicate paths", () => {
      const duplicates = [
        { path: "foo.txt", data: Buffer.from("first") },
        { path: "./foo.txt", data: Buffer.from("second") },
      ];

      expect(() => createDeterministicZip(duplicates)).toThrow(
        /Duplicate entry path/,
      );
    });

    it("rejects corrupted zip files gracefully", () => {
      expect(() => extractZipEntries(Buffer.alloc(10))).toThrow(
        /buffer too small/,
      );
      expect(() => extractZipEntries(Buffer.alloc(30))).toThrow(
        /EOCD signature not found/,
      );
    });
  });
});
