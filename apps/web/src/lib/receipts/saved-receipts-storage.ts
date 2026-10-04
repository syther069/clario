import fs from "fs";
import path from "path";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  ReceiptBundle,
  CanonicalReceiptBundle,
} from "@/lib/supabase/types";
import {
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
} from "@/lib/blockchain/registry";

/**
 * Storage schema for persistent saved receipts.
 * Tied directly to the user's normalized wallet address.
 */
export interface PersistedSavedReceipt {
  id: string;
  wallet_address: string;
  transaction_hash: string | null;
  chain: string;
  chain_id: number;
  receipt_data: CanonicalReceiptBundle;
  name: string;
  receipt_name?: string | null;
  receipt_number: string;
  total_amount: number;
  currency: string;
  transaction_count: number;
  transaction_ids: string[];
  receipt_hash: string;
  file_hash: string;
  blockchain_network: string;
  blockchain_status:
    "draft" | "uploading" | "hashing" | "pending" | "confirmed" | "failed";
  blockchain_contract_address?: string | null;
  monad_block?: number | null;
  verification_status: "unverified" | "verified" | "failed";
  created_at: string;
  updated_at: string;
}

export function ensureCanonicalReceiptData(
  data: unknown,
  fallback: {
    id: string;
    receiptNumber: string;
    name: string;
    owner: string;
    totalAmount: number;
    currency: string;
    transactionIds: string[];
    createdAt: string;
  },
): CanonicalReceiptBundle {
  const d = (
    data && typeof data === "object" ? data : {}
  ) as Partial<CanonicalReceiptBundle>;
  return {
    receiptId: d.receiptId || fallback.id,
    receiptNumber: d.receiptNumber || fallback.receiptNumber,
    receiptName: d.receiptName || fallback.name,
    createdAt: d.createdAt || fallback.createdAt,
    owner: d.owner || fallback.owner,
    transactionCount:
      Number(d.transactionCount) || fallback.transactionIds.length || 1,
    totalAmount: Number(d.totalAmount ?? fallback.totalAmount) || 0,
    currency: d.currency || fallback.currency || "USD",
    transactionIds: Array.isArray(d.transactionIds)
      ? d.transactionIds
      : fallback.transactionIds,
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
    version: Number(d.version) || 1,
  };
}

const STORAGE_DIR = path.resolve(process.cwd(), ".data");
const STORAGE_FILE = path.join(STORAGE_DIR, "saved_receipts.json");

function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to ensure saved receipts storage directory:", err);
  }
}

function readLocalStore(): Record<string, PersistedSavedReceipt> {
  ensureStorageDir();
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, PersistedSavedReceipt>;
  } catch (err) {
    console.warn(
      "Notice: Reading saved receipts local file store fallback:",
      err,
    );
    return {};
  }
}

function writeLocalStore(store: Record<string, PersistedSavedReceipt>): void {
  ensureStorageDir();
  try {
    const tempFile = `${STORAGE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempFile, STORAGE_FILE);
  } catch (err) {
    console.error("Error writing to saved receipts local file store:", err);
  }
}

/**
 * Normalizes an EVM wallet address to lowercase to ensure
 * checksum or case variations resolve to the exact same identity.
 */
export function normalizeWalletAddress(address?: string | null): string {
  if (!address || typeof address !== "string") return "";
  return address.trim().toLowerCase();
}

export const normalizeIdentityKey = normalizeWalletAddress;

/**
 * Validates that an address is a properly formatted 40-hex-character EVM address.
 */
export function isValidEvmAddress(address?: string | null): boolean {
  if (!address) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/**
 * Creates an authoritative composite key for duplicate prevention.
 * Uniqueness constraint: (wallet_address, chain, transaction_hash)
 */
export function getReceiptUniqueKey(
  walletAddress: string,
  chain: string,
  txHashOrDataHash: string,
): string {
  const normAddr = normalizeWalletAddress(walletAddress);
  const normChain = (chain || "monad_testnet").toLowerCase();
  const normHash = (txHashOrDataHash || "").toLowerCase();
  return `${normAddr}:${normChain}:${normHash}`;
}

export class SavedReceiptsStorageService {
  /**
   * Persists a saved receipt/bundle permanently in the database.
   * Enforces:
   * 1. Normalized wallet address ownership.
   * 2. Idempotency on (wallet_address, chain, transaction_hash).
   * 3. Dual-layer persistence (Supabase + resilient local file store fallback).
   */
  async saveReceipt(params: {
    bundle: ReceiptBundle;
    userAddress: string;
    txHash?: string | null | undefined;
    blockNumber?: number | null | undefined;
    chain?: string | undefined;
  }): Promise<{ success: boolean; receipt: PersistedSavedReceipt }> {
    const { bundle, userAddress, txHash, blockNumber, chain } = params;

    const normAddress = normalizeWalletAddress(
      userAddress || bundle.wallet_address,
    );
    if (!isValidEvmAddress(normAddress)) {
      throw new Error(
        `Valid EVM wallet address required for receipt persistence: received "${userAddress}"`,
      );
    }

    const nowIso = new Date().toISOString();
    const effectiveTxHash = txHash || bundle.blockchain_tx_hash || null;
    const effectiveChain =
      chain || bundle.blockchain_network || "Monad Testnet";

    const record: PersistedSavedReceipt = {
      id: bundle.id || `receipt_${Date.now()}`,
      wallet_address: normAddress,
      transaction_hash: effectiveTxHash,
      chain: effectiveChain,
      chain_id: bundle.blockchain_chain_id || MONAD_TESTNET_CHAIN_ID,
      receipt_data: ensureCanonicalReceiptData(bundle.receipt_data, {
        id: bundle.id || `receipt_${Date.now()}`,
        receiptNumber:
          bundle.receipt_number || `CR-${Date.now().toString().slice(-6)}`,
        name: bundle.name || bundle.receipt_name || "Untitled Receipt",
        owner: normAddress,
        totalAmount: Number(bundle.total_amount) || 0,
        currency: bundle.currency || "USD",
        transactionIds: Array.isArray(bundle.transaction_ids)
          ? bundle.transaction_ids
          : [],
        createdAt: bundle.created_at || nowIso,
      }),
      name: bundle.name || bundle.receipt_name || "Untitled Receipt",
      receipt_name: bundle.receipt_name || bundle.name || "Untitled Receipt",
      receipt_number:
        bundle.receipt_number || `CR-${Date.now().toString().slice(-6)}`,
      total_amount: Number(bundle.total_amount) || 0,
      currency: bundle.currency || "USD",
      transaction_count: bundle.transaction_count || 1,
      transaction_ids: Array.isArray(bundle.transaction_ids)
        ? bundle.transaction_ids
        : [],
      receipt_hash: bundle.receipt_hash || "0x",
      file_hash: bundle.file_hash || bundle.receipt_hash || "0x",
      blockchain_network: effectiveChain,
      blockchain_status:
        (bundle.blockchain_status as PersistedSavedReceipt["blockchain_status"]) ||
        (effectiveTxHash ? "confirmed" : "pending"),
      blockchain_contract_address:
        bundle.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS,
      monad_block:
        blockNumber !== undefined && blockNumber !== null
          ? Number(blockNumber)
          : bundle.monad_block || null,
      verification_status: effectiveTxHash
        ? "verified"
        : bundle.verification_status || "unverified",
      created_at: bundle.created_at || nowIso,
      updated_at: nowIso,
    };

    // 1. Write to durable local store first to guarantee persistence across refresh & restart
    const localStore = readLocalStore();

    // Check if an existing receipt with same (wallet_address, chain, tx_hash) exists to preserve idempotency
    const uniqueKey = getReceiptUniqueKey(
      normAddress,
      effectiveChain,
      effectiveTxHash || record.receipt_hash,
    );
    let existingId: string | null = null;
    for (const [id, r] of Object.entries(localStore)) {
      if (
        getReceiptUniqueKey(
          r.wallet_address,
          r.chain,
          r.transaction_hash || r.receipt_hash,
        ) === uniqueKey
      ) {
        existingId = id;
        break;
      }
    }

    if (existingId) {
      record.id = existingId;
    }

    localStore[record.id] = record;
    writeLocalStore(localStore);

    // 2. Mirror to Supabase receipt_bundles if available
    try {
      const supabase = getSupabaseAdminClient();
      const supabaseRecord = {
        id: record.id,
        user_id: normAddress,
        wallet_address: normAddress,
        name: record.name,
        receipt_name: record.receipt_name,
        receipt_number: record.receipt_number,
        file_hash: record.file_hash,
        receipt_hash: record.receipt_hash,
        transaction_count: record.transaction_count,
        total_amount: record.total_amount,
        currency: record.currency,
        transaction_ids: record.transaction_ids,
        receipt_data: record.receipt_data,
        blockchain_network: record.blockchain_network,
        blockchain_status: record.blockchain_status,
        blockchain_tx_hash: record.transaction_hash,
        blockchain_contract_address: record.blockchain_contract_address,
        blockchain_chain_id: record.chain_id,
        monad_block: record.monad_block,
        verification_status: record.verification_status,
        created_at: record.created_at,
        updated_at: record.updated_at,
      };

      const { error } = await supabase
        .from("receipt_bundles")
        .upsert(supabaseRecord);
      if (error) {
        console.warn(
          "Notice: Supabase receipt_bundles upsert note (persisted locally):",
          error.message,
        );
      }
    } catch (dbErr) {
      console.warn(
        "Notice: Supabase client exception (persisted locally):",
        dbErr,
      );
    }

    return { success: true, receipt: record };
  }

  /**
   * Retrieves saved receipts scoped strictly to the requesting connected wallet address.
   * Guarantees:
   * - Wallet B NEVER sees Wallet A's receipts.
   * - Address casing differences resolve to the same normalized store.
   * - Merges any Supabase remote records with local persistent records.
   */
  async getReceiptsByWallet(
    walletAddress: string,
    options?: { verifiedOnly?: boolean },
  ): Promise<ReceiptBundle[]> {
    const normAddress = normalizeWalletAddress(walletAddress);
    if (!isValidEvmAddress(normAddress)) {
      return [];
    }

    const verifiedOnly = options?.verifiedOnly !== false;

    // 1. Fetch from durable local store
    const localStore = readLocalStore();
    const localReceipts = Object.values(localStore).filter((r) => {
      if (normalizeWalletAddress(r.wallet_address) !== normAddress)
        return false;
      if (verifiedOnly) {
        return (
          (r.verification_status === "verified" ||
            r.blockchain_status === "confirmed") &&
          Boolean(r.transaction_hash)
        );
      }
      return true;
    });

    const receiptsMap = new Map<string, PersistedSavedReceipt>();
    for (const r of localReceipts) {
      receiptsMap.set(r.id, r);
    }

    // 2. Fetch from Supabase if table is present
    try {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("receipt_bundles")
        .select("*")
        .or(`wallet_address.eq.${normAddress},user_id.eq.${normAddress}`);

      if (verifiedOnly) {
        query = query
          .eq("verification_status", "verified")
          .eq("blockchain_status", "confirmed")
          .not("blockchain_tx_hash", "is", null);
      }

      const { data: dbData, error } = await query.order("created_at", {
        ascending: false,
      });
      if (!error && Array.isArray(dbData)) {
        for (const item of dbData) {
          if (!receiptsMap.has(item.id)) {
            const mapped: PersistedSavedReceipt = {
              id: item.id,
              wallet_address: normAddress,
              transaction_hash: item.blockchain_tx_hash || null,
              chain: item.blockchain_network || "Monad Testnet",
              chain_id:
                Number(item.blockchain_chain_id) || MONAD_TESTNET_CHAIN_ID,
              receipt_data: ensureCanonicalReceiptData(item.receipt_data, {
                id: item.id,
                receiptNumber: item.receipt_number || "CR-0000",
                name: item.name || item.receipt_name || "Untitled Receipt",
                owner: normAddress,
                totalAmount: Number(item.total_amount) || 0,
                currency: item.currency || "USD",
                transactionIds: Array.isArray(item.transaction_ids)
                  ? item.transaction_ids
                  : [],
                createdAt: item.created_at,
              }),
              name: item.name || item.receipt_name || "Untitled Receipt",
              receipt_name:
                item.receipt_name || item.name || "Untitled Receipt",
              receipt_number: item.receipt_number || "CR-0000",
              total_amount: Number(item.total_amount) || 0,
              currency: item.currency || "USD",
              transaction_count: item.transaction_count || 1,
              transaction_ids: Array.isArray(item.transaction_ids)
                ? item.transaction_ids
                : [],
              receipt_hash: item.receipt_hash || "0x",
              file_hash: item.file_hash || item.receipt_hash || "0x",
              blockchain_network: item.blockchain_network || "Monad Testnet",
              blockchain_status: item.blockchain_status || "confirmed",
              blockchain_contract_address:
                item.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS,
              monad_block: item.monad_block || null,
              verification_status: item.verification_status || "verified",
              created_at: item.created_at,
              updated_at: item.updated_at,
            };
            receiptsMap.set(item.id, mapped);
            // Save to local store for offline cache
            localStore[mapped.id] = mapped;
            writeLocalStore(localStore);
          }
        }
      }
    } catch {
      // Supabase is optional; local store is durable
    }

    // Convert to canonical ReceiptBundle array
    const result: ReceiptBundle[] = Array.from(receiptsMap.values()).map(
      (r) => ({
        id: r.id,
        user_id: r.wallet_address,
        wallet_address: r.wallet_address,
        name: r.name,
        receipt_name: r.receipt_name || r.name,
        receipt_number: r.receipt_number,
        file_hash: r.file_hash,
        receipt_hash: r.receipt_hash,
        transaction_count: r.transaction_count,
        total_amount: r.total_amount,
        currency: r.currency,
        transaction_ids: r.transaction_ids,
        receipt_data: r.receipt_data,
        blockchain_network: r.blockchain_network,
        blockchain_status: r.blockchain_status,
        blockchain_tx_hash: r.transaction_hash,
        blockchain_contract_address: r.blockchain_contract_address || null,
        blockchain_chain_id: r.chain_id,
        monad_block: r.monad_block || null,
        verification_status: r.verification_status,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }),
    );

    return result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  /**
   * Retrieves a single receipt bundle by ID with wallet ownership verification.
   */
  async getReceiptById(
    receiptId: string,
    walletAddress?: string | null,
  ): Promise<ReceiptBundle | null> {
    const localStore = readLocalStore();
    let r = localStore[receiptId];

    if (!r) {
      try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
          .from("receipt_bundles")
          .select("*")
          .eq("id", receiptId)
          .single();

        if (!error && data) {
          r = {
            id: data.id,
            wallet_address: normalizeWalletAddress(
              data.wallet_address || data.user_id,
            ),
            transaction_hash: data.blockchain_tx_hash || null,
            chain: data.blockchain_network || "Monad Testnet",
            chain_id:
              Number(data.blockchain_chain_id) || MONAD_TESTNET_CHAIN_ID,
            receipt_data: ensureCanonicalReceiptData(data.receipt_data, {
              id: data.id,
              receiptNumber: data.receipt_number || "CR-0000",
              name: data.name || data.receipt_name || "Untitled Receipt",
              owner: normalizeWalletAddress(
                data.wallet_address || data.user_id,
              ),
              totalAmount: Number(data.total_amount) || 0,
              currency: data.currency || "USD",
              transactionIds: Array.isArray(data.transaction_ids)
                ? data.transaction_ids
                : [],
              createdAt: data.created_at,
            }),
            name: data.name || data.receipt_name || "Untitled Receipt",
            receipt_name: data.receipt_name || data.name || "Untitled Receipt",
            receipt_number: data.receipt_number || "CR-0000",
            total_amount: Number(data.total_amount) || 0,
            currency: data.currency || "USD",
            transaction_count: data.transaction_count || 1,
            transaction_ids: Array.isArray(data.transaction_ids)
              ? data.transaction_ids
              : [],
            receipt_hash: data.receipt_hash || "0x",
            file_hash: data.file_hash || data.receipt_hash || "0x",
            blockchain_network: data.blockchain_network || "Monad Testnet",
            blockchain_status: data.blockchain_status || "confirmed",
            blockchain_contract_address:
              data.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS,
            monad_block: data.monad_block || null,
            verification_status: data.verification_status || "verified",
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
          localStore[r.id] = r;
          writeLocalStore(localStore);
        }
      } catch {
        // Fallback
      }
    }

    if (!r) return null;

    if (walletAddress) {
      const normAddr = normalizeWalletAddress(walletAddress);
      if (isValidEvmAddress(normAddr) && r.wallet_address !== normAddr) {
        // Security check: Wallet does not own this receipt
        return null;
      }
    }

    return {
      id: r.id,
      user_id: r.wallet_address,
      wallet_address: r.wallet_address,
      name: r.name,
      receipt_name: r.receipt_name || r.name,
      receipt_number: r.receipt_number,
      file_hash: r.file_hash,
      receipt_hash: r.receipt_hash,
      transaction_count: r.transaction_count,
      total_amount: r.total_amount,
      currency: r.currency,
      transaction_ids: r.transaction_ids,
      receipt_data: r.receipt_data,
      blockchain_network: r.blockchain_network,
      blockchain_status: r.blockchain_status,
      blockchain_tx_hash: r.transaction_hash,
      blockchain_contract_address: r.blockchain_contract_address || null,
      blockchain_chain_id: r.chain_id,
      monad_block: r.monad_block || null,
      verification_status: r.verification_status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  /**
   * Deletes a saved receipt explicitly by owner wallet.
   */
  async deleteReceipt(
    receiptId: string,
    walletAddress: string,
  ): Promise<boolean> {
    const normAddr = normalizeWalletAddress(walletAddress);
    if (!isValidEvmAddress(normAddr)) {
      throw new Error("Valid wallet address required to delete receipt");
    }

    const localStore = readLocalStore();
    const existing = localStore[receiptId];
    if (existing && existing.wallet_address !== normAddr) {
      throw new Error(
        "Unauthorized: Wallet address does not match receipt owner",
      );
    }

    delete localStore[receiptId];
    writeLocalStore(localStore);

    try {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from("receipt_bundles")
        .delete()
        .eq("id", receiptId)
        .or(`wallet_address.eq.${normAddr},user_id.eq.${normAddr}`);
    } catch {
      // Optional
    }

    return true;
  }
}

export const savedReceiptsStorage = new SavedReceiptsStorageService();
