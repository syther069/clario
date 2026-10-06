import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetRateLimits } from "./rate-limit";

describe("In-Memory Sliding-Window Rate Limiter", () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  it("allows requests under the rate limit", () => {
    const config = { maxRequests: 3, windowMs: 1000 };
    const res1 = checkRateLimit("test-ip", config);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit("test-ip", config);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit("test-ip", config);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests that exceed the rate limit", () => {
    const config = { maxRequests: 2, windowMs: 1000 };
    checkRateLimit("test-ip-blocked", config);
    checkRateLimit("test-ip-blocked", config);

    const blocked = checkRateLimit("test-ip-blocked", config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("isolates distinct keys independently", () => {
    const config = { maxRequests: 1, windowMs: 1000 };
    const userA = checkRateLimit("user-a", config);
    expect(userA.allowed).toBe(true);

    const userABlocked = checkRateLimit("user-a", config);
    expect(userABlocked.allowed).toBe(false);

    const userB = checkRateLimit("user-b", config);
    expect(userB.allowed).toBe(true);
  });
});
