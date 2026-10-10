/**
 * Clean Architecture Core
 * Central domain, application, infrastructure, and dependency injection exports.
 */

// Domain Layer: Common Value Objects
export * from "./domain/common/IdentityScope";
export * from "./domain/transaction/value-objects/Money";

// Domain Layer: Transaction
export * from "./domain/transaction/entities/Transaction";
export * from "./domain/transaction/ports/ITransactionRepository";

// Domain Layer: Freelancer
export * from "./domain/freelancer/entities/Client";
export * from "./domain/freelancer/entities/Invoice";
export * from "./domain/freelancer/ports/IFreelancerRepository";

// Domain Layer: Family
export * from "./domain/family/entities/FamilyMember";
export * from "./domain/family/entities/FamilyBill";
export * from "./domain/family/entities/FamilySettlement";
export * from "./domain/family/ports/IFamilyRepository";

// Domain Layer: Business
export * from "./domain/business/entities/BusinessTeamMember";
export * from "./domain/business/entities/BusinessReimbursement";
export * from "./domain/business/entities/ExpensePolicy";
export * from "./domain/business/entities/BusinessAuditEvent";
export * from "./domain/business/ports/IBusinessRepository";

// Domain Layer: Personal
export * from "./domain/personal/entities/Budget";
export * from "./domain/personal/entities/Subscription";
export * from "./domain/personal/ports/IPersonalModeRepository";

// Application Layer: Ports & Use Cases
export * from "./application/ports/IEventBus";
export * from "./application/transaction/use-cases/GetTransactionsUseCase";
export * from "./application/transaction/use-cases/UpsertTransactionUseCase";
export * from "./application/transaction/use-cases/ExtractReceiptTransactionsUseCase";

export * from "./application/freelancer/use-cases/ManageClientsUseCase";
export * from "./application/freelancer/use-cases/ManageInvoicesUseCase";
export * from "./application/family/use-cases/ManageFamilyUseCase";
export * from "./application/business/use-cases/ManageBusinessUseCase";
export * from "./application/personal/use-cases/ManagePersonalModeUseCase";

// Infrastructure Layer: Adapters & Storage
export * from "./infrastructure/events/BrowserEventBus";
export * from "./infrastructure/storage/LocalStorageTransactionRepository";
export * from "./infrastructure/storage/LocalStorageFreelancerRepository";
export * from "./infrastructure/storage/LocalStorageFamilyRepository";
export * from "./infrastructure/storage/LocalStorageBusinessRepository";
export * from "./infrastructure/storage/LocalStoragePersonalRepository";

// Composition Root & Dependency Injection
export * from "./di/container";
