import type { ClientEntity } from "../entities/Client";
import type { InvoiceEntity } from "../entities/Invoice";
import type { InvoiceStatus } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Port
 * Interface: IFreelancerRepository
 * Defines persistence contracts for Freelancer clients and invoices.
 */
export interface IFreelancerRepository {
  // Clients
  getClients(userId: string): Promise<ClientEntity[]>;
  saveClient(client: ClientEntity): Promise<ClientEntity>;
  deleteClient(clientId: string, userId?: string): Promise<void>;

  // Invoices
  getInvoices(userId: string): Promise<InvoiceEntity[]>;
  saveInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity>;
  deleteInvoice(invoiceId: string, userId?: string): Promise<void>;
  updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    paymentDate?: string,
    userId?: string,
  ): Promise<void>;
}
