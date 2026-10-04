import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlchemyImportAdapter, getAlchemyEndpoint } from "./alchemy";
import { IMPORTED_FACTS_DISCLAIMER } from "./types";

describe("AlchemyImportAdapter", () => {
  const dummyKey = "test_alchemy_key_12345";
  const testAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as const;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves correct Alchemy endpoints per chain ID", () => {
    expect(getAlchemyEndpoint(10143, dummyKey)).toBe(
      `https://monad-testnet.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(143, dummyKey)).toBe(
      `https://monad-mainnet.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(1, dummyKey)).toBe(
      `https://eth-mainnet.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(11155111, dummyKey)).toBe(
      `https://eth-sepolia.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(8453, dummyKey)).toBe(
      `https://base-mainnet.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(84532, dummyKey)).toBe(
      `https://base-sepolia.g.alchemy.com/v2/${dummyKey}`,
    );
    expect(getAlchemyEndpoint(99999, dummyKey)).toBeNull(); // Unsupported chain
    expect(getAlchemyEndpoint(1, "")).toBeNull();
  });

  it("reports configuration status correctly", () => {
    const unconfigured = new AlchemyImportAdapter("");
    expect(unconfigured.isConfigured()).toBe(false);

    const configured = new AlchemyImportAdapter(dummyKey);
    expect(configured.isConfigured()).toBe(true);
  });

  it("returns empty results if unconfigured or on unsupported chain", async () => {
    const unconfigured = new AlchemyImportAdapter("");
    const res = await unconfigured.fetchTransactions({ address: testAddress });
    expect(res.items).toEqual([]);

    const configured = new AlchemyImportAdapter(dummyKey);
    const unsupportedRes = await configured.fetchTransactions({
      address: testAddress,
      chainId: 99999,
    });
    expect(unsupportedRes.items).toEqual([]);
  });

  it("fetches and normalizes asset transfers successfully", async () => {
    const mockTransfers = [
      {
        blockNum: "0x18e0d09",
        uniqueId: "0xabc:erc20",
        hash: "0x4cb3f2185d827e9ebb274080502b100a448b04cdbbade9fee4fb9559e1627a79",
        from: testAddress,
        to: "0x998252ea9cb19b3fbc137e111d87808aafff08cf",
        value: 15,
        asset: "DAI",
        category: "erc20",
        rawContract: {
          value: "0xd02ab486cedc0000",
          address: "0x6b175474e89094c44da98b954eedeac495271d0f",
          decimal: "0x12",
        },
        metadata: {
          blockTimestamp: "2026-09-30T00:19:23.000Z",
        },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: {
          transfers: mockTransfers,
          pageKey: "next_cursor_page_1",
        },
      }),
    } as unknown as Response);

    const adapter = new AlchemyImportAdapter(dummyKey);
    const result = await adapter.fetchTransactions({
      address: testAddress,
      chainId: 1,
    });

    expect(result.items.length).toBe(1);
    expect(result.nextCursor).toBe("next_cursor_page_1");

    const item = result.items[0]!;
    expect(item.sourceChainId).toBe(1);
    expect(item.sourceTransactionHash).toBe(
      "0x4cb3f2185d827e9ebb274080502b100a448b04cdbbade9fee4fb9559e1627a79",
    );
    expect(item.sender).toBe(testAddress.toLowerCase());
    expect(item.assetSymbol).toBe("DAI");
    expect(item.formattedAmount).toBe("15");
    expect(item.assetDecimals).toBe(18);
    expect(item.provenance.provider).toBe("alchemy");
    expect(item.provenance.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
  });
});
