import type { IFreelancerRepository } from "../../../domain/freelancer/ports/IFreelancerRepository";
import type { InvoiceEntity } from "../../../domain/freelancer/entities/Invoice";
import type { InvoiceStatus } from "@/lib/supabase/types";
import type { IEventBus } from "../../ports/IEventBus";

export const EVENT_INVOICES_UPDATED = "clario:freelancer:invoices_updated";

/**
 * Clean Architecture - Application Layer
 * Use Case: ManageInvoicesUseCase
 * Coordinates creating, fetching, updating statuses, and deleting freelancer invoices.
 */
export class ManageInvoicesUseCase {
  public constructor(
    private readonly repository: IFreelancerRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  public async getInvoices(userId: string): Promise<InvoiceEntity[]> {
    return this.repository.getInvoices(userId);
  }

  public async saveInvoice(invoice: InvoiceEntity): Promise<InvoiceEntity> {
    const saved = await this.repository.saveInvoice(invoice);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_INVOICES_UPDATED, {
        invoice: saved,
        userId: invoice.userId,
      });
    }
    return saved;
  }

  public async deleteInvoice(invoiceId: string, userId?: string): Promise<void> {
    await this.repository.deleteInvoice(invoiceId, userId);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_INVOICES_UPDATED, {
        deletedInvoiceId: invoiceId,
        userId,
      });
    }
  }

  public async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    paymentDate?: string,
    userId?: string,
  ): Promise<void> {
    await this.repository.updateInvoiceStatus(invoiceId, status, paymentDate, userId);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_INVOICES_UPDATED, {
        invoiceId,
        status,
        paymentDate,
        userId,
      });
    }
  }
}
