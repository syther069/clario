import type { IBusinessRepository } from "../../../domain/business/ports/IBusinessRepository";
import type { BusinessTeamMemberEntity } from "../../../domain/business/entities/BusinessTeamMember";
import type { BusinessReimbursementEntity } from "../../../domain/business/entities/BusinessReimbursement";
import type { ExpensePolicyEntity } from "../../../domain/business/entities/ExpensePolicy";
import type { BusinessAuditEventEntity } from "../../../domain/business/entities/BusinessAuditEvent";
import type { ReimbursementStatus } from "@/lib/supabase/types";
import type { IEventBus } from "../../ports/IEventBus";

export const EVENT_BUSINESS_UPDATED = "clario:business:updated";

/**
 * Clean Architecture - Application Layer
 * Use Case: ManageBusinessUseCase
 * Coordinates organizational team directory, reimbursement review workflows,
 * expense policies, and corporate audit events.
 */
export class ManageBusinessUseCase {
  public constructor(
    private readonly repository: IBusinessRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  // Team
  public async getBusinessTeam(orgId: string): Promise<BusinessTeamMemberEntity[]> {
    return this.repository.getBusinessTeam(orgId);
  }

  public async saveBusinessTeamMember(member: BusinessTeamMemberEntity): Promise<BusinessTeamMemberEntity> {
    const saved = await this.repository.saveBusinessTeamMember(member);
    this.notifyUpdate(member.orgId);
    return saved;
  }

  public async deleteBusinessTeamMember(memberId: string, orgId?: string): Promise<void> {
    await this.repository.deleteBusinessTeamMember(memberId, orgId);
    this.notifyUpdate(orgId);
  }

  // Reimbursements
  public async getBusinessReimbursements(orgId: string): Promise<BusinessReimbursementEntity[]> {
    return this.repository.getBusinessReimbursements(orgId);
  }

  public async saveBusinessReimbursement(
    claim: BusinessReimbursementEntity,
  ): Promise<BusinessReimbursementEntity> {
    const saved = await this.repository.saveBusinessReimbursement(claim);
    this.notifyUpdate(claim.orgId);
    return saved;
  }

  public async updateReimbursementStatus(
    claimId: string,
    status: ReimbursementStatus,
    reviewerName?: string,
    reviewNotes?: string,
    monadTxHash?: string,
    orgId?: string,
  ): Promise<void> {
    await this.repository.updateReimbursementStatus(
      claimId,
      status,
      reviewerName,
      reviewNotes,
      monadTxHash,
      orgId,
    );
    this.notifyUpdate(orgId);
  }

  public async deleteBusinessReimbursement(claimId: string, orgId?: string): Promise<void> {
    await this.repository.deleteBusinessReimbursement(claimId, orgId);
    this.notifyUpdate(orgId);
  }

  // Policies
  public async getExpensePolicies(orgId: string): Promise<ExpensePolicyEntity[]> {
    return this.repository.getExpensePolicies(orgId);
  }

  public async saveExpensePolicy(policy: ExpensePolicyEntity): Promise<ExpensePolicyEntity> {
    const saved = await this.repository.saveExpensePolicy(policy);
    this.notifyUpdate(policy.orgId);
    return saved;
  }

  public async deleteExpensePolicy(policyId: string, orgId?: string): Promise<void> {
    await this.repository.deleteExpensePolicy(policyId, orgId);
    this.notifyUpdate(orgId);
  }

  // Audit Events
  public async getBusinessAuditEvents(orgId: string): Promise<BusinessAuditEventEntity[]> {
    return this.repository.getBusinessAuditEvents(orgId);
  }

  public async recordBusinessAuditEvent(
    event: BusinessAuditEventEntity,
  ): Promise<BusinessAuditEventEntity> {
    const recorded = await this.repository.recordBusinessAuditEvent(event);
    this.notifyUpdate(event.orgId);
    return recorded;
  }

  private notifyUpdate(orgId?: string): void {
    if (this.eventBus) {
      this.eventBus.publish(EVENT_BUSINESS_UPDATED, {
        orgId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
