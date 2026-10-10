import type { BusinessTeamMemberEntity } from "../entities/BusinessTeamMember";
import type { BusinessReimbursementEntity } from "../entities/BusinessReimbursement";
import type { ExpensePolicyEntity } from "../entities/ExpensePolicy";
import type { BusinessAuditEventEntity } from "../entities/BusinessAuditEvent";
import type { ReimbursementStatus } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Port
 * Interface: IBusinessRepository
 * Defines persistence contracts for Corporate Business team members, reimbursements, policies, and audit logs.
 */
export interface IBusinessRepository {
  // Team
  getBusinessTeam(orgId: string): Promise<BusinessTeamMemberEntity[]>;
  saveBusinessTeamMember(member: BusinessTeamMemberEntity): Promise<BusinessTeamMemberEntity>;
  deleteBusinessTeamMember(memberId: string, orgId?: string): Promise<void>;

  // Reimbursements
  getBusinessReimbursements(orgId: string): Promise<BusinessReimbursementEntity[]>;
  saveBusinessReimbursement(claim: BusinessReimbursementEntity): Promise<BusinessReimbursementEntity>;
  updateReimbursementStatus(
    claimId: string,
    status: ReimbursementStatus,
    reviewerName?: string,
    reviewNotes?: string,
    monadTxHash?: string,
    orgId?: string,
  ): Promise<void>;
  deleteBusinessReimbursement(claimId: string, orgId?: string): Promise<void>;

  // Expense Policies
  getExpensePolicies(orgId: string): Promise<ExpensePolicyEntity[]>;
  saveExpensePolicy(policy: ExpensePolicyEntity): Promise<ExpensePolicyEntity>;
  deleteExpensePolicy(policyId: string, orgId?: string): Promise<void>;

  // Audit Events
  getBusinessAuditEvents(orgId: string): Promise<BusinessAuditEventEntity[]>;
  recordBusinessAuditEvent(event: BusinessAuditEventEntity): Promise<BusinessAuditEventEntity>;
}
