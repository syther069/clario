import type { VerificationPackageBundle } from "../package/types.js";
export declare function safeJsonReviver(key: string, value: unknown): unknown;
/** Loads a Clario ZIP without writing disclosed evidence to disk. */
export declare function loadVerificationPackageZip(archive: Buffer | Uint8Array): VerificationPackageBundle;
//# sourceMappingURL=archive.d.ts.map