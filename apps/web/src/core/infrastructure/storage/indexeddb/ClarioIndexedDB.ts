/**
 * Clario IndexedDB Storage Engine
 * High-performance, zero-dependency, typed native IndexedDB wrapper.
 * Acts as the L2 persistent offline cache for transactions, business entities, and sync queues.
 */

export const CLARIO_DB_NAME = "clario_db";
export const CLARIO_DB_VERSION = 1;

export const STORES = {
  TRANSACTIONS: "transactions",
  BUSINESS_TEAM: "business_team",
  BUSINESS_REIMBURSEMENTS: "business_reimbursements",
  BUSINESS_POLICIES: "business_policies",
  BUSINESS_AUDIT: "business_audit",
  SYNC_QUEUE: "sync_queue",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export interface SyncQueueItem {
  id: string;
  entityType: StoreName;
  action: "upsert" | "delete";
  payload: any;
  scopeId?: string | null | undefined;
  createdAt: string;
  retries: number;
  status: "pending" | "processing" | "failed";
  lastError?: string | undefined;
}

export class ClarioIndexedDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.indexedDB !== "undefined" &&
      window.indexedDB !== null
    );
  }

  public async getDB(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      throw new Error("IndexedDB is not supported in this environment");
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(CLARIO_DB_NAME, CLARIO_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Transactions Store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.TRANSACTIONS, {
            keyPath: "id",
          });
          txStore.createIndex("user_id", "user_id", { unique: false });
          txStore.createIndex("timestamp", "timestamp", { unique: false });
          txStore.createIndex("updated_at", "updated_at", { unique: false });
        }

        // Business Team Store
        if (!db.objectStoreNames.contains(STORES.BUSINESS_TEAM)) {
          const teamStore = db.createObjectStore(STORES.BUSINESS_TEAM, {
            keyPath: "id",
          });
          teamStore.createIndex("org_id", "org_id", { unique: false });
        }

        // Business Reimbursements Store
        if (!db.objectStoreNames.contains(STORES.BUSINESS_REIMBURSEMENTS)) {
          const reimbStore = db.createObjectStore(
            STORES.BUSINESS_REIMBURSEMENTS,
            { keyPath: "id" },
          );
          reimbStore.createIndex("org_id", "org_id", { unique: false });
          reimbStore.createIndex("status", "status", { unique: false });
        }

        // Business Policies Store
        if (!db.objectStoreNames.contains(STORES.BUSINESS_POLICIES)) {
          const policyStore = db.createObjectStore(STORES.BUSINESS_POLICIES, {
            keyPath: "id",
          });
          policyStore.createIndex("org_id", "org_id", { unique: false });
        }

        // Business Audit Store
        if (!db.objectStoreNames.contains(STORES.BUSINESS_AUDIT)) {
          const auditStore = db.createObjectStore(STORES.BUSINESS_AUDIT, {
            keyPath: "id",
          });
          auditStore.createIndex("org_id", "org_id", { unique: false });
        }

        // Sync Queue Store
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, {
            keyPath: "id",
          });
          queueStore.createIndex("status", "status", { unique: false });
          queueStore.createIndex("entityType", "entityType", { unique: false });
          queueStore.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn(
          "ClarioIndexedDB open request was blocked by an active connection",
        );
      };
    });

    return this.dbPromise;
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      return new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`IndexedDB getAll failed on ${storeName}:`, err);
      return [];
    }
  }

  public async getByIndex<T>(
    storeName: StoreName,
    indexName: string,
    queryValue: IDBValidKey,
  ): Promise<T[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      return new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.getAll(queryValue);

        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(
        `IndexedDB getByIndex failed on ${storeName} [${indexName}=${String(queryValue)}]:`,
        err,
      );
      return [];
    }
  }

  public async getById<T>(
    storeName: StoreName,
    id: IDBValidKey,
  ): Promise<T | null> {
    if (!this.isSupported()) return null;
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(id);

        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(
        `IndexedDB getById failed on ${storeName} [${String(id)}]:`,
        err,
      );
      return null;
    }
  }

  public async put<T>(storeName: StoreName, item: T): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(item);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`IndexedDB put failed on ${storeName}:`, err);
    }
  }

  public async putBatch<T>(storeName: StoreName, items: T[]): Promise<void> {
    if (!this.isSupported() || items.length === 0) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        for (const item of items) {
          store.put(item);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`IndexedDB putBatch failed on ${storeName}:`, err);
    }
  }

  public async delete(storeName: StoreName, id: IDBValidKey): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(
        `IndexedDB delete failed on ${storeName} [${String(id)}]:`,
        err,
      );
    }
  }

  public async clear(storeName: StoreName): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`IndexedDB clear failed on ${storeName}:`, err);
    }
  }
}

export const indexedDBService = new ClarioIndexedDB();
