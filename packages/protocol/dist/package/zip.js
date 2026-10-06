import * as zlib from "node:zlib";
// Precomputed table for standard IEEE 802.3 CRC-32 (polynomial 0xEDB88320)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC_TABLE[i] = c >>> 0;
}
/**
 * Computes standard CRC-32 checksum.
 */
export function computeCrc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}
// Deterministic DOS timestamp: 1980-01-01 00:00:00 UTC
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021; // (1980 - 1980) << 9 | (1 << 5) | 1
/**
 * Normalizes a ZIP entry path: forward slashes, no leading/trailing slash, no directory traversal.
 */
export function normalizeZipPath(rawPath) {
    const normalized = rawPath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");
    const segments = normalized
        .split("/")
        .filter((s) => s.length > 0 && s !== ".");
    const safeSegments = [];
    for (const seg of segments) {
        if (seg === "..") {
            throw new Error(`Security violation: Path traversal '..' in zip path: ${rawPath}`);
        }
        safeSegments.push(seg);
    }
    if (safeSegments.length === 0) {
        throw new Error(`Invalid empty zip path: ${rawPath}`);
    }
    return safeSegments.join("/");
}
/**
 * Creates a deterministic ZIP archive from a list of entries.
 * Entries are sorted lexicographically by normalized path.
 * Compression method 0 (STORE) is used for 100% deterministic bit-for-bit reproducibility.
 */
export function createDeterministicZip(entries) {
    // Normalize and validate paths
    const normalizedEntries = entries.map((e) => ({
        path: normalizeZipPath(e.path),
        data: Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data),
    }));
    // Sort lexicographically by normalized path
    normalizedEntries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    // Check for duplicates
    for (let i = 1; i < normalizedEntries.length; i++) {
        if (normalizedEntries[i].path === normalizedEntries[i - 1].path) {
            throw new Error(`Duplicate entry path in zip archive: ${normalizedEntries[i].path}`);
        }
    }
    const localHeaders = [];
    const centralHeaders = [];
    let currentOffset = 0;
    for (const entry of normalizedEntries) {
        const nameBuffer = Buffer.from(entry.path, "utf8");
        const uncompressedSize = entry.data.length;
        const compressedSize = uncompressedSize; // Method 0 (Store)
        const crc = computeCrc32(entry.data);
        // Local file header (30 bytes + nameLen)
        const localHeader = Buffer.alloc(30 + nameBuffer.length);
        localHeader.writeUInt32LE(0x04034b50, 0); // Signature
        localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
        localHeader.writeUInt16LE(0x0800, 6); // General purpose bit flag (UTF-8 filename)
        localHeader.writeUInt16LE(0, 8); // Compression method: 0 (Store)
        localHeader.writeUInt16LE(DOS_TIME, 10); // Last mod file time
        localHeader.writeUInt16LE(DOS_DATE, 12); // Last mod file date
        localHeader.writeUInt32LE(crc, 14); // CRC-32
        localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
        localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
        localHeader.writeUInt16LE(nameBuffer.length, 26); // Filename length
        localHeader.writeUInt16LE(0, 28); // Extra field length
        nameBuffer.copy(localHeader, 30);
        const localEntryBuffer = Buffer.concat([localHeader, entry.data]);
        localHeaders.push(localEntryBuffer);
        // Central directory file header (46 bytes + nameLen)
        const centralHeader = Buffer.alloc(46 + nameBuffer.length);
        centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
        centralHeader.writeUInt16LE(20, 4); // Version made by (2.0)
        centralHeader.writeUInt16LE(20, 6); // Version needed to extract (2.0)
        centralHeader.writeUInt16LE(0x0800, 8); // General purpose bit flag (UTF-8)
        centralHeader.writeUInt16LE(0, 10); // Compression method: 0 (Store)
        centralHeader.writeUInt16LE(DOS_TIME, 12); // Last mod file time
        centralHeader.writeUInt16LE(DOS_DATE, 14); // Last mod file date
        centralHeader.writeUInt32LE(crc, 16); // CRC-32
        centralHeader.writeUInt32LE(compressedSize, 20); // Compressed size
        centralHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
        centralHeader.writeUInt16LE(nameBuffer.length, 28); // Filename length
        centralHeader.writeUInt16LE(0, 30); // Extra field length
        centralHeader.writeUInt16LE(0, 32); // File comment length
        centralHeader.writeUInt16LE(0, 34); // Disk number start
        centralHeader.writeUInt16LE(0, 36); // Internal file attributes
        centralHeader.writeUInt32LE(0x81a40000, 38); // External file attributes (regular file -rw-r--r--)
        centralHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
        nameBuffer.copy(centralHeader, 46);
        centralHeaders.push(centralHeader);
        currentOffset += localEntryBuffer.length;
    }
    const centralDirBuffer = Buffer.concat(centralHeaders);
    const centralDirOffset = currentOffset;
    const centralDirSize = centralDirBuffer.length;
    // End of central directory record (EOCD - 22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature
    eocd.writeUInt16LE(0, 4); // Disk number
    eocd.writeUInt16LE(0, 6); // Disk with central dir
    eocd.writeUInt16LE(normalizedEntries.length, 8); // Number of central dir entries on this disk
    eocd.writeUInt16LE(normalizedEntries.length, 10); // Total number of central dir entries
    eocd.writeUInt32LE(centralDirSize, 12); // Central directory size
    eocd.writeUInt32LE(centralDirOffset, 16); // Central directory offset
    eocd.writeUInt16LE(0, 20); // Comment length
    return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}
/**
 * Extracts all files from a ZIP archive buffer.
 */
export function extractZipEntries(zipBuffer) {
    if (zipBuffer.length < 22) {
        throw new Error("Invalid zip file: buffer too small to contain EOCD record.");
    }
    // Find EOCD signature (0x06054b50) searching backward
    let eocdOffset = -1;
    const minOffset = Math.max(0, zipBuffer.length - 65557);
    for (let i = zipBuffer.length - 22; i >= minOffset; i--) {
        if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1) {
        throw new Error("Invalid zip file: EOCD signature not found.");
    }
    const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirSize = zipBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    if (centralDirOffset + centralDirSize > eocdOffset) {
        throw new Error("Invalid zip file: corrupted central directory bounds.");
    }
    const entries = [];
    let currentCentralOffset = centralDirOffset;
    for (let i = 0; i < totalEntries; i++) {
        if (currentCentralOffset + 46 > centralDirOffset + centralDirSize) {
            throw new Error("Invalid zip file: unexpected end of central directory.");
        }
        const signature = zipBuffer.readUInt32LE(currentCentralOffset);
        if (signature !== 0x02014b50) {
            throw new Error(`Invalid central directory header signature: 0x${signature.toString(16)}`);
        }
        const method = zipBuffer.readUInt16LE(currentCentralOffset + 10);
        const expectedCrc = zipBuffer.readUInt32LE(currentCentralOffset + 16);
        const compressedSize = zipBuffer.readUInt32LE(currentCentralOffset + 20);
        const uncompressedSize = zipBuffer.readUInt32LE(currentCentralOffset + 24);
        const nameLen = zipBuffer.readUInt16LE(currentCentralOffset + 28);
        const extraLen = zipBuffer.readUInt16LE(currentCentralOffset + 30);
        const commentLen = zipBuffer.readUInt16LE(currentCentralOffset + 32);
        const localHeaderOffset = zipBuffer.readUInt32LE(currentCentralOffset + 42);
        const nameOffset = currentCentralOffset + 46;
        const fileName = zipBuffer.toString("utf8", nameOffset, nameOffset + nameLen);
        currentCentralOffset = nameOffset + nameLen + extraLen + commentLen;
        // Skip directory entries ending with '/'
        if (fileName.endsWith("/")) {
            continue;
        }
        // Read local header
        if (localHeaderOffset + 30 > zipBuffer.length) {
            throw new Error(`Invalid local header offset for ${fileName}`);
        }
        const localSig = zipBuffer.readUInt32LE(localHeaderOffset);
        if (localSig !== 0x04034b50) {
            throw new Error(`Invalid local header signature for ${fileName}`);
        }
        const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
        const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
        if (dataOffset + compressedSize > zipBuffer.length) {
            throw new Error(`Compressed data out of bounds for ${fileName}`);
        }
        const rawData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
        let decompressed;
        if (method === 0) {
            // Stored
            decompressed = Buffer.from(rawData);
        }
        else if (method === 8) {
            // Deflated
            decompressed = zlib.inflateRawSync(rawData);
        }
        else {
            throw new Error(`Unsupported compression method ${method} for ${fileName}`);
        }
        if (decompressed.length !== uncompressedSize) {
            throw new Error(`Decompressed size mismatch for ${fileName}: expected ${uncompressedSize}, got ${decompressed.length}`);
        }
        const actualCrc = computeCrc32(decompressed);
        if (actualCrc !== expectedCrc) {
            throw new Error(`CRC-32 mismatch for ${fileName}: expected ${expectedCrc}, got ${actualCrc}`);
        }
        entries.push({
            path: normalizeZipPath(fileName),
            data: decompressed,
        });
    }
    return entries;
}
//# sourceMappingURL=zip.js.map