import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTreasuryPortfolio } from "./portfolio";
import * as registry from "./registry";

describe("Alchemy Treasury Portfolio & Runway Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates multi-asset balances and USD valuation correctly", async () => {
    const mockGetBalance = vi.fn().mockResolvedValue(2500000000000000000n); // 2.5 MON
    const mockReadContract = vi.fn().mockResolvedValue(500000000n); // 500 USDC (6 decimals)

    vi.spyOn(registry, "getMonadPublicClient").mockReturnValue({
      getBalance: mockGetBalance,
      readContract: mockReadContract,
    } as unknown as ReturnType<typeof registry.getMonadPublicClient>);

    const summary = await getTreasuryPortfolio(
      "0x1111111111111111111111111111111111111111",
    );

    expect(summary.address).toBe("0x1111111111111111111111111111111111111111");
    expect(summary.tokens.length).toBe(2);

    const monToken = summary.tokens.find((t) => t.symbol === "MON");
    expect(monToken).toBeDefined();
    expect(monToken?.formattedBalance).toBe("2.5");

    const usdcToken = summary.tokens.find((t) => t.symbol === "USDC");
    expect(usdcToken).toBeDefined();
    expect(usdcToken?.formattedBalance).toBe("500");
    expect(usdcToken?.usdValue).toBe(500);

    expect(summary.totalUsdValue).toBeGreaterThanOrEqual(500);
    expect(summary.fetchedAt).toBeDefined();
  });
});
