import type { FamilyMemberEntity } from "../entities/FamilyMember";
import type { FamilyBillEntity } from "../entities/FamilyBill";
import type { FamilySettlementEntity } from "../entities/FamilySettlement";

/**
 * Clean Architecture - Domain Port
 * Interface: IFamilyRepository
 * Defines persistence contracts for Family household members, bills, and settlements.
 */
export interface IFamilyRepository {
  // Members
  getFamilyMembers(householdId: string): Promise<FamilyMemberEntity[]>;
  saveFamilyMember(member: FamilyMemberEntity): Promise<FamilyMemberEntity>;
  deleteFamilyMember(memberId: string, householdId?: string): Promise<void>;

  // Bills
  getFamilyBills(householdId: string): Promise<FamilyBillEntity[]>;
  saveFamilyBill(bill: FamilyBillEntity): Promise<FamilyBillEntity>;
  deleteFamilyBill(billId: string, householdId?: string): Promise<void>;
  updateFamilyBillStatus(
    billId: string,
    status: "unpaid" | "paid" | "overdue",
    paidByName?: string,
    householdId?: string,
  ): Promise<void>;

  // Settlements
  getFamilySettlements(householdId: string): Promise<FamilySettlementEntity[]>;
  saveFamilySettlement(settlement: FamilySettlementEntity): Promise<FamilySettlementEntity>;
  deleteFamilySettlement(settlementId: string, householdId?: string): Promise<void>;
}
