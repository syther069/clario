import { describe, it, expect, vi, beforeEach } from "vitest";
import { MonadFallbackImportAdapter } from "./monad-fallback";
import { IMPORTED_FACTS_DISCLAIMER } from "./types";

describe("MonadFallbackImportAdapter", () => {
  const dummyAlchemyKey = "test_alchemy_key_12345";
  const dummyExplorerKey = "test_explorer_key_67890";
  const testAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as const;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves correct RPC URLs for Monad Mainnet and Testnet", () => {
    const adapter = new MonadFallbackImportAdapter(dummyAlchemyKey);
    expect(adapter.getRpcUrl(143)).toBe(
      `https://monad-mainnet.g.alchemy.com/v2/${dummyAlchemyKey}`,
    );
    expect(adapter.getRpcUrl(10143)).toBe("https://testnet-rpc.monad.xyz");

    const unconfigured = new MonadFallbackImportAdapter("");
    expect(unconfigured.getRpcUrl(143)).toBe("https://rpc.monad.xyz");
  });

  it("fetches and normalizes transactions from Etherscan v2 API fallback", async () => {
    const mockTokenTxResponse = {
      status: "1",
      message: "OK",
      result: [
        {
          blockNumber: "109340100",
          timeStamp: "1727701000",
          hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          from: testAddress,
          to: "0x2222222222222222222222222222222222222222",
          value: "50000000",
          tokenName: "USD Coin",
          tokenSymbol: "USDC",
          tokenDecimal: "6",
          contractAddress: "0x754704bc059f8c67012fed69bc8a327a5aafb603",
        },
      ],
    };

    const mockNormalTxResponse = {
      status: "1",
      message: "OK",
      result: [
        {
          blockNumber: "109340050",
          timeStamp: "1727700500",
          hash: "0x3333333333333333333333333333333333333333333333333333333333333333",
          from: "0x4444444444444444444444444444444444444444",
          to: testAddress,
          value: "2000000000000000000",
          isError: "0",
          txreceipt_status: "1",
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("action=tokentx")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockTokenTxResponse,
        });
      }
      if (url.includes("action=txlist")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockNormalTxResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const adapter = new MonadFallbackImportAdapter(
      dummyAlchemyKey,
      dummyExplorerKey,
    );
    const result = await adapter.fetchTransactions({
      address: testAddress,
      chainId: 143,
    });

    expect(result.items.length).toBe(2);

    // First item should be USDC (Rule 4 token priority: USDC > Native)
    const usdcItem = result.items[0]!;
    expect(usdcItem.assetSymbol).toBe("USDC");
    expect(usdcItem.formattedAmount).toBe("50");
    expect(usdcItem.usdValue).toBe(50.0);
    expect(usdcItem.usdValueFormatted).toBe("$50.00");
    expect(usdcItem.provenance.provider).toBe("monad_explorer");
    expect(usdcItem.provenance.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);

    // Second item should be native MON
    const monItem = result.items[1]!;
    expect(monItem.assetSymbol).toBe("MON");
    expect(monItem.formattedAmount).toBe("2");
    expect(monItem.provenance.provider).toBe("monad_explorer");
  });

  it("filters out spam tokens and zero amounts", async () => {
    const mockTokenTxResponse = {
      status: "1",
      message: "OK",
      result: [
        {
          blockNumber: "109340100",
          timeStamp: "1727701000",
          hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          from: testAddress,
          to: "0x2222222222222222222222222222222222222222",
          value: "1000000000000000000",
          tokenName: "Claim Free Tokens at scam.com",
          tokenSymbol: "SCAM.COM",
          tokenDecimal: "18",
          contractAddress: "0x9999999999999999999999999999999999999999",
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("action=tokentx")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockTokenTxResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: "0", result: [] }),
      });
    });

    const adapter = new MonadFallbackImportAdapter(
      dummyAlchemyKey,
      dummyExplorerKey,
    );
    const result = await adapter.fetchTransactions({
      address: testAddress,
      chainId: 143,
    });

    // Spam token is filtered out
    expect(result.items.length).toBe(0);
  });
});
