import { describe, it, expect } from "vitest";
import {
  MockImportAdapter,
  CompositeImportAdapter,
  RpcImportAdapter,
} from "./adapter";
import { IMPORTED_FACTS_DISCLAIMER } from "./types";

describe("Transaction Import Adapters", () => {
  const testAddress = "0x1111111111111111111111111111111111111111" as const;

  it("fetches normalized multichain transactions via MockImportAdapter", async () => {
    const adapter = new MockImportAdapter();
    const { items, nextCursor } = await adapter.fetchTransactions({
      address: testAddress,
      limit: 10,
    });

    expect(items.length).toBeGreaterThan(0);
    expect(nextCursor).toBeNull();

    // Check properties of first fixture
    const tx = items[0]!;
    expect(tx.sourceTransactionHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(tx.sender.toLowerCase()).toBe(testAddress.toLowerCase());
    expect(tx.rawAmount).toBeDefined();
    expect(tx.formattedAmount).toBeDefined();
    expect(tx.provenance.provider).toBe("mock");
    expect(tx.provenance.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
  });

  it("filters transactions by chainId in MockImportAdapter", async () => {
    const adapter = new MockImportAdapter();
    const { items: monadItems } = await adapter.fetchTransactions({
      address: testAddress,
      chainId: 10143,
    });

    expect(monadItems.every((item) => item.sourceChainId === 10143)).toBe(true);

    const { items: baseItems } = await adapter.fetchTransactions({
      address: testAddress,
      chainId: 8453,
    });

    expect(baseItems.every((item) => item.sourceChainId === 8453)).toBe(true);
  });

  it("supports pagination with limit and cursor", async () => {
    const adapter = new MockImportAdapter();
    const page1 = await adapter.fetchTransactions({
      address: testAddress,
      limit: 2,
    });

    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBe("2");

    const page2 = await adapter.fetchTransactions({
      address: testAddress,
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.items.length).toBe(2);
    expect(page2.items[0]!.sourceTransactionHash).not.toBe(
      page1.items[0]!.sourceTransactionHash,
    );
  });

  it("fetches single transaction by hash", async () => {
    const adapter = new MockImportAdapter();
    const hash =
      "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
    const tx = await adapter.fetchTransactionByHash(10143, hash);

    expect(tx).not.toBeNull();
    expect(tx?.sourceChainId).toBe(10143);
    expect(tx?.sourceTransactionHash).toBe(hash);
    expect(tx?.status).toBe("confirmed");
    expect(tx?.provenance.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
  });

  it("preserves failed transaction status", async () => {
    const adapter = new MockImportAdapter();
    const failedHash =
      "0x5555555555555555555555555555555555555555555555555555555555555555" as const;
    const tx = await adapter.fetchTransactionByHash(10143, failedHash);

    expect(tx).not.toBeNull();
    expect(tx?.status).toBe("failed");
  });

  it("caches queries in CompositeImportAdapter", async () => {
    const mock = new MockImportAdapter();
    const composite = new CompositeImportAdapter(new RpcImportAdapter(), mock);

    const res1 = await composite.fetchTransactions({
      address: testAddress,
      chainId: 10143,
    });

    // Query again - should hit cache
    const res2 = await composite.fetchTransactions({
      address: testAddress,
      chainId: 10143,
    });

    expect(res1.items).toEqual(res2.items);
  });
});
