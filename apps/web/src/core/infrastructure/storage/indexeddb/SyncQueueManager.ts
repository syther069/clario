import {
  ClarioIndexedDB,
  indexedDBService,
  STORES,
  type SyncQueueItem,
} from "./ClarioIndexedDB";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * SyncQueueManager
 * Orchestrates queuing and background replay of offline mutations to Supabase.
 * Automatically hooks into browser online events.
 */
export class SyncQueueManager {
  private isProcessing = false;

  constructor(private readonly db: ClarioIndexedDB = indexedDBService) {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.processQueue().catch((err) =>
          console.warn("Background sync queue processing error:", err),
        );
      });
    }
  }

  public async enqueue(
    item: Omit<SyncQueueItem, "id" | "createdAt" | "retries" | "status">,
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
    };

    await this.db.put(STORES.SYNC_QUEUE, queueItem);
  }

  public async getPendingItems(): Promise<SyncQueueItem[]> {
    return this.db.getByIndex<SyncQueueItem>(
      STORES.SYNC_QUEUE,
      "status",
      "pending",
    );
  }

  public async processQueue(): Promise<number> {
    if (
      this.isProcessing ||
      typeof window === "undefined" ||
      !navigator.onLine
    ) {
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      const items = await this.getPendingItems();
      for (const item of items) {
        try {
          const success = await this.replayItem(item);
          if (success) {
            await this.db.delete(STORES.SYNC_QUEUE, item.id);
            processedCount++;
          } else {
            item.retries += 1;
            if (item.retries >= 5) {
              item.status = "failed";
            }
            await this.db.put(STORES.SYNC_QUEUE, item);
          }
        } catch (err: any) {
          item.retries += 1;
          item.lastError = err?.message || String(err);
          if (item.retries >= 5) {
            item.status = "failed";
          }
          await this.db.put(STORES.SYNC_QUEUE, item);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  private async replayItem(item: SyncQueueItem): Promise<boolean> {
    const supabase = getSupabaseClient(item.scopeId || undefined);

    if (item.entityType === STORES.TRANSACTIONS) {
      if (item.action === "upsert") {
        const { error } = await supabase
          .from("transactions")
          .upsert(item.payload);
        return !error;
      }
      if (item.action === "delete") {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", item.payload.id);
        return !error;
      }
    }

    if (item.entityType === STORES.BUSINESS_TEAM) {
      if (item.action === "upsert") {
        const { error } = await supabase
          .from("business_team_members")
          .upsert(item.payload);
        return !error;
      }
      if (item.action === "delete") {
        const { error } = await supabase
          .from("business_team_members")
          .delete()
          .eq("id", item.payload.id);
        return !error;
      }
    }

    if (item.entityType === STORES.BUSINESS_REIMBURSEMENTS) {
      if (item.action === "upsert") {
        const { error } = await supabase
          .from("business_reimbursements")
          .upsert(item.payload);
        return !error;
      }
      if (item.action === "delete") {
        const { error } = await supabase
          .from("business_reimbursements")
          .delete()
          .eq("id", item.payload.id);
        return !error;
      }
    }

    if (item.entityType === STORES.BUSINESS_POLICIES) {
      if (item.action === "upsert") {
        const { error } = await supabase
          .from("business_policies")
          .upsert(item.payload);
        return !error;
      }
      if (item.action === "delete") {
        const { error } = await supabase
          .from("business_policies")
          .delete()
          .eq("id", item.payload.id);
        return !error;
      }
    }

    if (item.entityType === STORES.BUSINESS_AUDIT) {
      if (item.action === "upsert") {
        const { error } = await supabase
          .from("business_audit_events")
          .insert(item.payload);
        return !error;
      }
    }

    return true;
  }
}

export const syncQueueManager = new SyncQueueManager();
