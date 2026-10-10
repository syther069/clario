import { LocalStorageTransactionRepository } from "../infrastructure/storage/LocalStorageTransactionRepository";
import { LocalStorageFreelancerRepository } from "../infrastructure/storage/LocalStorageFreelancerRepository";
import { LocalStorageFamilyRepository } from "../infrastructure/storage/LocalStorageFamilyRepository";
import { LocalStorageBusinessRepository } from "../infrastructure/storage/LocalStorageBusinessRepository";
import { LocalStoragePersonalRepository } from "../infrastructure/storage/LocalStoragePersonalRepository";

import { BrowserEventBus } from "../infrastructure/events/BrowserEventBus";
import { GetTransactionsUseCase } from "../application/transaction/use-cases/GetTransactionsUseCase";
import { UpsertTransactionUseCase } from "../application/transaction/use-cases/UpsertTransactionUseCase";
import { ExtractReceiptTransactionsUseCase } from "../application/transaction/use-cases/ExtractReceiptTransactionsUseCase";

import { ManageClientsUseCase } from "../application/freelancer/use-cases/ManageClientsUseCase";
import { ManageInvoicesUseCase } from "../application/freelancer/use-cases/ManageInvoicesUseCase";
import { ManageFamilyUseCase } from "../application/family/use-cases/ManageFamilyUseCase";
import { ManageBusinessUseCase } from "../application/business/use-cases/ManageBusinessUseCase";
import { ManagePersonalModeUseCase } from "../application/personal/use-cases/ManagePersonalModeUseCase";

/**
 * Clean Architecture - Dependency Injection Container
 * Central composition root managing service lifecycles, promoting Inversion of Control (IoC),
 * and facilitating modular testing and repository swapping.
 */
class ServiceContainer {
  // Infrastructure: Event Bus
  private _eventBus?: BrowserEventBus;

  // Infrastructure: Repositories
  private _transactionRepository?: LocalStorageTransactionRepository;
  private _freelancerRepository?: LocalStorageFreelancerRepository;
  private _familyRepository?: LocalStorageFamilyRepository;
  private _businessRepository?: LocalStorageBusinessRepository;
  private _personalRepository?: LocalStoragePersonalRepository;

  // Application: Transaction Use Cases
  private _getTransactionsUseCase?: GetTransactionsUseCase;
  private _upsertTransactionUseCase?: UpsertTransactionUseCase;
  private _extractReceiptTransactionsUseCase?: ExtractReceiptTransactionsUseCase;

  // Application: Multi-Mode Use Cases
  private _manageClientsUseCase?: ManageClientsUseCase;
  private _manageInvoicesUseCase?: ManageInvoicesUseCase;
  private _manageFamilyUseCase?: ManageFamilyUseCase;
  private _manageBusinessUseCase?: ManageBusinessUseCase;
  private _managePersonalModeUseCase?: ManagePersonalModeUseCase;

  // Event Bus
  public get eventBus(): BrowserEventBus {
    if (!this._eventBus) {
      this._eventBus = new BrowserEventBus();
    }
    return this._eventBus;
  }

  // Transaction Layer
  public get transactionRepository(): LocalStorageTransactionRepository {
    if (!this._transactionRepository) {
      this._transactionRepository = new LocalStorageTransactionRepository();
    }
    return this._transactionRepository;
  }

  public get getTransactionsUseCase(): GetTransactionsUseCase {
    if (!this._getTransactionsUseCase) {
      this._getTransactionsUseCase = new GetTransactionsUseCase(this.transactionRepository);
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
      this._extractReceiptTransactionsUseCase = new ExtractReceiptTransactionsUseCase();
    }
    return this._extractReceiptTransactionsUseCase;
  }

  // Freelancer Layer
  public get freelancerRepository(): LocalStorageFreelancerRepository {
    if (!this._freelancerRepository) {
      this._freelancerRepository = new LocalStorageFreelancerRepository();
    }
    return this._freelancerRepository;
  }

  public get manageClientsUseCase(): ManageClientsUseCase {
    if (!this._manageClientsUseCase) {
      this._manageClientsUseCase = new ManageClientsUseCase(
        this.freelancerRepository,
        this.eventBus,
      );
    }
    return this._manageClientsUseCase;
  }

  public get manageInvoicesUseCase(): ManageInvoicesUseCase {
    if (!this._manageInvoicesUseCase) {
      this._manageInvoicesUseCase = new ManageInvoicesUseCase(
        this.freelancerRepository,
        this.eventBus,
      );
    }
    return this._manageInvoicesUseCase;
  }

  // Family Layer
  public get familyRepository(): LocalStorageFamilyRepository {
    if (!this._familyRepository) {
      this._familyRepository = new LocalStorageFamilyRepository();
    }
    return this._familyRepository;
  }

  public get manageFamilyUseCase(): ManageFamilyUseCase {
    if (!this._manageFamilyUseCase) {
      this._manageFamilyUseCase = new ManageFamilyUseCase(
        this.familyRepository,
        this.eventBus,
      );
    }
    return this._manageFamilyUseCase;
  }

  // Business Layer
  public get businessRepository(): LocalStorageBusinessRepository {
    if (!this._businessRepository) {
      this._businessRepository = new LocalStorageBusinessRepository();
    }
    return this._businessRepository;
  }

  public get manageBusinessUseCase(): ManageBusinessUseCase {
    if (!this._manageBusinessUseCase) {
      this._manageBusinessUseCase = new ManageBusinessUseCase(
        this.businessRepository,
        this.eventBus,
      );
    }
    return this._manageBusinessUseCase;
  }

  // Personal Mode Layer
  public get personalRepository(): LocalStoragePersonalRepository {
    if (!this._personalRepository) {
      this._personalRepository = new LocalStoragePersonalRepository();
    }
    return this._personalRepository;
  }

  public get managePersonalModeUseCase(): ManagePersonalModeUseCase {
    if (!this._managePersonalModeUseCase) {
      this._managePersonalModeUseCase = new ManagePersonalModeUseCase(
        this.personalRepository,
        this.eventBus,
      );
    }
    return this._managePersonalModeUseCase;
  }
}

export const container = new ServiceContainer();
