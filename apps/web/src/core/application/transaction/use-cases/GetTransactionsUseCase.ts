import type { ITransactionRepository } from "../../../domain/transaction/ports/ITransactionRepository";
import type { TransactionEntity } from "../../../domain/transaction/entities/Transaction";

/**
 * Clean Architecture - Application Layer Use Case
 * Query: GetTransactionsUseCase
 * Retrieves sorted, scoped transactions through the abstract repository port.
 */
export class GetTransactionsUseCase {
  public constructor(private readonly repository: ITransactionRepository) {}

  public execute(scopeId?: string | null): TransactionEntity[] {
    return this.repository.getAllSync(scopeId);
  }

  public async executeAsync(scopeId?: string | null): Promise<TransactionEntity[]> {
    return this.repository.getAll(scopeId);
  }
}
