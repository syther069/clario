import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../schema/v1/canonicalize.js";
import { computePackageFileHash } from "../package/validate.js";
import { CLARIO_CANONICALIZATION_SPEC_V1 } from "../package/types.js";
import { loadVerificationPackageZip } from "./archive.js";

function createStoredZip(
  entries: Array<{ path: string; data: Buffer }>,
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, entry.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  }
  const directory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, eocd]);
}

function fixtureZip(extraPath = "clario-export/payload.txt"): Buffer {
  const payload = Buffer.from("fixture", "utf8");
  const manifest = {
    schemaVersion: 1,
    generator: "archive-test",
    createdAt: "2026-09-20T00:00:00Z",
    disclosureLevel: "FULL",
    chainId: 31337,
    workspaceId: `0x${"11".repeat(32)}`,
    registryAddress: `0x${"22".repeat(20)}`,
    canonicalizationSpec: CLARIO_CANONICALIZATION_SPEC_V1,
    exporterAddress: `0x${"33".repeat(20)}`,
    expenses: [
      {
        expenseId: `0x${"44".repeat(32)}`,
        versions: [1],
        currentVersion: 1,
        isSettled: false,
      },
    ],
    files: [
      {
        path: "payload.txt",
        sizeBytes: payload.length,
        sha256: computePackageFileHash(payload),
        mediaType: "text/plain",
        privacyClass: "PUBLIC",
      },
    ],
  };
  return createStoredZip([
    {
      path: "clario-export/manifest.json",
      data: Buffer.from(canonicalizeJson(manifest), "utf8"),
    },
    { path: extraPath, data: payload },
  ]);
}

describe("verification package ZIP loader", () => {
  it("loads the manifest and payload entirely in memory", () => {
    const bundle = loadVerificationPackageZip(fixtureZip());
    expect(bundle.manifest.schemaVersion).toBe(1);
    expect(bundle.files.get("payload.txt")?.toString("utf8")).toBe("fixture");
    expect(bundle.files.has("manifest.json")).toBe(false);
  });

  it("rejects entries outside the package root and path traversal", () => {
    expect(() => loadVerificationPackageZip(fixtureZip("payload.txt"))).toThrow(
      /unexpected zip root/i,
    );
    expect(() =>
      loadVerificationPackageZip(fixtureZip("clario-export/../payload.txt")),
    ).toThrow(/unsafe verification package path/i);
  });
});
