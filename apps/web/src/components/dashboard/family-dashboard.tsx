"use client";

import React, { useState, useEffect, useMemo } from "react";
import type {
  Transaction,
  FamilyMember,
  FamilyBill,
  FamilySettlement,
  FamilyView,
  Budget,
  FinancialGoal,
  Category,
} from "@/lib/supabase/types";

function getBudgetCategoryName(
  category?: Category | null,
  categoryId?: string | null,
): string {
  if (!category && !categoryId) return "General";
  if (typeof category === "object" && category?.name) return category.name;
  const raw = (typeof category === "string" ? category : categoryId) || "";
  return raw || "General";
}
import {
  UsersRound,
  House,
  Receipt,
  ChartNoAxesCombined,
  CalendarDays,
  Target,
  ArrowLeftRight,
  Plus,
  BadgeCheck,
  HandCoins,
  X,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import {
  getFamilyMembers,
  saveFamilyMember,
  deleteFamilyMember,
  getFamilyBills,
  saveFamilyBill,
  deleteFamilyBill,
  updateFamilyBillStatus,
  getFamilySettlements,
  saveFamilySettlement,
  deleteFamilySettlement,
} from "@/lib/modes/mode-storage";
import { getSupabaseClient } from "@/lib/supabase/client";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";

import { AnimatedBackground, Magnetic } from "@/components/ui/motion";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { motion, AnimatePresence } from "motion/react";

interface FamilyDashboardProps {
  transactions: Transaction[];
  budgets?: Budget[] | undefined;
  goals?: FinancialGoal[] | undefined;
  activeView?: FamilyView | undefined;
  onViewChange?: ((view: FamilyView) => void) | undefined;
  onAddTransaction?: (() => void) | undefined;
  onUploadReceipt?: (() => void) | undefined;
  onUpdateTransaction?: ((tx: Partial<Transaction>) => void) | undefined;
  userId?: string | undefined;
  userAddress?: string | null | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
  currencySymbol?: string | undefined;
}

export function FamilyDashboard({
  transactions = [],
  budgets = [],
  goals = [],
  activeView: propActiveView,
  onViewChange,
  onAddTransaction,
  onUploadReceipt: _onUploadReceipt,
  onUpdateTransaction,
  userId = "demo_user",
  currencySymbol = "$",
}: FamilyDashboardProps) {
  const householdId = `household_${userId}`;

  // View state sync
  const [internalView, setInternalView] = useState<FamilyView>("overview");
  const activeView = propActiveView || internalView;

  const handleViewChange = (view: FamilyView) => {
    if (onViewChange) {
      onViewChange(view);
    }
    setInternalView(view);
  };

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [bills, setBills] = useState<FamilyBill[]>([]);
  const [settlements, setSettlements] = useState<FamilySettlement[]>([]);

  // Budget & Goal reactive state (Rule 40: Zero mock data, reactive to props and local changes)
  const [createdBudgets, setCreatedBudgets] = useState<Budget[]>([]);
  const [deletedBudgetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const localBudgets = useMemo(() => {
    const combined = [...createdBudgets, ...(budgets || [])];
    const seen = new Set<string>();
    return combined.filter((b) => {
      if (deletedBudgetIds.has(b.id) || seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [createdBudgets, budgets, deletedBudgetIds]);

  const [createdGoals, setCreatedGoals] = useState<FinancialGoal[]>([]);
  const [updatedGoals, setUpdatedGoals] = useState<
    Record<string, FinancialGoal>
  >({});
  const [deletedGoalIds, setDeletedGoalIds] = useState<Set<string>>(
    () => new Set(),
  );
  const localGoals = useMemo(() => {
    const combined = [...createdGoals, ...(goals || [])];
    const seen = new Set<string>();
    return combined
      .filter((g) => {
        if (deletedGoalIds.has(g.id) || seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      })
      .map((g) => updatedGoals[g.id] ?? g);
  }, [createdGoals, goals, deletedGoalIds, updatedGoals]);

  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [billCategoryFilter, setBillCategoryFilter] = useState("all");
  const [billStatusFilter, setBillStatusFilter] = useState<
    "all" | "unpaid" | "paid"
  >("all");

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedTxForSplit, setSelectedTxForSplit] =
    useState<Transaction | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [selectedGoalForContribute, setSelectedGoalForContribute] =
    useState<FinancialGoal | null>(null);
  const [isManualSettlementModalOpen, setIsManualSettlementModalOpen] =
    useState(false);

  // Form states with React 19 Compiler purity (lazy initializers)
  const [memberForm, setMemberForm] = useState(() => ({
    name: "",
    email: "",
    role: "member" as "owner" | "member" | "viewer",
    avatar_color: "#836EF9",
  }));

  const [billForm, setBillForm] = useState(() => ({
    name: "",
    amount: "",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]!,
    category: "utilities",
    paid_by_name: "",
    frequency: "monthly" as "monthly" | "quarterly" | "yearly",
  }));

  const [budgetForm, setBudgetForm] = useState(() => ({
    name: "",
    category: "Groceries",
    limit: "",
  }));

  const [goalForm, setGoalForm] = useState(() => ({
    title: "",
    target_amount: "",
    current_amount: "0",
    deadline: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]!,
    category: "Vacation",
  }));

  const [contributeAmount, setContributeAmount] = useState("");

  const [settlementForm, setSettlementForm] = useState(() => ({
    from_member_id: "",
    to_member_id: "",
    amount: "",
    notes: "",
  }));

  // Split Form State
  const [splitPayerId, setSplitPayerId] = useState<string>("");
  const [splitSelectedMemberIds, setSplitSelectedMemberIds] = useState<
    string[]
  >([]);
  const [splitType, setSplitType] = useState<
    "equal" | "custom_percentage" | "exact"
  >("equal");
  const [splitPercentages, setSplitPercentages] = useState<
    Record<string, number>
  >({});
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  // Load Family Data on Mount
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      try {
        const [loadedMembers, loadedBills, loadedSettlements] =
          await Promise.all([
            getFamilyMembers(householdId),
            getFamilyBills(householdId),
            getFamilySettlements(householdId),
          ]);
        if (!ignore) {
          if (loadedMembers.length === 0) {
            const defaultSelf: FamilyMember = {
              id: `member-${userId}`,
              household_id: householdId,
              user_id: userId,
              name: "You (Household Owner)",
              role: "owner",
              avatar_color: "#836EF9",
              created_at: new Date().toISOString(),
            };
            setMembers([defaultSelf]);
            void saveFamilyMember(defaultSelf);
          } else {
            setMembers(loadedMembers);
          }
          setBills(loadedBills);
          setSettlements(loadedSettlements);
        }
      } catch (err) {
        console.warn("Error loading family data:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    void loadData();
    return () => {
      ignore = true;
    };
  }, [householdId, userId]);

  // Derived Financial Metrics
  const householdExpenses = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.type === "expense" && (t.mode === "family" || t.is_shared || !t.mode),
    );
  }, [transactions]);

  const totalHouseholdSpend = useMemo(() => {
    return householdExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [householdExpenses]);

  const unpaidBillsTotal = useMemo(() => {
    return bills
      .filter((b) => b.status === "unpaid" || b.status === "overdue")
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [bills]);

  const pendingSettlementsTotal = useMemo(() => {
    return settlements
      .filter((s) => s.status === "pending")
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [settlements]);

  // Budgets with live spending computation
  const budgetStatusList = useMemo(() => {
    return localBudgets.map((b) => {
      const catName = getBudgetCategoryName(b.category, b.category_id);
      const catNameLower = catName.toLowerCase();
      const categorySpent = householdExpenses
        .filter((t) => {
          const txCat = String(t.category || "").toLowerCase();
          const txDesc = String(t.description || "").toLowerCase();
          return (
            (catNameLower && txCat.includes(catNameLower)) ||
            (catNameLower && txDesc.includes(catNameLower))
          );
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const limit = Number(b.amount_limit || 0);
      const spent =
        categorySpent > 0 ? categorySpent : Number(b.spent_amount || 0);
      const pct =
        limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      const remaining = Math.max(0, limit - spent);
      const isOver = spent > limit;

      return {
        ...b,
        displayName: catName,
        limit,
        spent,
        pct,
        remaining,
        isOver,
      };
    });
  }, [localBudgets, householdExpenses]);


  // Member balance balances ("who owes whom")
  const memberBalances = useMemo(() => {
    const balances: Record<
      string,
      { member: FamilyMember; owedToMe: number; iOwe: number; net: number }
    > = {};

    members.forEach((m) => {
      balances[m.id] = {
        member: m,
        owedToMe: 0,
        iOwe: 0,
        net: 0,
      };
    });

    settlements
      .filter((s) => s.status === "pending")
      .forEach((s) => {
        if (s.to_member_id && balances[s.to_member_id]) {
          balances[s.to_member_id]!.owedToMe += Number(s.amount || 0);
        }
        if (s.from_member_id && balances[s.from_member_id]) {
          balances[s.from_member_id]!.iOwe += Number(s.amount || 0);
        }
      });

    Object.values(balances).forEach((b) => {
      b.net = b.owedToMe - b.iOwe;
    });

    return Object.values(balances);
  }, [members, settlements]);

  // Filtered Lists
  const filteredHouseholdExpenses = useMemo(() => {
    return householdExpenses.filter((tx) => {
      const matchesSearch =
        expenseSearch.trim() === "" ||
        tx.merchant.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        String(tx.description || "")
          .toLowerCase()
          .includes(expenseSearch.toLowerCase());
      const matchesCategory =
        expenseCategoryFilter === "all" ||
        String(tx.category || "").toLowerCase() ===
          expenseCategoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [householdExpenses, expenseSearch, expenseCategoryFilter]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesCategory =
        billCategoryFilter === "all" ||
        b.category.toLowerCase() === billCategoryFilter.toLowerCase();
      const matchesStatus =
        billStatusFilter === "all" || b.status === billStatusFilter;
      return matchesCategory && matchesStatus;
    });
  }, [bills, billCategoryFilter, billStatusFilter]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberForm.name.trim()) return;

    const newMember: FamilyMember = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name: memberForm.name.trim(),
      email: memberForm.email.trim() || null,
      role: memberForm.role,
      avatar_color: memberForm.avatar_color,
      created_at: new Date().toISOString(),
    };

    const saved = await saveFamilyMember(newMember);
    setMembers((prev) => [...prev, saved]);
    setIsMemberModalOpen(false);
    setMemberForm({
      name: "",
      email: "",
      role: "member",
      avatar_color: "#836EF9",
    });
  }

  async function handleDeleteMember(memberId: string) {
    if (
      confirm("Are you sure you want to remove this member from the household?")
    ) {
      await deleteFamilyMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billForm.name.trim() || !billForm.amount) return;

    const newBill: FamilyBill = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name: billForm.name.trim(),
      amount: Number(billForm.amount),
      currency: "USD",
      due_date: billForm.due_date,
      category: billForm.category,
      paid_by_name: billForm.paid_by_name || null,
      is_recurring: true,
      frequency: billForm.frequency,
      status: "unpaid",
      created_at: new Date().toISOString(),
    };

    const saved = await saveFamilyBill(newBill);
    setBills((prev) => [...prev, saved]);
    setIsBillModalOpen(false);
    setBillForm({
      name: "",
      amount: "",
      due_date: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .split("T")[0]!,
      category: "utilities",
      paid_by_name: "",
      frequency: "monthly",
    });
  }

  async function handleDeleteBill(billId: string) {
    if (confirm("Are you sure you want to delete this scheduled bill?")) {
      await deleteFamilyBill(billId);
      setBills((prev) => prev.filter((b) => b.id !== billId));
    }
  }

  async function handleMarkBillPaid(bill: FamilyBill) {
    const payerName = bill.paid_by_name || members[0]?.name || "Household";
    await updateFamilyBillStatus(bill.id, "paid", payerName);
    setBills((prev) =>
      prev.map((b) =>
        b.id === bill.id
          ? { ...b, status: "paid", paid_by_name: payerName }
          : b,
      ),
    );

    // Record verified transaction in ledger
    if (onUpdateTransaction) {
      const billTx: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        amount: Number(bill.amount),
        currency: bill.currency,
        type: "expense",
        merchant: `Bill: ${bill.name}`,
        description: `Household Bill: ${bill.name} (${bill.category}) - Paid by ${payerName}`,
        category: bill.category,
        category_id: bill.category,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0]!,
        status: "cleared",
        source: "manual",
        mode: "family",
        is_shared: true,
        verification_state: "unverified",
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onUpdateTransaction(billTx);
    }
  }

  async function handleSettleUp(settlement: FamilySettlement) {
    const updated = {
      ...settlement,
      status: "settled" as const,
      settled_at: new Date().toISOString(),
    };
    await saveFamilySettlement(updated);
    setSettlements((prev) =>
      prev.map((s) => (s.id === settlement.id ? updated : s)),
    );

    if (onUpdateTransaction) {
      const settleTx: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        amount: Number(settlement.amount),
        currency: settlement.currency,
        type: "transfer",
        merchant: `Settlement: ${settlement.from_member_name} → ${settlement.to_member_name}`,
        description: `Household settlement between ${settlement.from_member_name} and ${settlement.to_member_name}`,
        category: "settlement",
        category_id: "settlement",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0]!,
        status: "cleared",
        source: "manual",
        mode: "family",
        verification_state: "unverified",
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onUpdateTransaction(settleTx);
    }
  }

  async function handleDeleteSettlement(settlementId: string) {
    if (confirm("Are you sure you want to delete this settlement record?")) {
      await deleteFamilySettlement(settlementId);
      setSettlements((prev) => prev.filter((s) => s.id !== settlementId));
    }
  }

  // Open Split Modal on Transaction
  function handleOpenSplitModal(tx: Transaction) {
    setSelectedTxForSplit(tx);
    const defaultPayer = members[0]?.id || "";
    setSplitPayerId(defaultPayer);
    setSplitSelectedMemberIds(members.map((m) => m.id));
    setSplitType("equal");
    setIsSplitModalOpen(true);
  }

  async function handleConfirmSplit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTxForSplit || splitSelectedMemberIds.length === 0) return;

    const totalAmt = Number(selectedTxForSplit.amount);
    const payer = members.find((m) => m.id === splitPayerId) || members[0];
    if (!payer) return;

    const newSettlements: FamilySettlement[] = [];

    if (splitType === "equal") {
      const share = Number(
        (totalAmt / splitSelectedMemberIds.length).toFixed(2),
      );
      splitSelectedMemberIds.forEach((mId) => {
        if (mId !== payer.id) {
          const fromMember = members.find((m) => m.id === mId);
          if (fromMember) {
            newSettlements.push({
              id: crypto.randomUUID(),
              household_id: householdId,
              from_member_id: fromMember.id,
              from_member_name: fromMember.name,
              to_member_id: payer.id,
              to_member_name: payer.name,
              amount: share,
              currency: selectedTxForSplit.currency || "USD",
              status: "pending",
              created_at: new Date().toISOString(),
            });
          }
        }
      });
    } else if (splitType === "custom_percentage") {
      splitSelectedMemberIds.forEach((mId) => {
        if (mId !== payer.id) {
          const fromMember = members.find((m) => m.id === mId);
          const pct = splitPercentages[mId] || 0;
          const share = Number(((totalAmt * pct) / 100).toFixed(2));
          if (fromMember && share > 0) {
            newSettlements.push({
              id: crypto.randomUUID(),
              household_id: householdId,
              from_member_id: fromMember.id,
              from_member_name: fromMember.name,
              to_member_id: payer.id,
              to_member_name: payer.name,
              amount: share,
              currency: selectedTxForSplit.currency || "USD",
              status: "pending",
              created_at: new Date().toISOString(),
            });
          }
        }
      });
    } else {
      splitSelectedMemberIds.forEach((mId) => {
        if (mId !== payer.id) {
          const fromMember = members.find((m) => m.id === mId);
          const share = splitAmounts[mId] || 0;
          if (fromMember && share > 0) {
            newSettlements.push({
              id: crypto.randomUUID(),
              household_id: householdId,
              from_member_id: fromMember.id,
              from_member_name: fromMember.name,
              to_member_id: payer.id,
              to_member_name: payer.name,
              amount: share,
              currency: selectedTxForSplit.currency || "USD",
              status: "pending",
              created_at: new Date().toISOString(),
            });
          }
        }
      });
    }

    for (const s of newSettlements) {
      await saveFamilySettlement(s);
    }

    setSettlements((prev) => [...newSettlements, ...prev]);
    setIsSplitModalOpen(false);
    setSelectedTxForSplit(null);
  }

  // Create Budget Handler
  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetForm.name.trim() || !budgetForm.limit) return;

    const catSlug = budgetForm.category.toLowerCase().replace(/\s+/g, "_");
    const newBudget: Budget = {
      id: crypto.randomUUID(),
      user_id: userId,
      category_id: catSlug,
      category: {
        id: catSlug,
        name: budgetForm.name.trim() || budgetForm.category,
        slug: catSlug,
        is_system: false,
      },
      amount_limit: Number(budgetForm.limit),
      spent_amount: 0,
      period: "monthly",
      created_at: new Date().toISOString(),
    };

    setCreatedBudgets((prev) => [newBudget, ...prev]);
    try {
      const supabase = getSupabaseClient();
      await supabase.from("budgets").upsert(newBudget);
    } catch {
      // offline fallback
    }

    setIsBudgetModalOpen(false);
    setBudgetForm({ name: "", category: "Groceries", limit: "" });
  }


  // Create Goal Handler
  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalForm.title.trim() || !goalForm.target_amount) return;

    const newGoal: FinancialGoal = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: goalForm.title.trim(),
      name: goalForm.title.trim(),
      target_amount: Number(goalForm.target_amount),
      current_amount: Number(goalForm.current_amount || 0),
      deadline: goalForm.deadline,
      target_date: goalForm.deadline,
      currency: "USD",
      status: "in_progress",
      created_at: new Date().toISOString(),
    };

    setCreatedGoals((prev) => [newGoal, ...prev]);
    try {
      const supabase = getSupabaseClient();
      await supabase.from("goals").upsert(newGoal);
    } catch {
      // offline fallback
    }

    setIsGoalModalOpen(false);
    setGoalForm({
      title: "",
      target_amount: "",
      current_amount: "0",
      deadline: new Date(Date.now() + 90 * 86400000)
        .toISOString()
        .split("T")[0]!,
      category: "Vacation",
    });
  }

  async function handleDeleteGoal(goalId: string) {
    if (confirm("Delete this family savings goal?")) {
      setDeletedGoalIds((prev) => new Set(prev).add(goalId));
      try {
        const supabase = getSupabaseClient();
        await supabase.from("goals").delete().eq("id", goalId);
      } catch {
        // offline fallback
      }
    }
  }

  async function handleContributeToGoal(e: React.FormEvent) {
    e.preventDefault();
    if (
      !selectedGoalForContribute ||
      !contributeAmount ||
      Number(contributeAmount) <= 0
    )
      return;

    const addAmt = Number(contributeAmount);
    const updated = {
      ...selectedGoalForContribute,
      current_amount:
        Number(selectedGoalForContribute.current_amount || 0) + addAmt,
      updated_at: new Date().toISOString(),
    };

    setUpdatedGoals((prev) => ({
      ...prev,
      [updated.id]: updated,
    }));

    try {
      const supabase = getSupabaseClient();
      await supabase.from("goals").upsert(updated);
    } catch {
      // offline fallback
    }

    setIsContributeModalOpen(false);
    setSelectedGoalForContribute(null);
    setContributeAmount("");
  }

  // Manual Settlement Handler
  async function handleCreateManualSettlement(e: React.FormEvent) {
    e.preventDefault();
    if (
      !settlementForm.from_member_id ||
      !settlementForm.to_member_id ||
      !settlementForm.amount
    )
      return;
    if (settlementForm.from_member_id === settlementForm.to_member_id) {
      alert(
        "A member cannot owe themselves. Please select two different household members.",
      );
      return;
    }

    const fromM = members.find((m) => m.id === settlementForm.from_member_id);
    const toM = members.find((m) => m.id === settlementForm.to_member_id);
    if (!fromM || !toM) return;

    const newSettlement: FamilySettlement = {
      id: crypto.randomUUID(),
      household_id: householdId,
      from_member_id: fromM.id,
      from_member_name: fromM.name,
      to_member_id: toM.id,
      to_member_name: toM.name,
      amount: Number(settlementForm.amount),
      currency: "USD",
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const saved = await saveFamilySettlement(newSettlement);
    setSettlements((prev) => [saved, ...prev]);
    setIsManualSettlementModalOpen(false);
    setSettlementForm({
      from_member_id: "",
      to_member_id: "",
      amount: "",
      notes: "",
    });
  }

  // Export Shared Expenses CSV
  function handleExportCsv() {
    const headers = [
      "Date",
      "Merchant",
      "Category",
      "Amount",
      "Currency",
      "Status",
      "Shared",
    ];
    const rows = householdExpenses.map((tx) => [
      tx.date || tx.timestamp?.split("T")[0] || "",
      `"${tx.merchant.replace(/"/g, '""')}"`,
      tx.category || "General",
      tx.amount,
      tx.currency,
      tx.status,
      "Yes",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `family_household_expenses_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Montally Simplified Navigation */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#121212] tracking-tight">
              Household
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Shared household expenses, bill scheduling, and who owes whom.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onAddTransaction && (
              <Magnetic range={60} intensity={0.35}>
                <WatermelonButton
                  onClick={onAddTransaction}
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  morphText="Add expense"
                />
              </Magnetic>
            )}
          </div>
        </div>

        {/* Primary Mode Navigation Bar: Fixed 4 tabs that fit on screen without scrolling */}
        <nav
          aria-label="Household navigation"
          className="p-1 bg-white border border-[#121212]/20 shadow-sm rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-1 w-full max-w-2xl"
        >
          <AnimatedBackground
            defaultValue={
              activeView === "budgets"
                ? "expenses"
                : activeView === "settlements" || activeView === "goals"
                  ? "members"
                  : activeView
            }
            className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {[
              { id: "overview", label: "Home", icon: House },
              { id: "expenses", label: "Expenses", icon: Receipt },
              {
                id: "bills",
                label: "Bills",
                icon: CalendarDays,
                count: bills.filter((b) => b.status === "unpaid").length,
              },
              {
                id: "members",
                label: "People & settle up",
                icon: UsersRound,
                count: settlements.filter((s) => s.status === "pending").length,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const normalizedActive =
                activeView === "budgets"
                  ? "expenses"
                  : activeView === "settlements" || activeView === "goals"
                    ? "members"
                    : activeView;
              const isActive = normalizedActive === tab.id;
              return (
                <button
                  key={tab.id}
                  data-id={tab.id}
                  type="button"
                  onClick={() => handleViewChange(tab.id as FamilyView)}
                  className={`group inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "text-white font-bold"
                      : "text-[#121212] hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-[#836EF9]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold rounded-full leading-none shrink-0 ${
                        isActive
                          ? "bg-white text-[#121212]"
                          : "bg-[#836EF9]/10 text-[#836EF9] border border-[#836EF9]/30"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </AnimatedBackground>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* 2. HOME (OVERVIEW) SUBVIEW */}
      {/* ========================================================================= */}
      {activeView === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 3-Card Household Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  This month&apos;s spending
                </span>
                <div className="rounded-lg p-1.5 bg-[#fee2e2] text-[#b91c1c]">
                  <HandCoins className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-[#121212] tracking-tight">
                  {currencySymbol}
                  {totalHouseholdSpend.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Combined household expenses
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Bills due soon
                </span>
                <div className="rounded-lg p-1.5 bg-[#fef9c3] text-[#854d0e]">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-[#121212] tracking-tight">
                  {currencySymbol}
                  {unpaidBillsTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {bills.filter((b) => b.status === "unpaid").length} unpaid bills
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Who owes whom
                </span>
                <div className="rounded-lg p-1.5 bg-[#f3f0ff] text-[#836EF9]">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-[#836EF9] tracking-tight">
                  {currencySymbol}
                  {pendingSettlementsTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {settlements.filter((s) => s.status === "pending").length}{" "}
                  balances to settle
                </p>
              </div>
            </div>
          </div>

          {/* Recent Household Expenses List */}
          <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#121212]">
                  Recent expenses
                </h2>
                <p className="text-xs text-slate-500">
                  Latest shared purchases across members
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleViewChange("expenses")}
                className="text-xs font-semibold text-[#836EF9] hover:underline"
              >
                View all expenses →
              </button>
            </div>

            {householdExpenses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                <Receipt className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  No expenses yet. Add your first shared expense.
                </p>
                {onAddTransaction && (
                  <button
                    type="button"
                    onClick={onAddTransaction}
                    className="mt-3 px-3 py-1.5 bg-[#836EF9] text-white text-xs font-medium rounded-lg shadow-[2px_2px_0_0_#121212] border border-[#121212]"
                  >
                    Add expense
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {householdExpenses.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#121212]">
                        {tx.merchant}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{tx.date || tx.timestamp?.split("T")[0]}</span>
                        <span>•</span>
                        <span className="capitalize">{String(tx.category || "General")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[#121212]">
                        -{currencySymbol}
                        {Number(tx.amount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenSplitModal(tx)}
                        className="px-2 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
                      >
                        Split
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PEOPLE & SETTLE UP SUBVIEW (MERGED MEMBERS + SETTLEMENTS + GOALS) */}
      {/* ========================================================================= */}
      {(activeView === "members" || activeView === "settlements" || activeView === "goals") && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#121212]">
                People & settle up
              </h2>
              <p className="text-xs text-slate-500">
                Household members, who owes whom, and balances.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsManualSettlementModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#836EF9]" />
                <span>Record IOU</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212] border border-[#121212] inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add member</span>
              </button>
            </div>
          </div>

          {/* Members List */}
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 p-8 text-center bg-white shadow-sm animate-pulse">
              <UsersRound className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Loading household members...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {members.map((member) => {
                const balanceInfo = memberBalances.find(
                  (b) => b.member.id === member.id,
                );
                return (
                  <div
                    key={member.id}
                    className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full border border-[#121212] flex items-center justify-center text-sm font-bold text-white shadow-sm"
                            style={{
                              backgroundColor: member.avatar_color || "#836EF9",
                            }}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#121212]">
                              {member.name}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {member.email || "Household member"}
                            </p>
                          </div>
                        </div>

                        {member.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member.id)}
                            title="Remove member"
                            className="p-1 rounded text-slate-400 hover:text-[#b91c1c] hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Net balance:
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              (balanceInfo?.net || 0) > 0
                                ? "text-[#15803d]"
                                : (balanceInfo?.net || 0) < 0
                                  ? "text-[#b91c1c]"
                                  : "text-slate-600"
                            }`}
                          >
                            {(balanceInfo?.net || 0) > 0 ? "+" : ""}
                            {currencySymbol}
                            {(balanceInfo?.net || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {(balanceInfo?.net || 0) > 0
                            ? "Is owed by others"
                            : (balanceInfo?.net || 0) < 0
                              ? "Owes household members"
                              : "Even (all settled)"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Role:
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#f3f0ff] text-[#836EF9] border border-[#836EF9]/30 capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settle up balances & IOUs */}
          <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#121212]">
                  Who owes whom
                </h3>
                <p className="text-xs text-slate-500">
                  Shared balances to settle up
                </p>
              </div>
            </div>

            {settlements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                <BadgeCheck className="h-8 w-8 text-[#15803d] mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  All settled up! No outstanding balances.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#f3f0ff] text-[#836EF9]">
                        <ArrowLeftRight className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#121212]">
                          {s.from_member_name} owes {s.to_member_name}
                        </div>
                        <span className="text-xs text-slate-500">
                          {s.status === "settled" ? "Settled" : "Pending settlement"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-base font-bold font-mono text-[#121212]">
                        {currencySymbol}
                        {Number(s.amount).toFixed(2)}
                      </div>
                      {s.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => handleSettleUp(s)}
                          className="px-3 py-1 bg-[#836EF9] text-white text-xs font-medium rounded-lg shadow-[2px_2px_0_0_#121212] border border-[#121212]"
                        >
                          Settle up
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803d]">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          <span>Settled</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSettlement(s.id)}
                        className="p-1 text-slate-400 hover:text-[#b91c1c]"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Family Goals (Only shown if user has goals or wants to add one) */}
          {localGoals.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#121212]">
                    Family savings goals
                  </h3>
                  <p className="text-xs text-slate-500">
                    Shared targets for trips and big purchases
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(true)}
                  className="text-xs font-semibold text-[#836EF9] hover:underline"
                >
                  + Add goal
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localGoals.map((g) => {
                  const target = Number(g.target_amount || 0);
                  const current = Number(g.current_amount || 0);
                  const pct =
                    target > 0
                      ? Math.min(100, Math.round((current / target) * 100))
                      : 0;
                  return (
                    <div
                      key={g.id || g.title}
                      className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-semibold text-[#121212]">
                            {g.title || g.name}
                          </h4>
                          <span className="text-xs font-mono text-slate-500">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1 text-sm font-bold text-[#121212]">
                          <span>{currencySymbol}{current.toLocaleString()}</span>
                          <span className="text-xs font-normal text-slate-500">
                            of {currencySymbol}{target.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mt-2">
                          <div
                            className="h-full bg-[#836EF9] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGoalForContribute(g);
                            setIsContributeModalOpen(true);
                          }}
                          className="text-xs font-semibold text-[#836EF9] hover:underline"
                        >
                          + Contribute
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(g.id)}
                          className="text-slate-400 hover:text-[#b91c1c]"
                          title="Delete goal"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EXPENSES SUBVIEW (SHARED EXPENSES + MONTHLY LIMITS BAR AT TOP) */}
      {/* ========================================================================= */}
      {(activeView === "expenses" || activeView === "budgets") && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#121212]">
                Expenses
              </h2>
              <p className="text-xs text-slate-500">
                Shared household spending and category monthly limits.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
              {onAddTransaction && (
                <button
                  type="button"
                  onClick={onAddTransaction}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212] border border-[#121212] inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add expense</span>
                </button>
              )}
            </div>
          </div>

          {/* Monthly Limits Strip at Top */}
          <div className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#121212]">
                  Monthly limits
                </h3>
                <p className="text-xs text-slate-500">
                  Spending caps per category
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(true)}
                className="text-xs font-semibold text-[#836EF9] hover:underline"
              >
                + Set limit
              </button>
            </div>

            {budgetStatusList.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <p className="text-xs text-slate-600">
                  No monthly limits set yet. Set a spending limit for groceries or utilities.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {budgetStatusList.map((b) => (
                  <div
                    key={b.id || b.displayName}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#121212]">
                        {b.displayName}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          b.isOver
                            ? "bg-red-100 text-red-700"
                            : b.pct > 80
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {b.pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2">
                      <div
                        className={`h-full transition-all ${
                          b.isOver
                            ? "bg-[#b91c1c]"
                            : b.pct > 80
                              ? "bg-[#f59e0b]"
                              : "bg-[#836EF9]"
                        }`}
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] font-mono text-slate-500">
                      <span>{currencySymbol}{b.spent.toFixed(0)}</span>
                      <span>of {currencySymbol}{b.limit.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search shared expenses..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#836EF9] bg-white"
              />
            </div>
            <NeoSelect
              value={expenseCategoryFilter}
              onChange={setExpenseCategoryFilter}
              options={[
                { value: "all", label: "All categories" },
                { value: "groceries", label: "Groceries" },
                { value: "utilities", label: "Utilities" },
                { value: "rent", label: "Rent & housing" },
                { value: "dining", label: "Dining & takeout" },
                { value: "entertainment", label: "Entertainment" },
                { value: "childcare", label: "Childcare" },
              ]}
            />
          </div>

          <div className="bg-white rounded-xl border border-[#121212]/15 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="py-3 px-4 font-semibold text-slate-600">
                      Date
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600">
                      Item / Merchant
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600">
                      Category
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-right">
                      Amount
                    </th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHouseholdExpenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-slate-500"
                      >
                        <Receipt className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="font-medium text-slate-700">
                          No shared expenses found.
                        </p>
                        {onAddTransaction && (
                          <button
                            type="button"
                            onClick={onAddTransaction}
                            className="mt-3 px-3 py-1.5 bg-[#836EF9] text-white text-xs font-medium rounded-lg shadow-[2px_2px_0_0_#121212] border border-[#121212]"
                          >
                            Add expense
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredHouseholdExpenses.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 transition"
                      >
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {tx.date || tx.timestamp?.split("T")[0]}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#121212]">
                          {tx.merchant}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                            {String(tx.category || "General")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#b91c1c] text-right">
                          -{currencySymbol}
                          {Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenSplitModal(tx)}
                            className="px-2 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1"
                          >
                            <ArrowLeftRight className="h-3 w-3 text-[#836EF9]" />
                            <span>Split</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BILLS SUBVIEW */}
      {/* ========================================================================= */}
      {activeView === "bills" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#121212]">
                Bills & utilities
              </h2>
              <p className="text-xs text-slate-500">
                Upcoming and recurring household bills in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBillModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212] border border-[#121212] inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add bill</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <NeoSelect
              value={billCategoryFilter}
              onChange={setBillCategoryFilter}
              options={[
                { value: "all", label: "All categories" },
                { value: "utilities", label: "Utilities" },
                { value: "rent", label: "Rent & housing" },
                { value: "internet", label: "Internet" },
                { value: "streaming", label: "Streaming" },
                { value: "insurance", label: "Insurance" },
              ]}
            />

            <div className="flex items-center gap-1.5">
              {(["all", "unpaid", "paid"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setBillStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors capitalize ${
                    billStatusFilter === st
                      ? "bg-[#836EF9] text-white border-[#121212]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredBills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <CalendarDays className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                No bills yet. Add your first bill.
              </p>
              <button
                type="button"
                onClick={() => setIsBillModalOpen(true)}
                className="mt-3 px-3 py-1.5 bg-[#836EF9] text-white text-xs font-medium rounded-lg shadow-[2px_2px_0_0_#121212] border border-[#121212]"
              >
                Add bill
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="bg-white p-5 rounded-xl border border-[#121212]/15 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#121212]">
                          {bill.name}
                        </h3>
                        <span className="text-xs text-slate-500 capitalize">
                          {bill.frequency} • {bill.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${
                            bill.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {bill.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBill(bill.id)}
                          className="p-1 text-slate-400 hover:text-[#b91c1c]"
                          title="Delete bill"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xl font-bold font-mono text-[#121212]">
                        {currencySymbol}
                        {bill.amount.toFixed(2)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Due: {bill.due_date}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {bill.status === "unpaid" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkBillPaid(bill)}
                        className="w-full px-3 py-1.5 bg-[#836EF9] text-white text-xs font-medium rounded-lg shadow-[2px_2px_0_0_#121212] border border-[#121212]"
                      >
                        Mark paid
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#15803d]">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        <span>Paid by {bill.paid_by_name || "Household"}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MEMBER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMemberModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-[#836EF9]" />
                  Add Household Member
                </h3>
                <button
                  onClick={() => setIsMemberModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMember} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya"
                    value={memberForm.name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="maya@family.internal"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Role
                  </label>
                  <NeoSelect
                    fullWidth
                    value={memberForm.role}
                    onChange={(val) =>
                      setMemberForm({
                        ...memberForm,
                        role: val as "owner" | "member" | "viewer",
                      })
                    }
                    options={[
                      {
                        value: "member",
                        label: "Member (Can log expenses & view balances)",
                      },
                      {
                        value: "owner",
                        label: "Owner (Full budget control & adjustments)",
                      },
                      { value: "viewer", label: "Viewer (Read-only)" },
                    ]}
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMemberModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Add Member</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE BILL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isBillModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#836EF9]" />
                  Schedule Household Bill
                </h3>
                <button
                  onClick={() => setIsBillModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBill} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Bill Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electric & Gas"
                    value={billForm.name}
                    onChange={(e) =>
                      setBillForm({ ...billForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Amount ({currencySymbol}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="150"
                      value={billForm.amount}
                      onChange={(e) =>
                        setBillForm({ ...billForm, amount: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Due Date *
                    </label>
                    <NeoDatePicker
                      fullWidth
                      value={billForm.due_date}
                      onChange={(val) =>
                        setBillForm({ ...billForm, due_date: val })
                      }
                      placeholder="Select Date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Category
                    </label>
                    <NeoSelect
                      fullWidth
                      value={billForm.category}
                      onChange={(val) =>
                        setBillForm({ ...billForm, category: val })
                      }
                      options={[
                        { value: "utilities", label: "Utilities" },
                        { value: "rent", label: "Rent / Housing" },
                        { value: "internet", label: "Internet" },
                        { value: "streaming", label: "Streaming" },
                        { value: "insurance", label: "Insurance" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Frequency
                    </label>
                    <NeoSelect
                      fullWidth
                      value={billForm.frequency}
                      onChange={(val) =>
                        setBillForm({
                          ...billForm,
                          frequency: val as "monthly" | "quarterly" | "yearly",
                        })
                      }
                      options={[
                        { value: "monthly", label: "Monthly" },
                        { value: "quarterly", label: "Quarterly" },
                        { value: "yearly", label: "Yearly" },
                      ]}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBillModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Save Bill</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: INTERACTIVE SPLIT CALCULATOR */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSplitModalOpen && selectedTxForSplit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-lg p-6 bg-white shadow-[6px_6px_0_0_#121212] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-[#836EF9]" />
                  Split Shared Expense
                </h3>
                <button
                  onClick={() => setIsSplitModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Selected Transaction Summary */}
              <div className="mt-4 p-3 rounded-lg border-2 border-[#121212] bg-[#f3f0ff] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Transaction
                  </span>
                  <div className="text-sm font-black text-[#121212]">
                    {selectedTxForSplit.merchant}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {selectedTxForSplit.date ||
                      selectedTxForSplit.timestamp?.split("T")[0]}
                  </div>
                </div>
                <div className="text-xl font-mono font-black text-[#121212]">
                  {currencySymbol}
                  {Number(selectedTxForSplit.amount).toFixed(2)}
                </div>
              </div>

              <form onSubmit={handleConfirmSplit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Who Paid the Bill?
                  </label>
                  <NeoSelect
                    value={splitPayerId}
                    onChange={setSplitPayerId}
                    options={members.map((m) => ({
                      value: m.id,
                      label: `${m.name} (${m.role})`,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Split Methodology
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "equal", label: "Equal Split" },
                      { id: "custom_percentage", label: "Percentage %" },
                      { id: "exact", label: "Exact Amounts" },
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() =>
                          setSplitType(
                            method.id as "equal" | "custom_percentage" | "exact",
                          )
                        }
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 border-[#121212] transition ${
                          splitType === method.id
                            ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                            : "bg-white text-[#121212] hover:bg-slate-100"
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Included Members & Shares
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                    {members.map((m) => {
                      const isChecked = splitSelectedMemberIds.includes(m.id);
                      const isPayer = m.id === splitPayerId;
                      const totalAmt = Number(selectedTxForSplit.amount);
                      const equalShare =
                        splitSelectedMemberIds.length > 0
                          ? (totalAmt / splitSelectedMemberIds.length).toFixed(2)
                          : "0.00";

                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-lg border border-[#121212] bg-[#f9fafb] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSplitSelectedMemberIds([
                                    ...splitSelectedMemberIds,
                                    m.id,
                                  ]);
                                } else {
                                  setSplitSelectedMemberIds(
                                    splitSelectedMemberIds.filter(
                                      (id) => id !== m.id,
                                    ),
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-2 border-[#121212] text-[#836EF9] focus:ring-[#836EF9]"
                            />
                            <span className="text-xs font-bold text-[#121212]">
                              {m.name} {isPayer ? "(Payer)" : ""}
                            </span>
                          </div>

                          {isChecked && (
                            <div>
                              {splitType === "equal" && (
                                <span className="font-mono text-xs font-black text-[#121212]">
                                  {currencySymbol}
                                  {equalShare}
                                </span>
                              )}
                              {splitType === "custom_percentage" && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="50"
                                    value={splitPercentages[m.id] ?? ""}
                                    onChange={(e) =>
                                      setSplitPercentages({
                                        ...splitPercentages,
                                        [m.id]: Number(e.target.value),
                                      })
                                    }
                                    className="w-16 px-1.5 py-0.5 border border-[#121212] rounded text-xs font-mono font-bold text-right"
                                  />
                                  <span className="text-xs font-black">%</span>
                                </div>
                              )}
                              {splitType === "exact" && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-black">
                                    {currencySymbol}
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="25.00"
                                    value={splitAmounts[m.id] ?? ""}
                                    onChange={(e) =>
                                      setSplitAmounts({
                                        ...splitAmounts,
                                        [m.id]: Number(e.target.value),
                                      })
                                    }
                                    className="w-20 px-1.5 py-0.5 border border-[#121212] rounded text-xs font-mono font-bold text-right"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSplitModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Confirm & Record Settlements</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CREATE CATEGORY BUDGET */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isBudgetModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <ChartNoAxesCombined className="h-5 w-5 text-[#836EF9]" />
                  Create Category Budget
                </h3>
                <button
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Budget Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Groceries & Household"
                    value={budgetForm.name}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Monthly Limit ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="800"
                    value={budgetForm.limit}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, limit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Category Tag
                  </label>
                  <NeoSelect
                    value={budgetForm.category}
                    onChange={(val) =>
                      setBudgetForm({ ...budgetForm, category: val })
                    }
                    options={[
                      { value: "Groceries", label: "Groceries & Food" },
                      { value: "Utilities", label: "Utilities & Energy" },
                      { value: "Housing", label: "Housing / Rent" },
                      { value: "Dining", label: "Dining Out" },
                      { value: "Childcare", label: "Childcare & Education" },
                      { value: "Entertainment", label: "Entertainment" },
                    ]}
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBudgetModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Save Budget</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CREATE SAVINGS GOAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#836EF9]" />
                  Create Family Goal
                </h3>
                <button
                  onClick={() => setIsGoalModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Family Trip"
                    value={goalForm.title}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Target Amount ({currencySymbol}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="5000"
                      value={goalForm.target_amount}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          target_amount: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Current Saved ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1000"
                      value={goalForm.current_amount}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          current_amount: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Target Deadline
                  </label>
                  <NeoDatePicker
                    value={goalForm.deadline}
                    onChange={(date) =>
                      setGoalForm({ ...goalForm, deadline: date })
                    }
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsGoalModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Save Goal</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CONTRIBUTE TO GOAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isContributeModalOpen && selectedGoalForContribute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-sm p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#836EF9]" />
                  Contribute Funds
                </h3>
                <button
                  onClick={() => setIsContributeModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleContributeToGoal} className="mt-4 space-y-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    Goal Target
                  </span>
                  <div className="text-sm font-black text-[#121212]">
                    {selectedGoalForContribute.title ||
                      selectedGoalForContribute.name}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Deposit Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="250"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsContributeModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Deposit</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: MANUAL IOU / SETTLEMENT */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isManualSettlementModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-[#836EF9]" />
                  Record Household IOU
                </h3>
                <button
                  onClick={() => setIsManualSettlementModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={handleCreateManualSettlement}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Who Owes? (Debtor) *
                  </label>
                  <NeoSelect
                    fullWidth
                    value={settlementForm.from_member_id}
                    onChange={(val) =>
                      setSettlementForm({
                        ...settlementForm,
                        from_member_id: val,
                      })
                    }
                    placeholder="Select Member"
                    options={members.map((m) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Owed To? (Creditor) *
                  </label>
                  <NeoSelect
                    fullWidth
                    value={settlementForm.to_member_id}
                    onChange={(val) =>
                      setSettlementForm({
                        ...settlementForm,
                        to_member_id: val,
                      })
                    }
                    placeholder="Select Member"
                    options={members.map((m) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="35.00"
                    value={settlementForm.amount}
                    onChange={(e) =>
                      setSettlementForm({
                        ...settlementForm,
                        amount: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsManualSettlementModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Record IOU</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
