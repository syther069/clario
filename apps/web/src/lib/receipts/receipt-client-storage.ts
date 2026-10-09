import type { ReceiptBundle, CanonicalReceiptBundle } from "@/lib/supabase/types";
import { normalizeIdentityKey, getScopedKey } from "@/lib/storage/transaction-storage";

export const STORAGE_KEY_RECEIPTS = "clario_saved_receipts";

/**
 * Retrieves stored receipt bundles from client localStorage.
 * Searches scoped key first, then merges with global store.
 */
export function getStoredReceiptBundles(
  userOrWallet?: string | null,
): Record<string, ReceiptBundle> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  const result: Record<string, ReceiptBundle> = {};

  try {
    // 1. Read global store
    const rawGlobal = localStorage.getItem(STORAGE_KEY_RECEIPTS);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed)) {
          for (const b of parsed) {
            if (b && b.id) result[b.id] = b;
          }
        } else {
          for (const [id, b] of Object.entries(parsed)) {
            if (b && typeof b === "object" && (b as ReceiptBundle).id) {
              result[id] = b as ReceiptBundle;
            }
          }
        }
      }
    }

    // 2. Read scoped store if wallet/user provided
    if (userOrWallet && userOrWallet.trim()) {
      const scopedKey = getScopedKey(STORAGE_KEY_RECEIPTS, userOrWallet);
      const rawScoped = localStorage.getItem(scopedKey);
      if (rawScoped) {
        const parsed = JSON.parse(rawScoped);
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed)) {
            for (const b of parsed) {
              if (b && b.id) result[b.id] = b;
            }
          } else {
            for (const [id, b] of Object.entries(parsed)) {
              if (b && typeof b === "object" && (b as ReceiptBundle).id) {
                result[id] = b as ReceiptBundle;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Notice: Error reading receipt bundles from localStorage:", err);
  }

  return result;
}

/**
 * Persists a dictionary of receipt bundles to localStorage (both global and scoped).
 */
export function saveStoredReceiptBundles(
  bundles: Record<string, ReceiptBundle> | ReceiptBundle[],
  userOrWallet?: string | null,
): Record<string, ReceiptBundle> {
  if (typeof window === "undefined" || !window.localStorage) {
    return Array.isArray(bundles)
      ? bundles.reduce((acc, b) => {
          if (b && b.id) acc[b.id] = b;
          return acc;
        }, {} as Record<string, ReceiptBundle>)
      : bundles;
  }

  try {
    const current = getStoredReceiptBundles(userOrWallet);
    const bundleList = Array.isArray(bundles) ? bundles : Object.values(bundles);

    for (const b of bundleList) {
      if (!b || !b.id) continue;
      const existing = current[b.id];
      // Merge smartly to not lose embedded transactions or verified hashes
      const existingTxs = existing?.receipt_data?.transactions || [];
      const newTxs = b.receipt_data?.transactions || [];
      const mergedTxs = newTxs.length > 0 ? newTxs : existingTxs;

      const mergedBundle: ReceiptBundle = {
        ...existing,
        ...b,
        blockchain_tx_hash: b.blockchain_tx_hash || existing?.blockchain_tx_hash || null,
        blockchain_status:
          b.blockchain_status === "confirmed" || existing?.blockchain_status === "confirmed"
            ? "confirmed"
            : b.blockchain_status || existing?.blockchain_status || "draft",
        verification_status:
          b.verification_status === "verified" || existing?.verification_status === "verified"
            ? "verified"
            : b.verification_status || existing?.verification_status || "unverified",
        receipt_data: {
          ...(existing?.receipt_data || {}),
          ...(b.receipt_data || {}),
          transactions: mergedTxs,
        } as CanonicalReceiptBundle,
      };

      current[b.id] = mergedBundle;
    }

    const json = JSON.stringify(current);
    localStorage.setItem(STORAGE_KEY_RECEIPTS, json);

    if (userOrWallet && userOrWallet.trim()) {
      const scopedKey = getScopedKey(STORAGE_KEY_RECEIPTS, userOrWallet);
      localStorage.setItem(scopedKey, json);
    }

    return current;
  } catch (err) {
    console.warn("Notice: Error writing receipt bundles to localStorage:", err);
    return Array.isArray(bundles)
      ? bundles.reduce((acc, b) => {
          if (b && b.id) acc[b.id] = b;
          return acc;
        }, {} as Record<string, ReceiptBundle>)
      : bundles;
  }
}

/**
 * Persists a single receipt bundle to client localStorage.
 */
export function saveStoredReceiptBundle(
  bundle: ReceiptBundle,
  userOrWallet?: string | null,
): Record<string, ReceiptBundle> {
  return saveStoredReceiptBundles({ [bundle.id]: bundle }, userOrWallet);
}

/**
 * Merges two dictionaries of receipt bundles without overwriting richer records with emptier ones.
 */
export function mergeReceiptBundles(
  base: Record<string, ReceiptBundle>,
  incoming: Record<string, ReceiptBundle> | ReceiptBundle[],
): Record<string, ReceiptBundle> {
  const result: Record<string, ReceiptBundle> = { ...base };
  const incomingList = Array.isArray(incoming) ? incoming : Object.values(incoming);

  for (const b of incomingList) {
    if (!b || !b.id) continue;
    const existing = result[b.id];
    if (!existing) {
      result[b.id] = b;
      continue;
    }

    const existingTxs = existing.receipt_data?.transactions || [];
    const incomingTxs = b.receipt_data?.transactions || [];
    const bestTxs = incomingTxs.length > 0 ? incomingTxs : existingTxs;

    result[b.id] = {
      ...existing,
      ...b,
      blockchain_tx_hash: b.blockchain_tx_hash || existing.blockchain_tx_hash || null,
      blockchain_status:
        b.blockchain_status === "confirmed" || existing.blockchain_status === "confirmed"
          ? "confirmed"
          : b.blockchain_status || existing.blockchain_status,
      verification_status:
        b.verification_status === "verified" || existing.verification_status === "verified"
          ? "verified"
          : b.verification_status || existing.verification_status,
      receipt_data: {
        ...(existing.receipt_data || {}),
        ...(b.receipt_data || {}),
        transactions: bestTxs,
      } as CanonicalReceiptBundle,
    };
  }

  return result;
}
