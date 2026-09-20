import { randomBytes } from "node:crypto";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";

export interface AuthChallengeOptions {
  address: string;
  chainId: number;
  domain: string;
  uri: string;
  statement?: string | undefined;
  ttlSeconds?: number | undefined;
}

export interface AuthChallenge {
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  statement: string;
  version: "1";
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  message: string;
}

export interface ChallengeRecord {
  nonce: string;
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  issuedAt: number;
  expirationTime: number;
  consumed: boolean;
}

export interface ChallengeStore {
  save(record: ChallengeRecord): Promise<void> | void;
  get(
    nonce: string,
  ): Promise<ChallengeRecord | undefined> | ChallengeRecord | undefined;
  markConsumed(nonce: string): Promise<boolean> | boolean;
  clearExpired(): Promise<void> | void;
}

/**
 * In-memory challenge store with atomic single-use nonce consumption.
 */
export class MemoryChallengeStore implements ChallengeStore {
  private readonly store = new Map<string, ChallengeRecord>();

  save(record: ChallengeRecord): void {
    this.store.set(record.nonce, { ...record });
  }

  get(nonce: string): ChallengeRecord | undefined {
    const rec = this.store.get(nonce);
    return rec ? { ...rec } : undefined;
  }

  markConsumed(nonce: string): boolean {
    const rec = this.store.get(nonce);
    if (!rec || rec.consumed) {
      return false;
    }
    rec.consumed = true;
    this.store.set(nonce, rec);
    return true;
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [nonce, rec] of this.store.entries()) {
      if (rec.expirationTime <= now || rec.consumed) {
        this.store.delete(nonce);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const defaultChallengeStore = new MemoryChallengeStore();

export const DEFAULT_CHALLENGE_STATEMENT = "Sign in to Clario.";
export const DEFAULT_CHALLENGE_TTL_SECONDS = 300; // 5 minutes

/**
 * Formats an EIP-4361 standard Sign-In with Ethereum challenge message.
 */
export function formatEip4361Message(params: {
  domain: string;
  address: `0x${string}`;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    params.statement,
    "",
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expirationTime}`,
  ].join("\n");
}

export interface ParsedEip4361Message {
  domain: string;
  address: `0x${string}`;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

/**
 * Parses an EIP-4361 message string into structured components.
 * Throws an Error if the message is malformed.
 */
export function parseEip4361Message(message: string): ParsedEip4361Message {
  const lines = message.split("\n");
  if (lines.length < 11) {
    throw new Error("Malformed EIP-4361 message: insufficient lines.");
  }

  const headerMatch = lines[0]?.match(
    /^(.+) wants you to sign in with your Ethereum account:$/,
  );
  if (!headerMatch?.[1]) {
    throw new Error("Malformed EIP-4361 message: missing domain header.");
  }
  const domain = headerMatch[1].trim();

  const rawAddress = lines[1]?.trim();
  if (!rawAddress || !isAddress(rawAddress)) {
    throw new Error("Malformed EIP-4361 message: invalid address.");
  }
  const address = getAddress(rawAddress);

  // Line 2 is empty, Line 3 is statement, Line 4 is empty
  const statement = lines[3]?.trim();
  if (!statement) {
    throw new Error("Malformed EIP-4361 message: missing statement.");
  }

  let uri = "";
  let version = "";
  let chainId = 0;
  let nonce = "";
  let issuedAt = "";
  let expirationTime = "";

  for (let i = 5; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    if (line.startsWith("URI: ")) {
      uri = line.substring(5).trim();
    } else if (line.startsWith("Version: ")) {
      version = line.substring(9).trim();
    } else if (line.startsWith("Chain ID: ")) {
      chainId = parseInt(line.substring(10).trim(), 10);
    } else if (line.startsWith("Nonce: ")) {
      nonce = line.substring(7).trim();
    } else if (line.startsWith("Issued At: ")) {
      issuedAt = line.substring(11).trim();
    } else if (line.startsWith("Expiration Time: ")) {
      expirationTime = line.substring(17).trim();
    }
  }

  if (
    !uri ||
    !version ||
    !chainId ||
    !nonce ||
    !issuedAt ||
    !expirationTime ||
    isNaN(chainId)
  ) {
    throw new Error("Malformed EIP-4361 message: missing required fields.");
  }

  return {
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  };
}

/**
 * Creates and registers a new authentication challenge.
 */
export async function createAuthChallenge(
  options: AuthChallengeOptions,
  store: ChallengeStore = defaultChallengeStore,
): Promise<AuthChallenge> {
  if (!isAddress(options.address)) {
    throw new Error(`Invalid Ethereum address: ${options.address}`);
  }
  const address = getAddress(options.address);

  if (
    !Number.isSafeInteger(options.chainId) ||
    options.chainId <= 0 ||
    options.chainId > 2147483647
  ) {
    throw new Error(`Invalid chain ID: ${options.chainId}`);
  }

  if (!options.domain || options.domain.trim().length === 0) {
    throw new Error("Challenge domain is required.");
  }

  if (!options.uri || options.uri.trim().length === 0) {
    throw new Error("Challenge URI is required.");
  }

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_CHALLENGE_TTL_SECONDS;
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const expirationTime = new Date(now + ttlSeconds * 1000).toISOString();

  // Generate 32 hex chars (16 bytes) secure random nonce
  const nonce = randomBytes(16).toString("hex");
  const statement = options.statement ?? DEFAULT_CHALLENGE_STATEMENT;

  const message = formatEip4361Message({
    domain: options.domain,
    address,
    statement,
    uri: options.uri,
    version: "1",
    chainId: options.chainId,
    nonce,
    issuedAt,
    expirationTime,
  });

  await store.save({
    nonce,
    address,
    chainId: options.chainId,
    domain: options.domain,
    uri: options.uri,
    issuedAt: now,
    expirationTime: now + ttlSeconds * 1000,
    consumed: false,
  });

  return {
    address,
    chainId: options.chainId,
    domain: options.domain,
    uri: options.uri,
    statement,
    version: "1",
    nonce,
    issuedAt,
    expirationTime,
    message,
  };
}

export interface VerifyAuthChallengeOptions {
  message: string;
  signature: Hex | string;
  expectedDomain?: string | undefined;
  expectedChainId?: number | undefined;
}

export interface VerifiedAuthChallenge {
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  verifiedAt: string;
}

/**
 * Verifies an EIP-4361 challenge message and its cryptographic signature.
 * Enforces single-use nonce consumption, expiration, domain, chain, and address matching.
 */
export async function verifyAuthChallenge(
  options: VerifyAuthChallengeOptions,
  store: ChallengeStore = defaultChallengeStore,
): Promise<VerifiedAuthChallenge> {
  const parsed = parseEip4361Message(options.message);

  if (
    options.expectedDomain &&
    parsed.domain.toLowerCase() !== options.expectedDomain.toLowerCase()
  ) {
    throw new Error(
      `Domain mismatch: expected ${options.expectedDomain}, got ${parsed.domain}.`,
    );
  }

  if (
    options.expectedChainId !== undefined &&
    parsed.chainId !== options.expectedChainId
  ) {
    throw new Error(
      `Chain ID mismatch: expected ${options.expectedChainId}, got ${parsed.chainId}.`,
    );
  }

  const record = await store.get(parsed.nonce);
  if (!record) {
    throw new Error(
      "Unknown or expired challenge nonce. Please request a new challenge.",
    );
  }

  if (record.consumed) {
    throw new Error("Challenge nonce has already been used. Replay rejected.");
  }

  const now = Date.now();
  if (now > record.expirationTime) {
    throw new Error("Challenge has expired. Please request a new challenge.");
  }

  if (record.address.toLowerCase() !== parsed.address.toLowerCase()) {
    throw new Error("Challenge address mismatch.");
  }

  if (record.chainId !== parsed.chainId) {
    throw new Error("Challenge chain ID mismatch.");
  }

  if (
    !options.signature ||
    typeof options.signature !== "string" ||
    !options.signature.startsWith("0x")
  ) {
    throw new Error("Signature must be a 0x-prefixed hex string.");
  }

  // Atomically mark consumed BEFORE verifying signature to prevent concurrent reuse
  const consumed = await store.markConsumed(parsed.nonce);
  if (!consumed) {
    throw new Error(
      "Challenge nonce has already been used. Concurrent replay rejected.",
    );
  }

  let isValidSignature = false;
  try {
    isValidSignature = await verifyMessage({
      address: parsed.address,
      message: options.message,
      signature: options.signature as Hex,
    });
  } catch (err) {
    throw new Error(
      `Cryptographic signature verification failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  if (!isValidSignature) {
    throw new Error(
      "Invalid signature: recovered address does not match challenge address.",
    );
  }

  return {
    address: parsed.address,
    chainId: parsed.chainId,
    domain: parsed.domain,
    uri: parsed.uri,
    nonce: parsed.nonce,
    issuedAt: parsed.issuedAt,
    expirationTime: parsed.expirationTime,
    verifiedAt: new Date(now).toISOString(),
  };
}
