import * as zlib from "node:zlib";
import type { VerificationPackageBundle } from "../package/types.js";
import { validateVerificationPackageManifestV1 } from "../package/validate.js";

const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

function safePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/");
  if (
    !normalized ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe verification package path: ${value}`);
  }
  return normalized;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid ZIP: end-of-central-directory record not found.");
}

/** Loads a Clario ZIP without writing disclosed evidence to disk. */
export function loadVerificationPackageZip(
  archive: Buffer | Uint8Array,
): VerificationPackageBundle {
  const buffer = Buffer.isBuffer(archive) ? archive : Buffer.from(archive);
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error("Verification package exceeds the 512 MiB archive limit.");
  }

  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ENTRIES)
    throw new Error("ZIP contains too many entries.");
  if (centralOffset + centralSize > eocd) {
    throw new Error("Invalid ZIP central-directory bounds.");
  }

  const files = new Map<string, Buffer>();
  let cursor = centralOffset;
  let expandedBytes = 0;

  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > centralOffset + centralSize) {
      throw new Error("Truncated ZIP central directory.");
    }
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Invalid ZIP central-directory entry.");
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > centralOffset + centralSize) {
      throw new Error("Truncated ZIP filename.");
    }
    const rawName = buffer.toString("utf8", nameStart, nameEnd);
    cursor = nameEnd + extraLength + commentLength;
    if (rawName.endsWith("/")) continue;

    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error(`ZIP entry exceeds the 128 MiB limit: ${rawName}`);
    }
    expandedBytes += uncompressedSize;
    if (expandedBytes > MAX_ARCHIVE_BYTES) {
      throw new Error("Expanded verification package exceeds 512 MiB.");
    }
    if (
      localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    ) {
      throw new Error(`Invalid ZIP local header: ${rawName}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > buffer.length) {
      throw new Error(`ZIP entry data is out of bounds: ${rawName}`);
    }

    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data =
      method === 0
        ? Buffer.from(compressed)
        : method === 8
          ? zlib.inflateRawSync(compressed, {
              maxOutputLength: MAX_ENTRY_BYTES,
            })
          : null;
    if (!data) throw new Error(`Unsupported ZIP compression method ${method}.`);
    if (data.length !== uncompressedSize) {
      throw new Error(`ZIP entry size mismatch: ${rawName}`);
    }

    const fullPath = safePath(rawName);
    if (!fullPath.startsWith("clario-export/")) {
      throw new Error(`Unexpected ZIP root: ${rawName}`);
    }
    const relativePath = safePath(fullPath.slice("clario-export/".length));
    if (files.has(relativePath)) {
      throw new Error(`Duplicate ZIP entry: ${relativePath}`);
    }
    files.set(relativePath, data);
  }

  const manifestBytes = files.get("manifest.json");
  if (!manifestBytes)
    throw new Error("Verification package is missing manifest.json.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("Verification package manifest.json is not valid JSON.");
  }
  const manifest = validateVerificationPackageManifestV1(parsed);
  files.delete("manifest.json");
  return { manifest, files };
}
