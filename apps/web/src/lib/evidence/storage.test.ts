import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  DiskStorageDriver,
  generateEvidenceStorageKey,
  getDefaultStorageDriver,
  MemoryStorageDriver,
  setDefaultStorageDriver,
} from "./storage";

describe("Evidence Storage Module", () => {
  describe("generateEvidenceStorageKey", () => {
    it("generates opaque paths without sensitive metadata", () => {
      const workspaceId = "0x1234abcd";
      const evidenceId = "e5a7413d-82fa-45b6-b519-75a892b19283";
      const key = generateEvidenceStorageKey(workspaceId, evidenceId);

      expect(key).toBe(`evidence/${workspaceId}/${evidenceId}.enc`);
      expect(key).not.toContain("receipt");
      expect(key).not.toContain("invoice");
      expect(key).not.toContain("merchant");
    });

    it("sanitizes inputs and rejects path traversal characters", () => {
      expect(() =>
        generateEvidenceStorageKey("../../../etc", "passwd"),
      ).not.toThrow();

      // Sanitization removes slashes and dots
      const sanitized = generateEvidenceStorageKey("../../../etc", "passwd");
      expect(sanitized).toBe("evidence/etc/passwd.enc");

      // Empty sanitized identifier throws
      expect(() => generateEvidenceStorageKey("...", "...")).toThrow(
        /Invalid workspaceId or evidenceId/,
      );
    });
  });

  describe("MemoryStorageDriver", () => {
    it("performs CRUD operations correctly", async () => {
      const driver = new MemoryStorageDriver();
      const testKey = "evidence/ws1/ev1.enc";
      const data = Buffer.from("encrypted-blob", "utf8");

      expect(await driver.exists(testKey)).toBe(false);
      expect(await driver.get(testKey)).toBeNull();

      await driver.put(testKey, data, "application/octet-stream");
      expect(await driver.exists(testKey)).toBe(true);

      const retrieved = await driver.get(testKey);
      expect(retrieved?.equals(data)).toBe(true);

      await driver.delete(testKey);
      expect(await driver.exists(testKey)).toBe(false);
      expect(await driver.get(testKey)).toBeNull();
    });

    it("clears all storage entries", async () => {
      const driver = new MemoryStorageDriver();
      await driver.put("k1", Buffer.from("1"));
      await driver.put("k2", Buffer.from("2"));
      expect(driver.size()).toBe(2);

      driver.clear();
      expect(driver.size()).toBe(0);
    });
  });

  describe("DiskStorageDriver", () => {
    const testDir = path.resolve(".test-storage-" + Date.now());

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it("performs filesystem CRUD operations safely", async () => {
      const driver = new DiskStorageDriver(testDir);
      const testKey = "evidence/ws1/ev1.enc";
      const data = Buffer.from("sample-ciphertext-bytes");

      expect(await driver.exists(testKey)).toBe(false);
      expect(await driver.get(testKey)).toBeNull();

      await driver.put(testKey, data);
      expect(await driver.exists(testKey)).toBe(true);

      const fetched = await driver.get(testKey);
      expect(fetched?.equals(data)).toBe(true);

      await driver.delete(testKey);
      expect(await driver.exists(testKey)).toBe(false);
      expect(await driver.get(testKey)).toBeNull();
    });

    it("prevents directory traversal attacks", async () => {
      const driver = new DiskStorageDriver(testDir);
      const maliciousKey = "../../outside.enc";

      await expect(
        driver.put(maliciousKey, Buffer.from("malicious")),
      ).rejects.toThrow(/Security violation: path traversal detected/);

      await expect(driver.get(maliciousKey)).rejects.toThrow(
        /Security violation: path traversal detected/,
      );

      await expect(driver.delete(maliciousKey)).rejects.toThrow(
        /Security violation: path traversal detected/,
      );
    });
  });

  describe("Default Driver Configuration", () => {
    beforeEach(() => {
      setDefaultStorageDriver(null);
    });

    afterEach(() => {
      setDefaultStorageDriver(null);
    });

    it("returns MemoryStorageDriver by default", () => {
      const driver = getDefaultStorageDriver();
      expect(driver).toBeInstanceOf(MemoryStorageDriver);
    });

    it("allows explicitly overriding default driver", () => {
      const custom = new MemoryStorageDriver();
      setDefaultStorageDriver(custom);
      expect(getDefaultStorageDriver()).toBe(custom);
    });
  });
});
