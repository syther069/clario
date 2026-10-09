import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js Security Headers Configuration", () => {
  it("disables poweredByHeader by default", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("exports headers configuration function for all routes", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;

    const headersConfig = await nextConfig.headers();
    expect(Array.isArray(headersConfig)).toBe(true);
    expect(headersConfig.length).toBeGreaterThan(0);

    const rootRule = headersConfig.find((r) => r.source === "/:path*");
    expect(rootRule).toBeDefined();
    expect(rootRule?.headers).toBeDefined();

    const headersMap = new Map(
      rootRule?.headers.map((h) => [h.key, h.value]),
    );

    // 1. Anti-clickjacking
    expect(headersMap.get("X-Frame-Options")).toBe("DENY");

    // 2. Anti-MIME sniffing
    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");

    // 3. Referrer leak protection
    expect(headersMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );

    // 4. Strict HSTS
    expect(headersMap.get("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );
    expect(headersMap.get("Strict-Transport-Security")).toContain(
      "includeSubDomains",
    );

    // 5. Sensor & Privacy Permissions Policy
    expect(headersMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headersMap.get("Permissions-Policy")).toContain("microphone=()");
    expect(headersMap.get("Permissions-Policy")).toContain("geolocation=()");

    // 6. Content Security Policy (CSP)
    const csp = headersMap.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
