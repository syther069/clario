import { describe, it, expect } from "vitest";
import { detectCryptoIdentity } from "./crypto-icon";

describe("detectCryptoIdentity", () => {
  it("returns null for empty or non-crypto input", () => {
    expect(detectCryptoIdentity("")).toBeNull();
    expect(detectCryptoIdentity(null)).toBeNull();
    expect(detectCryptoIdentity(undefined)).toBeNull();
    expect(detectCryptoIdentity("Credit Card")).toBeNull();
    expect(detectCryptoIdentity("Chase Visa")).toBeNull();
    expect(detectCryptoIdentity("Bank Wire")).toBeNull();
  });

  it("prioritizes stablecoins and tokens over substring chain matches", () => {
    // "Onchain (USDC)" has both "onchain" and "usdc". It should match USDC token.
    const usdcMatch = detectCryptoIdentity("Onchain (USDC)");
    expect(usdcMatch).toEqual({ kind: "token", identifier: "USDC" });

    const usdtMatch = detectCryptoIdentity("Onchain (USDT)");
    expect(usdtMatch).toEqual({ kind: "token", identifier: "USDT" });

    const daiMatch = detectCryptoIdentity("Payment via DAI");
    expect(daiMatch).toEqual({ kind: "token", identifier: "DAI" });

    const btcMatch = detectCryptoIdentity("WBTC transfer");
    expect(btcMatch).toEqual({ kind: "token", identifier: "BTC" });
  });

  it("identifies supported chains properly", () => {
    expect(detectCryptoIdentity("Onchain (Monad)")).toEqual({
      kind: "chain",
      identifier: "143",
    });
    expect(detectCryptoIdentity("Monad Testnet 10143")).toEqual({
      kind: "chain",
      identifier: "143",
    });
    expect(detectCryptoIdentity("Base Network")).toEqual({
      kind: "chain",
      identifier: "8453",
    });
    expect(detectCryptoIdentity("Hyperliquid HYPE")).toEqual({
      kind: "chain",
      identifier: "999",
    });
    expect(detectCryptoIdentity("Arbitrum One")).toEqual({
      kind: "chain",
      identifier: "42161",
    });
    expect(detectCryptoIdentity("Optimism")).toEqual({
      kind: "chain",
      identifier: "10",
    });
    expect(detectCryptoIdentity("Polygon")).toEqual({
      kind: "chain",
      identifier: "137",
    });
    expect(detectCryptoIdentity("Ethereum Mainnet")).toEqual({
      kind: "chain",
      identifier: "1",
    });
  });

  it("identifies native tokens", () => {
    expect(detectCryptoIdentity("ETH")).toEqual({
      kind: "token",
      identifier: "ETH",
    });
    expect(detectCryptoIdentity("MON")).toEqual({
      kind: "token",
      identifier: "MON",
    });
  });

  it("defaults generic onchain payment method to Monad (143) per Rule 3", () => {
    expect(detectCryptoIdentity("Onchain")).toEqual({
      kind: "chain",
      identifier: "143",
    });
    expect(detectCryptoIdentity("Onchain transfer")).toEqual({
      kind: "chain",
      identifier: "143",
    });
  });
});
