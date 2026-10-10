import type { ITransactionRepository } from "../../../domain/transaction/ports/ITransactionRepository";
import type { IEventBus } from "../../ports/IEventBus";
import type { TransactionEntity } from "../../../domain/transaction/entities/Transaction";

export const EVENT_TRANSACTIONS_UPDATED = "clario:transactions:updated";

/**
 * Clean Architecture - Application Layer Use Case
 * Command: UpsertTransactionUseCase
 * Upserts transactions and dispatches domain events through the decoupled event bus.
 */
export class UpsertTransactionUseCase {
  public constructor(
    private readonly repository: ITransactionRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  public execute(
    transaction: TransactionEntity,
    scopeId?: string | null,
  ): TransactionEntity[] {
    const updated = this.repository.upsertSync(transaction, scopeId);
    this.notifyUpdate(updated, scopeId);
    return updated;
  }

  public executeBatch(
    transactions: TransactionEntity[],
    scopeId?: string | null,
  ): TransactionEntity[] {
    const updated = this.repository.upsertBatchSync(transactions, scopeId);
    this.notifyUpdate(updated, scopeId);
    return updated;
  }

  private notifyUpdate(transactions: TransactionEntity[], scopeId?: string | null): void {
    if (this.eventBus) {
      this.eventBus.publish(EVENT_TRANSACTIONS_UPDATED, {
        transactions,
        scopeId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
