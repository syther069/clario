import type { IPersonalModeRepository } from "../../../domain/personal/ports/IPersonalModeRepository";
import type { BudgetEntity } from "../../../domain/personal/entities/Budget";
import type { SubscriptionEntity } from "../../../domain/personal/entities/Subscription";
import type { IEventBus } from "../../ports/IEventBus";

export const EVENT_PERSONAL_MODE_UPDATED = "clario:personal:updated";

/**
 * Clean Architecture - Application Layer
 * Use Case: ManagePersonalModeUseCase
 * Coordinates personal category budget allocations and recurring subscription lifecycles.
 */
export class ManagePersonalModeUseCase {
  public constructor(
    private readonly repository: IPersonalModeRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  public getBudgets(scopeId?: string): BudgetEntity[] {
    return this.repository.getBudgets(scopeId);
  }

  public saveBudgets(budgets: BudgetEntity[], scopeId?: string): void {
    this.repository.saveBudgets(budgets, scopeId);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_PERSONAL_MODE_UPDATED, {
        type: "budgets",
        scopeId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public getSubscriptions(scopeId?: string): SubscriptionEntity[] {
    return this.repository.getSubscriptions(scopeId);
  }

  public saveSubscriptions(subscriptions: SubscriptionEntity[], scopeId?: string): void {
    this.repository.saveSubscriptions(subscriptions, scopeId);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_PERSONAL_MODE_UPDATED, {
        type: "subscriptions",
        scopeId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
