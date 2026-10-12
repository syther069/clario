import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClarioIndexedDB, STORES, type SyncQueueItem } from "./ClarioIndexedDB";

describe("ClarioIndexedDB Engine", () => {
  let idb: ClarioIndexedDB;

  beforeEach(() => {
    idb = new ClarioIndexedDB();
  });

  it("gracefully detects environments where indexedDB is not supported", () => {
    const originalIDB = globalThis.indexedDB;
    // @ts-expect-error test override
    delete globalThis.indexedDB;

    expect(idb.isSupported()).toBe(false);

    // Restore
    if (originalIDB) {
      globalThis.indexedDB = originalIDB;
    }
  });

  it("returns empty array / null when not supported without throwing unhandled exceptions", async () => {
    const originalIDB = globalThis.indexedDB;
    // @ts-expect-error test override
    delete globalThis.indexedDB;

    const all = await idb.getAll(STORES.TRANSACTIONS);
    expect(all).toEqual([]);

    const single = await idb.getById(STORES.TRANSACTIONS, "any-id");
    expect(single).toBeNull();

    await expect(
      idb.put(STORES.TRANSACTIONS, { id: "1" }),
    ).resolves.toBeUndefined();
    await expect(idb.delete(STORES.TRANSACTIONS, "1")).resolves.toBeUndefined();
    await expect(idb.clear(STORES.TRANSACTIONS)).resolves.toBeUndefined();

    if (originalIDB) {
      globalThis.indexedDB = originalIDB;
    }
  });

  it("handles simulated IDB operations when mocked", async () => {
    const mockStore = new Map<string, any>();

    const fakeDB: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => ({
            set onsuccess(cb: () => void) {
              this.result = Array.from(mockStore.values());
              cb();
            },
            result: [] as any[],
          }),
          get: (id: string) => ({
            set onsuccess(cb: () => void) {
              this.result = mockStore.get(id) || null;
              cb();
            },
            result: null,
          }),
          put: (item: any) => {
            mockStore.set(item.id, item);
            return {
              set onsuccess(cb: () => void) {
                cb();
              },
            };
          },
          delete: (id: string) => {
            mockStore.delete(id);
            return {
              set onsuccess(cb: () => void) {
                cb();
              },
            };
          },
          clear: () => {
            mockStore.clear();
            return {
              set onsuccess(cb: () => void) {
                cb();
              },
            };
          },
        }),
        oncomplete: null,
      }),
    };

    // Spy on getDB to return fakeDB
    vi.spyOn(idb, "isSupported").mockReturnValue(true);
    vi.spyOn(idb, "getDB").mockResolvedValue(fakeDB);

    // Test Put & Get
    await idb.put(STORES.TRANSACTIONS, { id: "tx-1", amount: 150 });
    const item = await idb.getById(STORES.TRANSACTIONS, "tx-1");
    expect(item).toEqual({ id: "tx-1", amount: 150 });

    // Test GetAll
    await idb.put(STORES.TRANSACTIONS, { id: "tx-2", amount: 250 });
    const all = await idb.getAll(STORES.TRANSACTIONS);
    expect(all).toHaveLength(2);

    // Test Delete
    await idb.delete(STORES.TRANSACTIONS, "tx-1");
    const remaining = await idb.getAll(STORES.TRANSACTIONS);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toEqual({ id: "tx-2", amount: 250 });

    // Test Clear
    await idb.clear(STORES.TRANSACTIONS);
    const cleared = await idb.getAll(STORES.TRANSACTIONS);
    expect(cleared).toHaveLength(0);
  });
});
