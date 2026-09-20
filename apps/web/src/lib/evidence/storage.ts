import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface StorageDriver {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Generates an opaque storage key for private evidence.
 * NEVER includes original filenames, merchant names, amounts, or personal identifiers.
 */
export function generateEvidenceStorageKey(
  workspaceId: string,
  evidenceId: string,
): string {
  // Sanitize workspaceId and evidenceId to prevent path traversal
  const safeWorkspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeEvidence = evidenceId.replace(/[^a-zA-Z0-9_-]/g, "");

  if (!safeWorkspace || !safeEvidence) {
    throw new Error(
      "Invalid workspaceId or evidenceId for storage key generation.",
    );
  }

  return `evidence/${safeWorkspace}/${safeEvidence}.enc`;
}

/**
 * In-memory storage driver for tests and ephemeral runs.
 */
export class MemoryStorageDriver implements StorageDriver {
  private readonly store = new Map<
    string,
    { data: Buffer; contentType?: string | undefined }
  >();

  async put(key: string, data: Buffer, contentType?: string): Promise<void> {
    this.store.set(key, { data: Buffer.from(data), contentType });
  }

  async get(key: string): Promise<Buffer | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return Buffer.from(entry.data);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Filesystem-backed storage driver for local development and self-hosted deployments.
 */
export class DiskStorageDriver implements StorageDriver {
  readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(
      /*turbopackIgnore: true*/ baseDir ??
        process.env.CLARIO_STORAGE_DIR ??
        ".clario-storage",
    );
  }

  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(
        "Security violation: path traversal detected in storage key.",
      );
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = this.resolveSafePath(key);
    try {
      return await fs.readFile(filePath);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        return;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

let defaultDriver: StorageDriver | null = null;

export function getDefaultStorageDriver(): StorageDriver {
  if (defaultDriver) return defaultDriver;

  if (process.env.STORAGE_DRIVER === "disk") {
    defaultDriver = new DiskStorageDriver();
  } else {
    defaultDriver = new MemoryStorageDriver();
  }

  return defaultDriver;
}

export function setDefaultStorageDriver(driver: StorageDriver | null): void {
  defaultDriver = driver;
}
