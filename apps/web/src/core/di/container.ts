import { LocalStorageTransactionRepository } from "../infrastructure/storage/LocalStorageTransactionRepository";
import { BrowserEventBus } from "../infrastructure/events/BrowserEventBus";
import { GetTransactionsUseCase } from "../application/transaction/use-cases/GetTransactionsUseCase";
import { UpsertTransactionUseCase } from "../application/transaction/use-cases/UpsertTransactionUseCase";
import { ExtractReceiptTransactionsUseCase } from "../application/transaction/use-cases/ExtractReceiptTransactionsUseCase";

/**
 * Clean Architecture - Dependency Injection Container
 * Manages service lifecycles and promotes Inversion of Control.
 */
class ServiceContainer {
  private _transactionRepository?: LocalStorageTransactionRepository;
  private _eventBus?: BrowserEventBus;
  private _getTransactionsUseCase?: GetTransactionsUseCase;
  private _upsertTransactionUseCase?: UpsertTransactionUseCase;
  private _extractReceiptTransactionsUseCase?: ExtractReceiptTransactionsUseCase;

  public get transactionRepository(): LocalStorageTransactionRepository {
    if (!this._transactionRepository) {
      this._transactionRepository = new LocalStorageTransactionRepository();
    }
    return this._transactionRepository;
  }

  public get eventBus(): BrowserEventBus {
    if (!this._eventBus) {
      this._eventBus = new BrowserEventBus();
    }
    return this._eventBus;
  }

  public get getTransactionsUseCase(): GetTransactionsUseCase {
    if (!this._getTransactionsUseCase) {
      this._getTransactionsUseCase = new GetTransactionsUseCase(
        this.transactionRepository,
      );
    }
    return this._getTransactionsUseCase;
  }

  public get upsertTransactionUseCase(): UpsertTransactionUseCase {
    if (!this._upsertTransactionUseCase) {
      this._upsertTransactionUseCase = new UpsertTransactionUseCase(
        this.transactionRepository,
        this.eventBus,
      );
    }
    return this._upsertTransactionUseCase;
  }

  public get extractReceiptTransactionsUseCase(): ExtractReceiptTransactionsUseCase {
    if (!this._extractReceiptTransactionsUseCase) {
      this._extractReceiptTransactionsUseCase =
        new ExtractReceiptTransactionsUseCase();
    }
    return this._extractReceiptTransactionsUseCase;
  }
}

export const container = new ServiceContainer();
