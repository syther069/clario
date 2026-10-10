import type { IFreelancerRepository } from "../../domain/freelancer/ports/IFreelancerRepository";
import { ClientEntity } from "../../domain/freelancer/entities/Client";
import { InvoiceEntity } from "../../domain/freelancer/entities/Invoice";
import type { Client as ClientDTO, Invoice as InvoiceDTO, InvoiceStatus } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { IdentityScope } from "../../domain/common/IdentityScope";

export const STORAGE_KEY_CLIENTS = "clario_freelancer_clients";
export const STORAGE_KEY_INVOICES = "clario_freelancer_invoices";

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

function deleteFromAllScopes<T extends { id: string }>(baseKey: string, itemId: string, scopeId?: string): void {
  if (scopeId) {
    const list = readScoped<T>(baseKey, scopeId, []);
    writeScoped(baseKey, list.filter((it) => it.id !== itemId), scopeId);
    return;
  }

  // Unscoped
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const unscoped = readScoped<T>(baseKey, undefined, []);
      if (unscoped.length > 0) {
        localStorage.setItem(baseKey, JSON.stringify(unscoped.filter((it) => it.id !== itemId)));
      }

      for (const scope of IdentityScope.getKnownScopes()) {
        const list = readScoped<T>(baseKey, scope, []);
        if (list.some((it) => it.id === itemId)) {
          writeScoped(baseKey, list.filter((it) => it.id !== itemId), scope);
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === baseKey || k.endsWith(`_${baseKey}`))) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as T[];
            if (Array.isArray(parsed) && parsed.some((it) => it.id === itemId)) {
              localStorage.setItem(k, JSON.stringify(parsed.filter((it) => it.id !== itemId)));
            }
          }
        }
      }
    } catch {
      // ignore scan errors
    }
  }
}

/**
 * Clean Architecture - Infrastructure Layer
 * LocalStorageFreelancerRepository
 * Implements IFreelancerRepository via Scoped LocalStorage + Supabase background synchronization.
 */
export class LocalStorageFreelancerRepository implements IFreelancerRepository {
  public async getClients(userId: string): Promise<ClientEntity[]> {
    try {
      const supabase = getSupabaseClient(userId);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_CLIENTS, data as ClientDTO[], userId);
        return (data as ClientDTO[]).map((dto) => ClientEntity.fromDTO(dto));
      }
    } catch {
      // offline / fallback
    }

    const local = readScoped<ClientDTO>(STORAGE_KEY_CLIENTS, userId, []);
    return local.map((dto) => ClientEntity.fromDTO(dto));
  }

  public async saveClient(client: ClientEntity): Promise<ClientEntity> {
    const scopeId = client.userId;
    const local = readScoped<ClientDTO>(STORAGE_KEY_CLIENTS, scopeId, []);
    const updated = [client.toDTO(), ...local.filter((c) => c.id !== client.id)];
    writeScoped(STORAGE_KEY_CLIENTS, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("clients").upsert(client.toDTO());
    } catch {
      // Supabase optional in offline mode
    }

    return client;
  }

  public async deleteClient(clientId: string, userId?: string): Promise<void> {
    deleteFromAllScopes<ClientDTO>(STORAGE_KEY_CLIENTS, clientId, userId);

    try {
      const supabase = getSupabaseClient(userId);
      await supabase.from("clients").delete().eq("id", clientId);
    } catch {
      // optional
    }
  }

  public async getInvoices(userId: string): Promise<InvoiceEntity[]> {
    try {
      const supabase = getSupabaseClient(userId);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_INVOICES, data as InvoiceDTO[], userId);
        return (data as InvoiceDTO[]).map((dto) => InvoiceEntity.fromDTO(dto));
      }
    } catch {
      // fallback
    }

    const local = readScoped<InvoiceDTO>(STORAGE_KEY_INVOICES, userId, []);
    return local.map((dto) => InvoiceEntity.fromDTO(dto));
  }

  public async saveInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity> {
    const scopeId = invoice.userId;
    const local = readScoped<InvoiceDTO>(STORAGE_KEY_INVOICES, scopeId, []);
    const updated = [invoice.toDTO(), ...local.filter((i) => i.id !== invoice.id)];
    writeScoped(STORAGE_KEY_INVOICES, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("invoices").upsert(invoice.toDTO());
    } catch {
      // offline
    }

    return invoice;
  }

  public async deleteInvoice(invoiceId: string, userId?: string): Promise<void> {
    deleteFromAllScopes<InvoiceDTO>(STORAGE_KEY_INVOICES, invoiceId, userId);

    try {
      const supabase = getSupabaseClient(userId);
      await supabase.from("invoices").delete().eq("id", invoiceId);
    } catch {
      // optional
    }
  }

  public async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    paymentDate?: string,
    userId?: string,
  ): Promise<void> {
    const scopesToUpdate = userId ? [userId] : [undefined, ...IdentityScope.getKnownScopes()];

    for (const scope of scopesToUpdate) {
      const local = readScoped<InvoiceDTO>(STORAGE_KEY_INVOICES, scope, []);
      const target = local.find((i) => i.id === invoiceId);
      if (target) {
        target.status = status;
        if (paymentDate) target.payment_received_date = paymentDate;
        target.updated_at = new Date().toISOString();
        writeScoped(STORAGE_KEY_INVOICES, local, scope);
      }
    }

    try {
      const supabase = getSupabaseClient(userId);
      await supabase
        .from("invoices")
        .update({
          status,
          payment_received_date: paymentDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
    } catch {
      // optional
    }
  }
}
