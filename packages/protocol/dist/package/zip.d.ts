export interface ZipEntry {
    path: string;
    data: Buffer;
}
/**
 * Computes standard CRC-32 checksum.
 */
export declare function computeCrc32(buffer: Uint8Array): number;
/**
 * Normalizes a ZIP entry path: forward slashes, no leading/trailing slash, no directory traversal.
 */
export declare function normalizeZipPath(rawPath: string): string;
/**
 * Creates a deterministic ZIP archive from a list of entries.
 * Entries are sorted lexicographically by normalized path.
 * Compression method 0 (STORE) is used for 100% deterministic bit-for-bit reproducibility.
 */
export declare function createDeterministicZip(entries: ZipEntry[]): Buffer;
/**
 * Extracts all files from a ZIP archive buffer.
 */
export declare function extractZipEntries(zipBuffer: Buffer): ZipEntry[];
//# sourceMappingURL=zip.d.ts.map