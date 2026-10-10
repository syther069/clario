import type { IFamilyRepository } from "../../../domain/family/ports/IFamilyRepository";
import type { FamilyMemberEntity } from "../../../domain/family/entities/FamilyMember";
import type { FamilyBillEntity } from "../../../domain/family/entities/FamilyBill";
import type { FamilySettlementEntity } from "../../../domain/family/entities/FamilySettlement";
import type { IEventBus } from "../../ports/IEventBus";

export const EVENT_FAMILY_UPDATED = "clario:family:updated";

/**
 * Clean Architecture - Application Layer
 * Use Case: ManageFamilyUseCase
 * Coordinates household roster management, shared utility bills, and IOU settlements.
 */
export class ManageFamilyUseCase {
  public constructor(
    private readonly repository: IFamilyRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  // Members
  public async getFamilyMembers(householdId: string): Promise<FamilyMemberEntity[]> {
    return this.repository.getFamilyMembers(householdId);
  }

  public async saveFamilyMember(member: FamilyMemberEntity): Promise<FamilyMemberEntity> {
    const saved = await this.repository.saveFamilyMember(member);
    this.notifyUpdate(member.householdId);
    return saved;
  }

  public async deleteFamilyMember(memberId: string, householdId?: string): Promise<void> {
    await this.repository.deleteFamilyMember(memberId, householdId);
    this.notifyUpdate(householdId);
  }

  // Bills
  public async getFamilyBills(householdId: string): Promise<FamilyBillEntity[]> {
    return this.repository.getFamilyBills(householdId);
  }

  public async saveFamilyBill(bill: FamilyBillEntity): Promise<FamilyBillEntity> {
    const saved = await this.repository.saveFamilyBill(bill);
    this.notifyUpdate(bill.householdId);
    return saved;
  }

  public async deleteFamilyBill(billId: string, householdId?: string): Promise<void> {
    await this.repository.deleteFamilyBill(billId, householdId);
    this.notifyUpdate(householdId);
  }

  public async updateFamilyBillStatus(
    billId: string,
    status: "unpaid" | "paid" | "overdue",
    paidByName?: string,
    householdId?: string,
  ): Promise<void> {
    await this.repository.updateFamilyBillStatus(billId, status, paidByName, householdId);
    this.notifyUpdate(householdId);
  }

  // Settlements
  public async getFamilySettlements(householdId: string): Promise<FamilySettlementEntity[]> {
    return this.repository.getFamilySettlements(householdId);
  }

  public async saveFamilySettlement(settlement: FamilySettlementEntity): Promise<FamilySettlementEntity> {
    const saved = await this.repository.saveFamilySettlement(settlement);
    this.notifyUpdate(settlement.householdId);
    return saved;
  }

  public async deleteFamilySettlement(settlementId: string, householdId?: string): Promise<void> {
    await this.repository.deleteFamilySettlement(settlementId, householdId);
    this.notifyUpdate(householdId);
  }

  private notifyUpdate(householdId?: string): void {
    if (this.eventBus) {
      this.eventBus.publish(EVENT_FAMILY_UPDATED, {
        householdId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
