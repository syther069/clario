"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModeHeader } from "@/components/layout/mode-header";
import {
  PieChart,
  Target,
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Layers,
} from "lucide-react";
import type {
  PlatformMode,
  Budget,
  FinancialGoal,
  Transaction,
} from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import { AnimatedBackground } from "@/components/ui/motion/animated-background";
import { Magnetic } from "@/components/ui/motion/magnetic";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { NeoSelect } from "@/components/ui/neo-select";
import { motion, AnimatePresence } from "motion/react";

export default function BudgetsPage() {
  const router = useRouter();
  const { user, connectedEvmAddress } = useClarioAuth();
  const effectiveUserId = connectedEvmAddress || user?.id || "demo_user";
  const userId = effectiveUserId;
  const [activeMode, setActiveMode] = useState<PlatformMode>("personal");
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [catName, setCatName] = useState("software_tools");
  const [catLimit, setCatLimit] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");

  // Load real data from Supabase scoped to current user/wallet
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient(effectiveUserId);
        const userFilters = [`user_id.eq.${effectiveUserId}`];
        if (user?.id && user.id !== effectiveUserId) {
          userFilters.push(`user_id.eq.${user.id}`);
        }
        if (connectedEvmAddress && connectedEvmAddress !== effectiveUserId) {
          userFilters.push(`user_id.eq.${connectedEvmAddress}`);
        }
        const filterStr = userFilters.join(",");

        const [{ data: budData }, { data: goalData }, { data: txData }] =
          await Promise.all([
            supabase.from("budgets").select("*").or(filterStr),
            supabase.from("financial_goals").select("*").or(filterStr),
            supabase.from("transactions").select("*").or(filterStr),
          ]);

        if (!ignore) {
          if (budData) setBudgets(budData as Budget[]);
          if (goalData) setGoals(goalData as FinancialGoal[]);
          if (txData) setTransactions(txData as Transaction[]);
        }
      } catch (err) {
        console.warn("Failed to load budgets and goals:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [effectiveUserId, user?.id, connectedEvmAddress]);

  // Calculate actual spent per category from live transactions for current month
  const categorySpentMap = new Map<string, number>();
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const txDate = tx.date || tx.timestamp;
    if (!txDate || !txDate.startsWith(currentMonthStr)) continue;
    const rawCat =
      typeof tx.category === "object" && tx.category !== null
        ? tx.category.slug
        : tx.category_id ||
          (typeof tx.category === "string" ? tx.category : "other");
    const cat = (rawCat || "other").toLowerCase();
    const curr = categorySpentMap.get(cat) || 0;
    categorySpentMap.set(cat, curr + Math.abs(Number(tx.amount || 0)));
  }

  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!catLimit) return;

    const newB: Budget = {
      id: crypto.randomUUID(),
      user_id: userId,
      category_id: catName,
      amount_limit: parseFloat(catLimit),
      spent_amount: categorySpentMap.get(catName) || 0,
      period: "monthly",
      created_at: new Date().toISOString(),
    };

    setBudgets((prev) => [...prev, newB]);
    setBudgetModalOpen(false);
    setCatLimit("");

    try {
      const supabase = getSupabaseClient();
      await supabase.from("budgets").upsert(newB);
    } catch (err) {
      console.warn("Failed to persist budget:", err);
    }
  }

  async function handleDeleteBudget(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    try {
      const supabase = getSupabaseClient();
      await supabase.from("budgets").delete().eq("id", id);
    } catch (err) {
      console.warn("Failed to delete budget:", err);
    }
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalName || !goalTarget) return;

    const targetVal = parseFloat(goalTarget);
    const currVal = parseFloat(goalCurrent || "0");

    const newG: FinancialGoal = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: goalName,
      name: goalName,
      target_amount: targetVal,
      current_amount: currVal,
      currency: "USD",
      deadline: "2026-12-31",
      target_date: "2026-12-31",
      is_completed: currVal >= targetVal,
      status: currVal >= targetVal ? "reached" : "in_progress",
      created_at: new Date().toISOString(),
    };

    setGoals((prev) => [...prev, newG]);
    setGoalModalOpen(false);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("");

    try {
      const supabase = getSupabaseClient();
      await supabase.from("financial_goals").upsert(newG);
    } catch (err) {
      console.warn("Failed to persist goal:", err);
    }
  }

  async function handleDeleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const supabase = getSupabaseClient();
      await supabase.from("financial_goals").delete().eq("id", id);
    } catch (err) {
      console.warn("Failed to delete goal:", err);
    }
  }

  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page-Level Header: Mode Selector */}
        <ModeHeader
          currentMode={activeMode}
          onModeChange={(m) => {
            setActiveMode(m);
            router.push(`/?mode=${m}`);
          }}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#121212] flex items-center gap-2.5">
              <PieChart className="h-7 w-7 text-[#836EF9]" />
              Category Budgets
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Real-time spend tracking grounded in your verified transactions.
            </p>
          </div>

          <Magnetic range={60} intensity={0.35}>
            <WatermelonButton
              onClick={() => setBudgetModalOpen(true)}
              variant="primary"
              textMorph
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Budget
            </WatermelonButton>
          </Magnetic>
        </div>

        {/* Primary Mode Navigation Bar */}
        <nav
          aria-label="Budgets Primary Navigation"
          className="p-1.5 bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl flex items-center gap-1.5 overflow-x-auto"
        >
          <AnimatedBackground
            defaultValue="budgets"
            className="rounded-lg bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
            transition={{
              type: "spring",
              bounce: 0.15,
              duration: 0.4,
            }}
          >
            {[
              {
                id: "overview",
                label: "Overview",
                href: "/?mode=personal&view=overview",
              },
              {
                id: "expenses",
                label: "Expenses",
                href: "/?mode=personal&view=expenses",
              },
              {
                id: "income",
                label: "Income",
                href: "/?mode=personal&view=income",
              },
              { id: "budgets", label: "Budgets", href: "/budgets" },
              { id: "recurring", label: "Recurring", href: "/subscriptions" },
              { id: "receipts", label: "Saved Receipts", href: "/receipts" },
            ].map((tab) => {
              const isActive = tab.id === "budgets";
              return (
                <Link
                  key={tab.id}
                  data-id={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-[#121212] hover:bg-[#f3f4f6]/50"
                  }`}
                >
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </AnimatedBackground>
        </nav>

        {/* Section 1: Category Budgets */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs font-mono font-bold uppercase tracking-wider text-slate-500 animate-pulse">
              Loading budget data...
            </div>
          ) : budgets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {budgets.map((b) => {
                const spent =
                  categorySpentMap.get((b.category_id || "").toLowerCase()) ??
                  Number(b.spent_amount || 0);
                const limit = Number(b.amount_limit);
                const pct =
                  limit > 0
                    ? Math.min(100, Math.round((spent / limit) * 100))
                    : 0;
                const isOver = spent > limit;
                const isNear = pct >= 80 && !isOver;

                return (
                  <div
                    key={b.id}
                    className="neo-card p-5 space-y-4 shadow-[3px_3px_0_0_#121212] relative group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-black uppercase tracking-wide text-[#121212]">
                          {b.category_id?.replace(/_/g, " ")}
                        </span>
                        <div className="mt-1">
                          <span
                            className={`neo-badge ${
                              isOver
                                ? "neo-badge-red"
                                : isNear
                                  ? "neo-badge-yellow"
                                  : "neo-badge-green"
                            }`}
                          >
                            {isOver
                              ? `OVER BUDGET (${pct}%)`
                              : isNear
                                ? `NEAR LIMIT (${pct}%)`
                                : `ON TRACK (${pct}%)`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-400 hover:text-[#b91c1c] transition p-1"
                        title="Delete budget"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-3 w-full rounded-full bg-[#f3f4f6] border border-[#121212] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOver
                              ? "bg-[#b91c1c]"
                              : isNear
                                ? "bg-[#f59e0b]"
                                : "bg-[#836EF9]"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono font-bold text-slate-600">
                        <span>Spent: ${spent.toFixed(2)}</span>
                        <span>Limit: ${limit.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#121212] bg-[#f8f9fa] p-10 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] mx-auto">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                No Budgets Configured Yet
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Set category spending limits to proactively manage your monthly
                outlays and prevent budget variance.
              </p>
              <div className="pt-2 flex justify-center">
                <Magnetic range={60} intensity={0.35}>
                  <WatermelonButton
                    onClick={() => setBudgetModalOpen(true)}
                    variant="primary"
                    textMorph
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Create First Budget
                  </WatermelonButton>
                </Magnetic>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Financial Goals */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>

              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#121212] flex items-center gap-2.5">
                <Target className="h-6 w-6 text-[#15803d]" />
                Financial Goals & Runway Milestones
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Set and track capital targets with verifiable milestones.
              </p>
            </div>

            <Magnetic range={60} intensity={0.35}>
              <WatermelonButton
                onClick={() => setGoalModalOpen(true)}
                variant="secondary"
                textMorph
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create Goal
              </WatermelonButton>
            </Magnetic>
          </div>

          {goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {goals.map((g) => {
                const current = Number(g.current_amount || 0);
                const target = Number(g.target_amount || 0);
                const pct =
                  target > 0
                    ? Math.min(100, Math.round((current / target) * 100))
                    : 0;

                return (
                  <div
                    key={g.id}
                    className="neo-card p-5 space-y-4 shadow-[3px_3px_0_0_#121212]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wide text-[#121212]">
                          {g.name || g.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          Target date:{" "}
                          {g.target_date || g.deadline || "Ongoing"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {g.is_completed ? (
                          <span className="neo-badge neo-badge-green">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="neo-badge neo-badge-purple">
                            {pct}% Achieved
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteGoal(g.id)}
                          className="text-slate-400 hover:text-[#b91c1c] transition p-1"
                          title="Delete goal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-3 w-full rounded-full bg-[#f3f4f6] border border-[#121212] overflow-hidden">
                        <div
                          className="h-full bg-[#15803d] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono font-bold text-slate-600">
                        <span>Saved: ${current.toLocaleString()}</span>
                        <span>Target: ${target.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#121212] bg-[#f8f9fa] p-10 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#15803d] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] mx-auto">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                No Financial Goals Created Yet
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Define capital targets like Emergency Runway, Hardware Budget,
                or Savings Milestones to monitor progress.
              </p>
              <div className="pt-2 flex justify-center">
                <Magnetic range={60} intensity={0.35}>
                  <WatermelonButton
                    onClick={() => setGoalModalOpen(true)}
                    variant="secondary"
                    textMorph
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Create First Goal
                  </WatermelonButton>
                </Magnetic>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Budget Modal */}
      <AnimatePresence>
        {budgetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setBudgetModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 w-full max-w-md rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]"
            >
              <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  Create Category Budget
                </h3>
                <button
                  onClick={() => setBudgetModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                    Category
                  </label>
                  <NeoSelect
                    fullWidth
                    value={catName}
                    onChange={setCatName}
                    options={[
                      { value: "software_tools", label: "Software & Tools" },
                      { value: "food_dining", label: "Food & Dining" },
                      { value: "transportation", label: "Transportation" },
                      { value: "housing", label: "Housing & Rent" },
                      { value: "utilities", label: "Utilities" },
                      { value: "shopping", label: "Shopping & Retail" },
                      { value: "health", label: "Health & Medical" },
                      { value: "crypto_ops", label: "Crypto Operations" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Monthly Limit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={catLimit}
                    onChange={(e) => setCatLimit(e.target.value)}
                    placeholder="500"
                    className="mt-1 w-full neo-input font-mono font-bold"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t-2 border-[#121212]">
                  <button
                    type="button"
                    onClick={() => setBudgetModalOpen(false)}
                    className="neo-btn neo-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    Save Budget
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Goal Modal */}
      <AnimatePresence>
        {goalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setGoalModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 w-full max-w-md rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]"
            >
              <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  Create Financial Goal
                </h3>
                <button
                  onClick={() => setGoalModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Goal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="e.g. 6-Month Emergency Runway"
                    className="mt-1 w-full neo-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                      Target Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      placeholder="10000"
                      className="mt-1 w-full neo-input font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                      Current Saved ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full neo-input font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t-2 border-[#121212]">
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(false)}
                    className="neo-btn neo-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    Save Goal
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
