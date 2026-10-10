import { TransactionEntity } from "../../../domain/transaction/entities/Transaction";
import type { ReceiptBundle } from "@/lib/supabase/types";

/**
 * Clean Architecture - Application Layer Use Case
 * Command: ExtractReceiptTransactionsUseCase
 * Extracts verified transactions from receipt bundles into domain entities.
 */
export class ExtractReceiptTransactionsUseCase {
  public execute(
    bundles: ReceiptBundle[] | Record<string, ReceiptBundle>,
  ): TransactionEntity[] {
    const bundleList = Array.isArray(bundles) ? bundles : Object.values(bundles);
    const entityMap = new Map<string, TransactionEntity>();

    for (const b of bundleList) {
      if (!b) continue;
      const isConfirmed =
        b.blockchain_status === "confirmed" ||
        b.verification_status === "verified" ||
        Boolean(b.blockchain_tx_hash);
      const txHash = b.blockchain_tx_hash || null;

      if (
        Array.isArray(b.receipt_data?.transactions) &&
        b.receipt_data.transactions.length > 0
      ) {
        for (const t of b.receipt_data.transactions) {
          if (!t || !t.id) continue;
          const entity = new TransactionEntity({
            id: t.id,
            userId: b.user_id || b.wallet_address || "user_default",
            type: (t.type as "expense" | "income" | "transfer") || "expense",
            amount: Number(t.amount) || 0,
            currency: t.currency || b.currency || "USD",
            merchant: t.merchant || b.name || "Expense",
            description: t.merchant || b.name || "Expense",
            category: t.category || "other",
            date:
              t.date ||
              b.created_at?.slice(0, 10) ||
              new Date().toISOString().slice(0, 10),
            timestamp: t.date || b.created_at || new Date().toISOString(),
            paymentMethod: isConfirmed ? "Onchain (Monad)" : "Card",
            verificationState: isConfirmed ? "verified" : "unverified",
            blockchainStatus: isConfirmed ? "confirmed" : null,
            blockchainNetwork: b.blockchain_network || "Monad Testnet",
            blockchainChainId: b.blockchain_chain_id || 10143,
            blockchainTxHash: txHash,
            receiptBundleId: b.id,
            source: isConfirmed ? "onchain_monad" : "manual",
            createdAt: b.created_at || new Date().toISOString(),
            updatedAt: b.updated_at || b.created_at || new Date().toISOString(),
          });
          entityMap.set(entity.id, entity);
        }
      } else {
        const txId =
          (b.transaction_ids && b.transaction_ids[0]) ||
          `tx_${b.id.replace(/[^a-zA-Z0-9]/g, "")}`;
        const entity = new TransactionEntity({
          id: txId,
          userId: b.user_id || b.wallet_address || "user_default",
          type: "expense",
          amount: Number(b.total_amount) || 0,
          currency: b.currency || "USD",
          merchant: b.name || b.receipt_name || "Saved Receipt",
          description: b.name || b.receipt_name || "Saved Receipt",
          category: "other",
          date:
            b.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          timestamp: b.created_at || new Date().toISOString(),
          paymentMethod: isConfirmed ? "Onchain (Monad)" : "Card",
          verificationState: isConfirmed ? "verified" : "unverified",
          blockchainStatus: isConfirmed ? "confirmed" : null,
          blockchainNetwork: b.blockchain_network || "Monad Testnet",
          blockchainChainId: b.blockchain_chain_id || 10143,
          blockchainTxHash: txHash,
          receiptBundleId: b.id,
          source: isConfirmed ? "onchain_monad" : "manual",
          createdAt: b.created_at || new Date().toISOString(),
          updatedAt: b.updated_at || b.created_at || new Date().toISOString(),
        });
        entityMap.set(entity.id, entity);
      }
    }

    return Array.from(entityMap.values());
  }
}
