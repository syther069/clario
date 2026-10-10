import type { BudgetEntity } from "../entities/Budget";
import type { SubscriptionEntity } from "../entities/Subscription";

/**
 * Clean Architecture - Domain Port
 * Interface: IPersonalModeRepository
 * Defines persistence contracts for personal category budgets and recurring subscriptions.
 */
export interface IPersonalModeRepository {
  getBudgets(scopeId?: string): BudgetEntity[];
  saveBudgets(budgets: BudgetEntity[], scopeId?: string): void;
  getSubscriptions(scopeId?: string): SubscriptionEntity[];
  saveSubscriptions(subscriptions: SubscriptionEntity[], scopeId?: string): void;
}
