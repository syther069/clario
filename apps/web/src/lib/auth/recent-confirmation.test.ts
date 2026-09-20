import { describe, expect, it } from "vitest";
import { assertRecentConfirmation, MAX_CONFIRMATION_AGE_MS } from "./policy";
import { createSessionPayload, rotateSession } from "./session";

describe("Recent Wallet Confirmation Assertion (APP-002)", () => {
  const secret = "test-secret-at-least-16-characters-long!";
  const userId = "11111111-1111-1111-1111-111111111111";
  const address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  it("passes when wallet confirmation is recent", () => {
    const session = createSessionPayload({
      userId,
      address,
      lastConfirmedAt: Date.now() - 5 * 60 * 1000, // 5 mins ago
    });

    expect(() => assertRecentConfirmation(session)).not.toThrow();
  });

  it("fails closed when wallet confirmation exceeds 15 minutes", () => {
    const session = createSessionPayload({
      userId,
      address,
      lastConfirmedAt: Date.now() - (MAX_CONFIRMATION_AGE_MS + 1000), // 15 mins and 1 sec ago
    });

    expect(() => assertRecentConfirmation(session)).toThrow(
      /Recent wallet confirmation is required/i,
    );
  });

  it("succeeds after refreshing wallet confirmation via session rotation", () => {
    const staleSession = createSessionPayload({
      userId,
      address,
      lastConfirmedAt: Date.now() - 20 * 60 * 1000, // 20 mins ago
    });

    expect(() => assertRecentConfirmation(staleSession)).toThrow();

    // Re-confirmation refreshes timestamp
    const { payload: refreshedSession } = rotateSession(staleSession, secret, {
      refreshConfirmation: true,
    });

    expect(() => assertRecentConfirmation(refreshedSession)).not.toThrow();
  });
});
