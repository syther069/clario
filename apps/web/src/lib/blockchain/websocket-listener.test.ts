import { describe, it, expect, vi, beforeEach } from "vitest";
import { listenToMonadEvents } from "./websocket-listener";

describe("Alchemy Monad WebSockets Event Stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("safely returns a cleanup function in SSR / Node environments without crashing", () => {
    const unwatch = listenToMonadEvents({
      userAddress: "0x1111111111111111111111111111111111111111",
      onReceiptSaved: vi.fn(),
      onTransactionSaved: vi.fn(),
    });

    expect(typeof unwatch).toBe("function");
    // Executing cleanup function should not throw
    expect(() => unwatch()).not.toThrow();
  });
});
