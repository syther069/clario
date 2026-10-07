"use client";

import React, { useState, useEffect, useMemo } from "react";
import type {
  Transaction,
  BusinessTeamMember,
  BusinessReimbursement,
  ExpensePolicy,
  BusinessAuditEvent,
  BusinessView,
  BusinessRole,
} from "@/lib/supabase/types";
import {
  Building2,
  UsersRound,
  Receipt,
  Plus,
  Download,
  Search,
  X,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/motion/animated-background";
import { Magnetic } from "@/components/ui/motion/magnetic";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { motion, AnimatePresence } from "motion/react";
import {
  getBusinessTeam,
  saveBusinessTeamMember,
  deleteBusinessTeamMember,
  getBusinessReimbursements,
  saveBusinessReimbursement,
  deleteBusinessReimbursement,
  updateReimbursementStatus,
  getExpensePolicies,
  saveExpensePolicy,
  deleteExpensePolicy,
  getBusinessAuditEvents,
  recordBusinessAuditEvent,
} from "@/lib/modes/mode-storage";
import { NeoSelect } from "@/components/ui/neo-select";

interface BusinessDashboardProps {
  transactions: Transaction[];
  activeView?: BusinessView | undefined;
  onViewChange?: ((view: BusinessView) => void) | undefined;
  onAddTransaction?: (() => void) | undefined;
  onUploadReceipt?: (() => void) | undefined;
  onUpdateTransaction?: ((tx: Partial<Transaction>) => void) | undefined;
  userId?: string | undefined;
  userAddress?: string | null | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
  currencySymbol?: string | undefined;
}

export function BusinessDashboard({
  transactions = [],
  activeView: propActiveView,
  onViewChange,
  onAddTransaction,
  userId = "demo_corp",
  currencySymbol = "$",
}: BusinessDashboardProps) {
  const orgId = `org_${userId}`;

  // Normalize incoming activeView to the 4 core tabs
  const [internalTab, setInternalTab] = useState<
    "overview" | "expenses" | "team" | "audit"
  >("overview");

  const currentTab = useMemo<"overview" | "expenses" | "team" | "audit">(() => {
    const raw = propActiveView || internalTab;
    if (raw === "team" || raw === "policies") return "team";
    if (
      raw === "expenses" ||
      raw === "reimbursements" ||
      raw === "approvals" ||
      raw === "reports"
    ) {
      return "expenses";
    }
    if (raw === "audit") return "audit";
    return "overview";
  }, [propActiveView, internalTab]);

  const handleTabChange = (tab: "overview" | "expenses" | "team" | "audit") => {
    if (onViewChange) {
      onViewChange(tab as BusinessView);
    }
    setInternalTab(tab);
  };

  const [team, setTeam] = useState<BusinessTeamMember[]>([]);
  const [claims, setClaims] = useState<BusinessReimbursement[]>([]);
  const [policies, setPolicies] = useState<ExpensePolicy[]>([]);
  const [auditEvents, setAuditEvents] = useState<BusinessAuditEvent[]>([]);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedClaimForReview, setSelectedClaimForReview] =
    useState<BusinessReimbursement | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Filters state
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<
    "all" | "waiting" | "approved" | "paid"
  >("all");
  const [expenseDeptFilter, setExpenseDeptFilter] = useState("all");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamDeptFilter, setTeamDeptFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Forms
  const [inviteForm, setInviteForm] = useState(() => ({
    name: "",
    email: "",
    role: "employee" as BusinessRole,
    department: "Engineering",
    spending_limit_monthly: "2500",
  }));

  const [claimForm, setClaimForm] = useState(() => ({
    title: "",
    employee_name: "",
    amount: "",
    category: "Software",
    department: "Engineering",
    notes: "",
  }));

  const [policyForm, setPolicyForm] = useState(() => ({
    name: "",
    category: "Software",
    max_single_amount: "500",
    monthly_budget: "5000",
    requires_receipt_above: "25",
    requires_approval_above: "200",
  }));

  // Load data
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [loadedTeam, loadedClaims, loadedPolicies, loadedAudit] =
          await Promise.all([
            getBusinessTeam(orgId),
            getBusinessReimbursements(orgId),
            getExpensePolicies(orgId),
            getBusinessAuditEvents(orgId),
          ]);
        if (!ignore) {
          setTeam(loadedTeam);
          setClaims(loadedClaims);
          setPolicies(loadedPolicies);
          setAuditEvents(loadedAudit);
        }
      } catch (err) {
        console.error("Failed to load business mode data:", err);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [orgId]);

  // Calculations
  const businessExpenses = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.mode === "business" ||
        t.source === "onchain_monad" ||
        Boolean(t.department),
    );
  }, [transactions]);

  const totalMonthlySpend = useMemo(() => {
    return businessExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [businessExpenses]);

  const pendingClaims = useMemo(() => {
    return claims.filter(
      (c) => c.status === "submitted" || c.status === "under_review",
    );
  }, [claims]);

  const pendingClaimsTotal = useMemo(() => {
    return pendingClaims.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [pendingClaims]);

  const paidClaimsTotal = useMemo(() => {
    return claims
      .filter((c) => c.status === "paid" || c.status === "approved")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [claims]);

  // Combined Unified Expenses List (merging Corporate Expenses & Claims)
  const unifiedExpenses = useMemo(() => {
    interface UnifiedItem {
      id: string;
      kind: "claim" | "expense";
      date: string;
      title: string;
      department: string;
      category: string;
      amount: number;
      status: "waiting" | "approved" | "paid" | "rejected";
      rawClaim?: BusinessReimbursement;
      rawTx?: Transaction;
    }

    const items: UnifiedItem[] = [];

    // Add claims
    claims.forEach((c) => {
      let status: "waiting" | "approved" | "paid" | "rejected" = "waiting";
      if (c.status === "approved") status = "approved";
      else if (c.status === "paid") status = "paid";
      else if (c.status === "rejected") status = "rejected";

      items.push({
        id: `claim_${c.id}`,
        kind: "claim",
        date: c.expense_date,
        title: c.title,
        department: c.department || "General",
        category: c.category || "General",
        amount: Number(c.amount || 0),
        status,
        rawClaim: c,
      });
    });

    // Add business expenses
    businessExpenses.forEach((t) => {
      const status: "waiting" | "approved" | "paid" | "rejected" =
        t.status === "pending" ? "waiting" : "paid";
      items.push({
        id: `tx_${t.id}`,
        kind: "expense",
        date: t.date || t.timestamp?.split("T")[0] || "",
        title: t.merchant || t.description || "Corporate expense",
        department: t.department || "General",
        category:
          typeof t.category === "string"
            ? t.category
            : t.category?.name || "General",
        amount: Number(t.amount || 0),
        status,
        rawTx: t,
      });
    });

    // Sort by date descending
    return items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [claims, businessExpenses]);

  // Filtered Unified Expenses
  const filteredUnifiedExpenses = useMemo(() => {
    return unifiedExpenses.filter((item) => {
      const matchSearch =
        !expenseSearch ||
        item.title.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        item.department.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(expenseSearch.toLowerCase());

      const matchDept =
        expenseDeptFilter === "all" || item.department === expenseDeptFilter;

      const matchStatus =
        expenseStatusFilter === "all" || item.status === expenseStatusFilter;

      return matchSearch && matchDept && matchStatus;
    });
  }, [unifiedExpenses, expenseSearch, expenseDeptFilter, expenseStatusFilter]);

  // Handlers
  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;

    const newMember: BusinessTeamMember = {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      department: inviteForm.department,
      spending_limit_monthly: Number(inviteForm.spending_limit_monthly) || 1000,
      created_at: new Date().toISOString(),
    };

    const saved = await saveBusinessTeamMember(newMember);
    setTeam((prev) => [...prev, saved]);
    setIsInviteModalOpen(false);

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: "Admin",
      action: "TEAM_MEMBER_INVITED",
      entity_type: "team_member",
      entity_id: saved.id,
      details: `Invited ${saved.name} (${saved.email}) to ${saved.department} with ${currencySymbol}${saved.spending_limit_monthly}/month limit`,
      severity: "info",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);

    setInviteForm({
      name: "",
      email: "",
      role: "employee",
      department: "Engineering",
      spending_limit_monthly: "2500",
    });
  }

  async function handleDeleteMember(memberId: string) {
    const target = team.find((m) => m.id === memberId);
    if (!target) return;
    if (confirm(`Remove ${target.name} from the team?`)) {
      await deleteBusinessTeamMember(memberId);
      setTeam((prev) => prev.filter((m) => m.id !== memberId));

      const audit: BusinessAuditEvent = {
        id: crypto.randomUUID(),
        org_id: orgId,
        actor_name: "Admin",
        action: "TEAM_MEMBER_REMOVED",
        entity_type: "team_member",
        entity_id: memberId,
        details: `Removed team member ${target.name} (${target.department})`,
        severity: "warning",
        timestamp: new Date().toISOString(),
      };
      await recordBusinessAuditEvent(audit);
      setAuditEvents((prev) => [audit, ...prev]);
    }
  }

  async function handleSubmitClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimForm.title.trim() || !claimForm.amount) return;

    const newClaim: BusinessReimbursement = {
      id: crypto.randomUUID(),
      org_id: orgId,
      employee_id: userId,
      employee_name:
        claimForm.employee_name.trim() || team[0]?.name || "Team member",
      title: claimForm.title.trim(),
      amount: Number(claimForm.amount),
      currency: "USD",
      category: claimForm.category,
      department: claimForm.department,
      expense_date: new Date().toISOString().split("T")[0]!,
      status: "submitted",
      notes: claimForm.notes.trim() || null,
      created_at: new Date().toISOString(),
    };

    const saved = await saveBusinessReimbursement(newClaim);
    setClaims((prev) => [saved, ...prev]);
    setIsClaimModalOpen(false);

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: newClaim.employee_name,
      action: "REIMBURSEMENT_SUBMITTED",
      entity_type: "reimbursement",
      entity_id: saved.id,
      details: `Submitted reimbursement for ${currencySymbol}${Number(newClaim.amount).toFixed(2)} (${newClaim.title}) in ${newClaim.department}`,
      severity: "info",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);

    setClaimForm({
      title: "",
      employee_name: "",
      amount: "",
      category: "Software",
      department: "Engineering",
      notes: "",
    });
  }

  async function handleDeleteClaim(claimId: string) {
    const target = claims.find((c) => c.id === claimId);
    if (!target) return;
    if (confirm(`Delete claim "${target.title}"?`)) {
      await deleteBusinessReimbursement(claimId);
      setClaims((prev) => prev.filter((c) => c.id !== claimId));

      const audit: BusinessAuditEvent = {
        id: crypto.randomUUID(),
        org_id: orgId,
        actor_name: "Admin",
        action: "REIMBURSEMENT_DELETED",
        entity_type: "reimbursement",
        entity_id: claimId,
        details: `Deleted claim "${target.title}" for ${currencySymbol}${target.amount}`,
        severity: "warning",
        timestamp: new Date().toISOString(),
      };
      await recordBusinessAuditEvent(audit);
      setAuditEvents((prev) => [audit, ...prev]);
    }
  }

  async function handleApproveClaim(
    claim: BusinessReimbursement,
    note?: string,
  ) {
    const finalNote = note || "Approved";
    await updateReimbursementStatus(
      claim.id,
      "approved",
      "Finance Manager",
      finalNote,
    );
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claim.id
          ? {
              ...c,
              status: "approved",
              approved_at: new Date().toISOString(),
              reviewed_by: "Finance Manager",
              review_notes: finalNote,
            }
          : c,
      ),
    );

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: "Finance Manager",
      action: "REIMBURSEMENT_APPROVED",
      entity_type: "reimbursement",
      entity_id: claim.id,
      details: `Approved reimbursement for ${currencySymbol}${claim.amount} to ${claim.employee_name}`,
      severity: "info",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);
    setSelectedClaimForReview(null);
  }

  async function handleRejectClaim(claim: BusinessReimbursement, note?: string) {
    const finalNote = note || "Declined";
    await updateReimbursementStatus(
      claim.id,
      "rejected",
      "Finance Manager",
      finalNote,
    );
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claim.id
          ? {
              ...c,
              status: "rejected",
              reviewed_by: "Finance Manager",
              review_notes: finalNote,
            }
          : c,
      ),
    );

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: "Finance Manager",
      action: "REIMBURSEMENT_REJECTED",
      entity_type: "reimbursement",
      entity_id: claim.id,
      details: `Rejected reimbursement for ${currencySymbol}${claim.amount} from ${claim.employee_name}`,
      severity: "warning",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);
    setSelectedClaimForReview(null);
  }

  async function handlePayClaim(claim: BusinessReimbursement) {
    const mockTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")}`;

    await updateReimbursementStatus(
      claim.id,
      "paid",
      "Treasury Manager",
      "Reimbursed via Monad Testnet",
      mockTxHash,
    );
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claim.id
          ? {
              ...c,
              status: "paid",
              paid_at: new Date().toISOString(),
              monad_tx_hash: mockTxHash,
              reviewed_by: "Treasury Manager",
            }
          : c,
      ),
    );

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: "Treasury Manager",
      action: "REIMBURSEMENT_PAID",
      entity_type: "reimbursement",
      entity_id: claim.id,
      details: `Paid ${currencySymbol}${claim.amount} to ${claim.employee_name} (${mockTxHash.slice(0, 10)}...)`,
      severity: "info",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);
    setSelectedClaimForReview(null);
  }

  async function handleCreatePolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!policyForm.name.trim()) return;

    const newPolicy: ExpensePolicy = {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: policyForm.name.trim(),
      category: policyForm.category,
      max_single_amount: Number(policyForm.max_single_amount) || 500,
      monthly_budget: Number(policyForm.monthly_budget) || 5000,
      requires_receipt_above: Number(policyForm.requires_receipt_above) || 25,
      requires_approval_above:
        Number(policyForm.requires_approval_above) || 200,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const saved = await saveExpensePolicy(newPolicy);
    setPolicies((prev) => [...prev, saved]);
    setIsPolicyModalOpen(false);

    const audit: BusinessAuditEvent = {
      id: crypto.randomUUID(),
      org_id: orgId,
      actor_name: "Admin",
      action: "POLICY_CREATED",
      entity_type: "expense_policy",
      entity_id: saved.id,
      details: `Created limit policy "${saved.name}" for ${saved.category}`,
      severity: "info",
      timestamp: new Date().toISOString(),
    };
    await recordBusinessAuditEvent(audit);
    setAuditEvents((prev) => [audit, ...prev]);
  }

  async function handleDeletePolicy(policyId: string) {
    const target = policies.find((p) => p.id === policyId);
    if (!target) return;
    if (confirm(`Delete policy "${target.name}"?`)) {
      await deleteExpensePolicy(policyId);
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    }
  }

  function exportExpensesCSV() {
    if (unifiedExpenses.length === 0) {
      alert("No expenses to export.");
      return;
    }
    const headers = [
      "Date",
      "Title",
      "Department",
      "Category",
      "Amount",
      "Status",
    ];
    const rows = unifiedExpenses.map((t) => [
      t.date,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      t.department,
      t.category,
      t.amount,
      t.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportAuditCSV() {
    if (auditEvents.length === 0) {
      alert("No activity logs to export.");
      return;
    }
    const headers = ["Timestamp", "Actor", "Action", "Details"];
    const rows = auditEvents.map((evt) => [
      evt.timestamp,
      `"${(evt.actor_name || "").replace(/"/g, '""')}"`,
      evt.action,
      `"${(evt.details || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const BUSINESS_TABS: {
    id: "overview" | "expenses" | "team" | "audit";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number | undefined;
  }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    {
      id: "expenses",
      label: "Expenses",
      icon: Receipt,
      count: pendingClaims.length > 0 ? pendingClaims.length : undefined,
    },
    { id: "team", label: "Team", icon: UsersRound },
    { id: "audit", label: "Activity", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header with single primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#121212]">
            Business
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Departmental spending, approvals, and team reimbursement tracking.
          </p>
        </div>

        <div>
          <Magnetic range={60} intensity={0.35}>
            <WatermelonButton
              variant="primary"
              textMorph
              onClick={() => {
                if (onAddTransaction) {
                  onAddTransaction();
                } else {
                  setIsClaimModalOpen(true);
                }
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Submit expense
            </WatermelonButton>
          </Magnetic>
        </div>
      </div>

      {/* 2. Fixed 4-Tab Navigation (No horizontal scrolling) */}
      <nav
        aria-label="Business Navigation"
        className="p-1 bg-white border border-[#121212]/15 shadow-sm rounded-xl grid grid-cols-4 w-full gap-1"
      >
        <AnimatedBackground
          defaultValue={currentTab}
          className="rounded-lg bg-[#836EF9] border border-[#121212] shadow-[2px_2px_0_0_#121212]"
          transition={{
            type: "spring",
            bounce: 0.15,
            duration: 0.3,
          }}
          onValueChange={(id) => {
            if (id)
              handleTabChange(id as "overview" | "expenses" | "team" | "audit");
          }}
        >
          {BUSINESS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                data-id={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`group flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center ${
                  isActive ? "text-white" : "text-[#121212] hover:bg-slate-100/60"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-[#836EF9]"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold rounded-full leading-none shrink-0 ${
                      isActive
                        ? "bg-white text-[#121212]"
                        : "bg-[#836EF9] text-white"
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

      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB: Exactly 4 stat cards & Needs your attention */}
      {/* ========================================================================= */}
      {currentTab === "overview" && (
        <div className="space-y-6">
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Spent this month
              </span>
              <div className="text-2xl font-bold font-mono text-[#121212] mt-1">
                {currencySymbol}
                {totalMonthlySpend.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Cleared expenses
              </p>
            </div>

            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Waiting for approval
              </span>
              <div className="text-2xl font-bold font-mono text-[#854d0e] mt-1">
                {currencySymbol}
                {pendingClaimsTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {pendingClaims.length} awaiting review
              </p>
            </div>

            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Paid out this year
              </span>
              <div className="text-2xl font-bold font-mono text-[#15803d] mt-1">
                {currencySymbol}
                {paidClaimsTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Approved & paid claims
              </p>
            </div>

            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Team size
              </span>
              <div className="text-2xl font-bold font-mono text-[#836EF9] mt-1">
                {team.length}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Active members
              </p>
            </div>
          </div>

          {/* Needs Your Attention (Pending approvals only) */}
          <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#121212]">
                  Needs your attention
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pending reimbursement claims awaiting manager review.
                </p>
              </div>
              {pendingClaims.length > 0 && (
                <span className="text-xs font-mono font-bold text-[#836EF9] bg-[#f3f0ff] px-2.5 py-0.5 rounded-full border border-[#836EF9]/20">
                  {pendingClaims.length} waiting
                </span>
              )}
            </div>

            {pendingClaims.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                No expenses waiting for approval. You&apos;re all caught up.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition bg-white"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#121212]">
                          {claim.title}
                        </span>
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {claim.department}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {claim.employee_name} • {claim.expense_date}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="font-mono font-bold text-sm text-[#121212] mr-2">
                        {currencySymbol}
                        {Number(claim.amount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedClaimForReview(claim)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#121212]/30 hover:bg-slate-100"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveClaim(claim)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectClaim(claim)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      >
                        Reject
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
      {/* 2. EXPENSES TAB: Merged Corporate Expenses & Reimbursements */}
      {/* ========================================================================= */}
      {currentTab === "expenses" && (
        <div className="space-y-5">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "waiting", label: "Waiting" },
                  { id: "approved", label: "Approved" },
                  { id: "paid", label: "Paid" },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  onClick={() => setExpenseStatusFilter(st.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    expenseStatusFilter === st.id
                      ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Secondary actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#121212]/30 hover:bg-slate-100 bg-white"
              >
                Submit reimbursement
              </button>
              <button
                type="button"
                onClick={exportExpensesCSV}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#121212]/30 hover:bg-slate-100 bg-white flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Search & Department Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses by title or category..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9] bg-white"
              />
            </div>
            <NeoSelect
              value={expenseDeptFilter}
              onChange={setExpenseDeptFilter}
              options={[
                { value: "all", label: "All Departments" },
                { value: "Engineering", label: "Engineering" },
                { value: "Marketing", label: "Marketing" },
                { value: "Operations", label: "Operations" },
                { value: "Sales", label: "Sales" },
                { value: "Finance", label: "Finance" },
                { value: "Executive", label: "Executive" },
              ]}
            />
          </div>

          {/* Unified Expenses Table */}
          {filteredUnifiedExpenses.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center bg-white">
              <p className="text-xs text-slate-600">
                No expenses found matching the selected filter.
              </p>
            </div>
          ) : (
            <div className="border border-[#121212]/15 shadow-sm rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Date
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Description
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Department
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Category
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-right">
                        Amount
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-center">
                        Status
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUnifiedExpenses.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 transition"
                      >
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#121212]">
                          {item.title}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.department}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.category}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#121212] text-right whitespace-nowrap">
                          {currencySymbol}
                          {item.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              item.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.status === "approved"
                                  ? "bg-[#f3f0ff] text-[#836EF9] border-[#836EF9]/30"
                                  : item.status === "rejected"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {item.status === "waiting"
                              ? "Waiting"
                              : item.status === "approved"
                                ? "Approved"
                                : item.status === "paid"
                                  ? "Paid"
                                  : "Rejected"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === "waiting" && item.rawClaim && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApproveClaim(item.rawClaim!)
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212] hover:bg-[#7257f8]"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRejectClaim(item.rawClaim!)
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {item.status === "approved" && item.rawClaim && (
                              <button
                                type="button"
                                onClick={() => handlePayClaim(item.rawClaim!)}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                Pay now
                              </button>
                            )}

                            {item.rawClaim && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteClaim(item.rawClaim!.id)
                                }
                                title="Delete"
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TEAM TAB: Members & Spending Limits Combined */}
      {/* ========================================================================= */}
      {currentTab === "team" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#121212]">
                Team members
              </h2>
              <p className="text-xs text-slate-500">
                Manage roles and monthly spending limits in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UsersRound className="h-4 w-4" />
              <span>Invite member</span>
            </button>
          </div>

          {/* Search & Department filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search team by name or email..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9] bg-white"
              />
            </div>
            <NeoSelect
              value={teamDeptFilter}
              onChange={setTeamDeptFilter}
              options={[
                { value: "all", label: "All Departments" },
                { value: "Engineering", label: "Engineering" },
                { value: "Marketing", label: "Marketing" },
                { value: "Operations", label: "Operations" },
                { value: "Sales", label: "Sales" },
                { value: "Finance", label: "Finance" },
                { value: "Executive", label: "Executive" },
              ]}
            />
          </div>

          {/* Team Table */}
          {team.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center bg-white">
              <p className="text-xs text-slate-600">
                No team members yet. Invite your first colleague.
              </p>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#121212]/30 hover:bg-slate-100"
              >
                Invite member
              </button>
            </div>
          ) : (
            <div className="border border-[#121212]/15 shadow-sm rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Name
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Email
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Department
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600">
                        Role
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-right">
                        Monthly limit
                      </th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {team
                      .filter((m) => {
                        const q = teamSearch.toLowerCase();
                        const matchQ =
                          !q ||
                          m.name.toLowerCase().includes(q) ||
                          m.email.toLowerCase().includes(q);
                        const matchD =
                          teamDeptFilter === "all" ||
                          m.department === teamDeptFilter;
                        return matchQ && matchD;
                      })
                      .map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/70 transition"
                        >
                          <td className="py-3 px-4 font-semibold text-[#121212]">
                            {member.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {member.email}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {member.department}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#121212] text-right whitespace-nowrap">
                            {currencySymbol}
                            {Number(
                              member.spending_limit_monthly || 0,
                            ).toLocaleString()}{" "}
                            / mo
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(member.id)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Optional Category Limits Reference */}
          {policies.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700">
                    Category spending limits
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Thresholds for automated policy validation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(true)}
                  className="text-xs font-semibold text-[#836EF9] hover:underline"
                >
                  + Add limit
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {policies.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Max {currencySymbol}
                        {p.max_single_amount} per expense
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePolicy(p.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ACTIVITY TAB: Plain Timeline */}
      {/* ========================================================================= */}
      {currentTab === "audit" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#121212]">
                Activity
              </h2>
              <p className="text-xs text-slate-500">
                A plain timeline of who did what and when.
              </p>
            </div>

            <button
              type="button"
              onClick={exportAuditCSV}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#121212]/30 hover:bg-slate-100 bg-white flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity by person or action..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9] bg-white"
            />
          </div>

          {auditEvents.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center bg-white">
              <p className="text-xs text-slate-600">
                No activity recorded yet.
              </p>
            </div>
          ) : (
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-4 bg-white divide-y divide-slate-100">
              {auditEvents
                .filter((evt) => {
                  const q = auditSearch.toLowerCase();
                  return (
                    !q ||
                    evt.details.toLowerCase().includes(q) ||
                    evt.actor_name.toLowerCase().includes(q) ||
                    evt.action.toLowerCase().includes(q)
                  );
                })
                .map((evt) => {
                  const isExpanded = expandedAuditId === evt.id;
                  const readableAction = evt.action
                    .toLowerCase()
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                  return (
                    <div key={evt.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-[#121212]">
                            {readableAction}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {evt.details}
                          </p>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{evt.actor_name}</span>
                            <span>•</span>
                            <span className="font-mono">
                              {new Date(evt.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAuditId(isExpanded ? null : evt.id)
                          }
                          className="text-[11px] font-semibold text-[#836EF9] hover:underline flex items-center gap-0.5 shrink-0"
                        >
                          <span>{isExpanded ? "Hide proof" : "Proof"}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 break-all space-y-1">
                          <div>
                            <span className="text-slate-400">Event ID:</span>{" "}
                            {evt.id}
                          </div>
                          {evt.entity_id && (
                            <div>
                              <span className="text-slate-400">Entity:</span>{" "}
                              {evt.entity_id}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INVITE TEAM MEMBER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md p-6 bg-white border border-[#121212]/20 shadow-xl rounded-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-[#121212]">
                  Invite team member
                </h3>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleInviteMember} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Miller"
                    value={inviteForm.name}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="david@company.com"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department
                    </label>
                    <NeoSelect
                      value={inviteForm.department}
                      onChange={(val) =>
                        setInviteForm({ ...inviteForm, department: val })
                      }
                      options={[
                        { value: "Engineering", label: "Engineering" },
                        { value: "Marketing", label: "Marketing" },
                        { value: "Operations", label: "Operations" },
                        { value: "Sales", label: "Sales" },
                        { value: "Finance", label: "Finance" },
                        { value: "Executive", label: "Executive" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Role
                    </label>
                    <NeoSelect
                      value={inviteForm.role}
                      onChange={(val) =>
                        setInviteForm({
                          ...inviteForm,
                          role: val as BusinessRole,
                        })
                      }
                      options={[
                        { value: "owner", label: "Owner" },
                        { value: "admin", label: "Admin" },
                        { value: "manager", label: "Manager" },
                        { value: "member", label: "Member" },
                        { value: "auditor", label: "Auditor" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly spending limit ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    placeholder="2500"
                    value={inviteForm.spending_limit_monthly}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        spending_limit_monthly: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8]"
                  >
                    Send invitation
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT REIMBURSEMENT CLAIM */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isClaimModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsClaimModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md p-6 bg-white border border-[#121212]/20 shadow-xl rounded-xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-[#121212]">
                  Submit reimbursement
                </h3>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitClaim} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS Cloud Services"
                    value={claimForm.title}
                    onChange={(e) =>
                      setClaimForm({ ...claimForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. David Miller"
                    value={claimForm.employee_name}
                    onChange={(e) =>
                      setClaimForm({
                        ...claimForm,
                        employee_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="120.00"
                      value={claimForm.amount}
                      onChange={(e) =>
                        setClaimForm({ ...claimForm, amount: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <NeoSelect
                      value={claimForm.category}
                      onChange={(val) =>
                        setClaimForm({ ...claimForm, category: val })
                      }
                      options={[
                        { value: "Software", label: "Software & SaaS" },
                        { value: "Travel", label: "Travel & Lodging" },
                        { value: "Equipment", label: "Hardware" },
                        { value: "Meals", label: "Client Meals" },
                        { value: "Office", label: "Office Supplies" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <NeoSelect
                    value={claimForm.department}
                    onChange={(val) =>
                      setClaimForm({ ...claimForm, department: val })
                    }
                    options={[
                      { value: "Engineering", label: "Engineering" },
                      { value: "Marketing", label: "Marketing" },
                      { value: "Operations", label: "Operations" },
                      { value: "Sales", label: "Sales" },
                      { value: "Finance", label: "Finance" },
                      { value: "Executive", label: "Executive" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description..."
                    value={claimForm.notes}
                    onChange={(e) =>
                      setClaimForm({ ...claimForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8]"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CLAIM REVIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedClaimForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedClaimForReview(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-lg p-6 bg-white border border-[#121212]/20 shadow-xl rounded-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-[#121212]">
                  Review reimbursement
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedClaimForReview(null)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#121212]">
                    {selectedClaimForReview.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedClaimForReview.employee_name} •{" "}
                    {selectedClaimForReview.department}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-[#121212]">
                    {currencySymbol}
                    {Number(selectedClaimForReview.amount).toFixed(2)}
                  </div>
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize">
                    {selectedClaimForReview.status}
                  </span>
                </div>
              </div>

              {selectedClaimForReview.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  {selectedClaimForReview.notes}
                </div>
              )}

              {selectedClaimForReview.status === "submitted" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval note
                  </label>
                  <input
                    type="text"
                    placeholder="Optional note for records"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaimForReview(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100"
                >
                  Close
                </button>

                {selectedClaimForReview.status === "submitted" && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleRejectClaim(selectedClaimForReview, reviewNote)
                      }
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleApproveClaim(selectedClaimForReview, reviewNote)
                      }
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8]"
                    >
                      Approve
                    </button>
                  </>
                )}

                {selectedClaimForReview.status === "approved" && (
                  <button
                    type="button"
                    onClick={() => handlePayClaim(selectedClaimForReview)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Pay now
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: DEFINE EXPENSE POLICY */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsPolicyModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md p-6 bg-white border border-[#121212]/20 shadow-xl rounded-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-[#121212]">
                  Add spending limit
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePolicy} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Limit name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Travel & Flight Policy"
                    value={policyForm.name}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <NeoSelect
                      value={policyForm.category}
                      onChange={(val) =>
                        setPolicyForm({ ...policyForm, category: val })
                      }
                      options={[
                        { value: "Software", label: "Software" },
                        { value: "Travel", label: "Travel" },
                        { value: "Equipment", label: "Equipment" },
                        { value: "Meals", label: "Meals" },
                        { value: "Office", label: "Office" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max per expense ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      value={policyForm.max_single_amount}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          max_single_amount: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8]"
                  >
                    Save limit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
