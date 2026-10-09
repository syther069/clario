/**
 * Server-Side Request Forgery (SSRF) Guard
 * Validates destination URLs against private IP probing, cloud metadata services,
 * loopback interfaces, and unauthorized schemes.
 * 
 * Complies with OWASP Top 10 A10:2021 (SSRF) and Clario Network Security Guidelines.
 */

export interface SsrGuardOptions {
  /** If true, permits loopback/localhost only in non-production environments (e.g., local Anvil / Hardhat) */
  allowLocalhost?: boolean | undefined;
  /** Restricts permitted schemes. Defaults to ['https:', 'http:'] (https preferred) */
  allowedProtocols?: string[] | undefined;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "metadata.internal",
]);

/**
 * Checks if a standard IPv4 string falls into private, loopback, or cloud metadata ranges.
 */
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 string treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Broadcast/Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private network Class A)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local / AWS, GCP, Azure metadata services e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private network Class B)
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private network Class C)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Benchmark testing)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 224.0.0.0/4 (Multicast)
  if (a !== undefined && a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a !== undefined && a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 string falls into private or loopback ranges.
 */
function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1) or Unspecified (::)
  if (normalized === "::1" || normalized === "::") return true;

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // Unique local addresses (fc00::/7 -> fc00:: and fd00::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.substring(7);
    return isPrivateOrReservedIpv4(v4Part);
  }

  return false;
}

/**
 * Asserts that a URL string is safe from SSRF vulnerabilities.
 * Returns the parsed URL if safe; throws an error otherwise.
 */
export function assertSafeUrl(
  input: string | URL,
  options?: SsrGuardOptions,
): URL {
  let parsed: URL;
  try {
    parsed = typeof input === "string" ? new URL(input) : input;
  } catch {
    throw new Error(`SSRF_BLOCKED: Invalid URL format.`);
  }

  const allowedProtocols = options?.allowedProtocols ?? ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      `SSRF_BLOCKED: Protocol '${parsed.protocol}' is not allowed. Only [${allowedProtocols.join(", ")}] are permitted.`,
    );
  }

  const rawHost = parsed.hostname.toLowerCase();
  // Strip brackets from IPv6 hostnames like [::1]
  const hostname = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1)
    : rawHost;

  // Allow localhost only if explicitly enabled AND not running in production
  const isLocalhost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (isLocalhost) {
    if (options?.allowLocalhost && process.env.NODE_ENV !== "production") {
      return parsed;
    }
    throw new Error(
      `SSRF_BLOCKED: Access to localhost or loopback interface '${rawHost}' is forbidden.`,
    );
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(
      `SSRF_BLOCKED: Target hostname '${hostname}' is a restricted infrastructure or metadata endpoint.`,
    );
  }

  // Check IPv4 pattern
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateOrReservedIpv4(hostname)) {
      throw new Error(
        `SSRF_BLOCKED: Destination IPv4 address '${hostname}' is reserved or private.`,
      );
    }
  }

  // Check IPv6 pattern
  if (hostname.includes(":")) {
    if (isPrivateOrReservedIpv6(hostname)) {
      throw new Error(
        `SSRF_BLOCKED: Destination IPv6 address '${hostname}' is reserved or private.`,
      );
    }
  }

  return parsed;
}

/**
 * Returns true if the URL is safe, false otherwise.
 */
export function isSafeUrl(input: string | URL, options?: SsrGuardOptions): boolean {
  try {
    assertSafeUrl(input, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a custom or external RPC URL before allowing outbound connection.
 * Enforces HTTPS in production; allows HTTP localhost only in local development.
 */
export function validateSafeRpcUrl(rawUrl: string): string {
  const parsed = assertSafeUrl(rawUrl, {
    allowLocalhost: true,
    allowedProtocols: ["https:", "http:"],
  });

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(
      `SSRF_BLOCKED: Production RPC endpoints must use secure HTTPS transport. Got '${parsed.protocol}'.`,
    );
  }

  return parsed.toString();
}

/**
 * SSRF-safe wrapper around native fetch.
 */
export async function safeFetch(
  input: string | URL,
  init?: RequestInit,
  options?: SsrGuardOptions,
): Promise<Response> {
  const verifiedUrl = assertSafeUrl(input, options);
  return await fetch(verifiedUrl.toString(), init);
}
