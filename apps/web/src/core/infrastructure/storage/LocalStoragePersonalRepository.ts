import type { IPersonalModeRepository } from "../../domain/personal/ports/IPersonalModeRepository";
import { BudgetEntity } from "../../domain/personal/entities/Budget";
import { SubscriptionEntity } from "../../domain/personal/entities/Subscription";
import type { Budget as BudgetDTO, Subscription as SubscriptionDTO } from "@/lib/supabase/types";
import { IdentityScope } from "../../domain/common/IdentityScope";

export const STORAGE_KEY_BUDGETS = "clario_personal_budgets";
export const STORAGE_KEY_SUBSCRIPTIONS = "clario_personal_subscriptions";

function readScoped<T>(baseKey: string, scopeId?: string, fallback: T[] = []): T[] {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  if (scopeId) IdentityScope.register(scopeId);
  const scopedKey = IdentityScope.getScopedKey(baseKey, scopeId);

  try {
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped) {
      return JSON.parse(rawScoped) as T[];
    }
    if (scopedKey !== baseKey) {
      const rawLegacy = localStorage.getItem(baseKey);
      if (rawLegacy) {
        return JSON.parse(rawLegacy) as T[];
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

function writeScoped<T>(baseKey: string, data: T[], scopeId?: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (scopeId) IdentityScope.register(scopeId);
  const scopedKey = IdentityScope.getScopedKey(baseKey, scopeId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`Error writing to localStorage [${scopedKey}]:`, err);
  }
}

/**
 * Clean Architecture - Infrastructure Layer
 * LocalStoragePersonalRepository
 * Implements IPersonalModeRepository via Scoped LocalStorage for Personal Mode Budgets & Subscriptions.
 */
export class LocalStoragePersonalRepository implements IPersonalModeRepository {
  public getBudgets(scopeId?: string): BudgetEntity[] {
    const dtoArray = readScoped<BudgetDTO>(STORAGE_KEY_BUDGETS, scopeId, []);
    return dtoArray.map((dto) => BudgetEntity.fromDTO(dto));
  }

  public saveBudgets(budgets: BudgetEntity[], scopeId?: string): void {
    const dtoArray = budgets.map((b) => b.toDTO());
    writeScoped<BudgetDTO>(STORAGE_KEY_BUDGETS, dtoArray, scopeId);
  }

  public getSubscriptions(scopeId?: string): SubscriptionEntity[] {
    const dtoArray = readScoped<SubscriptionDTO>(STORAGE_KEY_SUBSCRIPTIONS, scopeId, []);
    return dtoArray.map((dto) => SubscriptionEntity.fromDTO(dto));
  }

  public saveSubscriptions(subscriptions: SubscriptionEntity[], scopeId?: string): void {
    const dtoArray = subscriptions.map((s) => s.toDTO());
    writeScoped<SubscriptionDTO>(STORAGE_KEY_SUBSCRIPTIONS, dtoArray, scopeId);
  }
}
