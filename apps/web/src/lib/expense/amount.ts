/**
 * Clario Expense Amount & Token Asset Utilities
 *
 * Implements strict integer base-unit parsing, decimal conversions,
 * address normalization, and asset metadata support for Monad.
 */

export interface TokenAsset {
  readonly symbol: string;
  readonly name: string;
  readonly address: `0x${string}`;
  readonly decimals: number;
  readonly chainId: number;
}

export const SUPPORTED_TOKENS: readonly TokenAsset[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x0000000000000000000000000000000000001001",
    decimals: 6,
    chainId: 10143,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x0000000000000000000000000000000000001002",
    decimals: 6,
    chainId: 10143,
  },
  {
    symbol: "WMON",
    name: "Wrapped MON",
    address: "0x0000000000000000000000000000000000001003",
    decimals: 18,
    chainId: 10143,
  },
] as const;

export const DEFAULT_TOKEN = SUPPORTED_TOKENS[0]!;

export function findTokenAsset(identifier: string): TokenAsset | undefined {
  const clean = identifier.trim().toLowerCase();
  return SUPPORTED_TOKENS.find(
    (t) =>
      t.address.toLowerCase() === clean || t.symbol.toLowerCase() === clean,
  );
}

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL_AMOUNT_REGEX = /^[0-9]+(\.[0-9]+)?$/;

/**
 * Checks if a string is a valid EVM address format.
 */
export function isValidAddress(val: unknown): val is `0x${string}` {
  return typeof val === "string" && ADDRESS_REGEX.test(val.trim());
}

/**
 * Normalizes an EVM address to lowercase 0x-prefixed 40 hex chars.
 */
export function normalizeAddress(address: string): `0x${string}` {
  const trimmed = address.trim();
  if (!ADDRESS_REGEX.test(trimmed)) {
    throw new Error(`Invalid EVM address: "${address}".`);
  }
  return trimmed.toLowerCase() as `0x${string}`;
}

/**
 * Parses a human-readable decimal amount string (e.g. "150.25") into base units (e.g. 150250000n for 6 decimals).
 *
 * Enforces:
 * - Positive non-negative input
 * - Rejection of scientific notation, signs, non-numeric characters
 * - Fractional precision does not exceed the asset's configured decimals
 * - Max amount fits within NUMERIC(78, 0)
 */
export function parseBaseUnits(amountStr: string, decimals: number): bigint {
  if (typeof amountStr !== "string") {
    throw new Error("Amount must be a string.");
  }

  const trimmed = amountStr.trim();
  if (!trimmed || !DECIMAL_AMOUNT_REGEX.test(trimmed)) {
    throw new Error(
      `Invalid decimal amount format: "${amountStr}". Must be a non-negative decimal number.`,
    );
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(
      `Invalid token decimals: ${decimals}. Must be between 0 and 36.`,
    );
  }

  const [intPart, fracPart = ""] = trimmed.split(".");

  if (fracPart.length > decimals) {
    throw new Error(
      `Amount "${amountStr}" exceeds allowed precision of ${decimals} decimal places.`,
    );
  }

  const paddedFrac = fracPart.padEnd(decimals, "0");
  const wholeBaseUnitsStr =
    `${intPart}${paddedFrac}`.replace(/^0+(?=\d)/, "") || "0";
  const baseUnits = BigInt(wholeBaseUnitsStr);

  // NUMERIC(78, 0) check: 10^78 - 1
  const maxUint256Approx = 10n ** 78n - 1n;
  if (baseUnits > maxUint256Approx) {
    throw new Error("Amount exceeds maximum allowed limit.");
  }

  return baseUnits;
}

/**
 * Formats integer base units (e.g. 150250000n or "150250000") into a human-readable decimal string.
 */
export function formatBaseUnits(
  baseUnits: bigint | string | number,
  decimals: number,
  trimTrailingZeros = true,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Invalid token decimals: ${decimals}.`);
  }

  const raw = BigInt(baseUnits);
  if (raw < 0n) {
    throw new Error("Base units must be non-negative.");
  }

  if (decimals === 0) {
    return raw.toString();
  }

  const rawStr = raw.toString().padStart(decimals + 1, "0");
  const intPart = rawStr.slice(0, rawStr.length - decimals) || "0";
  let fracPart = rawStr.slice(rawStr.length - decimals);

  if (trimTrailingZeros) {
    fracPart = fracPart.replace(/0+$/, "");
    return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  }

  return `${intPart}.${fracPart}`;
}
