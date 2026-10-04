"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModeHeader } from "@/components/layout/mode-header";
import { Repeat, Plus, Calendar, X, Trash2, Layers } from "lucide-react";
import type { PlatformMode, Subscription } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user, connectedEvmAddress } = useClarioAuth();
  const effectiveUserId = connectedEvmAddress || user?.id || "demo_user";
  const userId = effectiveUserId;
  const [activeMode, setActiveMode] = useState<PlatformMode>("personal");
  const [modalOpen, setModalOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subFrequency, setSubFrequency] = useState<
    "monthly" | "yearly" | "weekly"
  >("monthly");
  const [subNextBilling, setSubNextBilling] = useState("");

  // Load real subscriptions from Supabase scoped to current user/wallet
  useEffect(() => {
    let ignore = false;
    async function loadSubs() {
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

        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .or(filterStr);
        if (!ignore && data) {
          setSubscriptions(data as Subscription[]);
        }
      } catch (err) {
        console.warn("Failed to load subscriptions:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadSubs();
    return () => {
      ignore = true;
    };
  }, [effectiveUserId, user?.id, connectedEvmAddress]);

  const totalMonthly = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const amt = Number(s.amount || 0);
      if (s.frequency === "yearly") return sum + amt / 12;
      if (s.frequency === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0);

  async function handleAddSub(e: React.FormEvent) {
    e.preventDefault();
    if (!subName || !subAmount) return;

    const newSub: Subscription = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: subName,
      amount: parseFloat(subAmount),
      currency: "USD",
      frequency: subFrequency,
      next_billing_date: subNextBilling || null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSubscriptions((prev) => [newSub, ...prev]);
    setModalOpen(false);
    setSubName("");
    setSubAmount("");
    setSubNextBilling("");

    try {
      const supabase = getSupabaseClient();
      await supabase.from("subscriptions").upsert(newSub);
    } catch (err) {
      console.warn("Failed to persist subscription:", err);
    }
  }

  async function toggleStatus(id: string) {
    const target = subscriptions.find((s) => s.id === id);
    if (!target) return;
    const nextStatus = target.status === "active" ? "cancelled" : "active";

    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s)),
    );

    try {
      const supabase = getSupabaseClient();
      await supabase
        .from("subscriptions")
        .update({ status: nextStatus })
        .eq("id", id);
    } catch (err) {
      console.warn("Failed to update subscription status:", err);
    }
  }

  async function handleDeleteSub(id: string) {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    try {
      const supabase = getSupabaseClient();
      await supabase.from("subscriptions").delete().eq("id", id);
    } catch (err) {
      console.warn("Failed to delete subscription:", err);
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-[#121212]">
                [RECURRING SERVICES]
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#121212] flex items-center gap-2.5">
              <Repeat className="h-7 w-7 text-[#836EF9]" />
              Subscriptions & Recurring Outflows
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Audit recurring charges, identify unwanted renewals, and track
              monthly burn.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="neo-btn neo-btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span>Add Subscription</span>
          </button>
        </div>

        {/* Primary Mode Navigation Bar */}
        <nav
          aria-label="Subscriptions Primary Navigation"
          className="p-1.5 bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl flex items-center gap-1.5 overflow-x-auto"
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
            const isActive = tab.id === "recurring";
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                  isActive
                    ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                    : "bg-white text-[#121212] border-2 border-transparent hover:border-[#121212] hover:bg-[#f3f4f6]"
                }`}
              >
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Burn Rate Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="neo-card p-5 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Monthly Run Rate
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-[#121212]">
                ${totalMonthly.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-500">/ month</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Calculated across active services
            </p>
          </div>

          <div className="neo-card p-5 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Annualized Outflow
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-[#836EF9]">
                ${(totalMonthly * 12).toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-500">/ year</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Projected yearly subscription cost
            </p>
          </div>

          <div className="neo-card p-5 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Active Services
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-[#15803d]">
                {subscriptions.filter((s) => s.status === "active").length}
              </span>
              <span className="text-xs font-bold text-slate-500">
                subscriptions
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Audited and tracked
            </p>
          </div>
        </div>

        {/* Subscriptions List */}
        <div className="neo-card p-6 space-y-4 shadow-[4px_4px_0_0_#121212]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
            <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
              Tracked Services & Tools
            </h2>
            <span className="neo-badge neo-badge-purple">
              {subscriptions.length} Configured
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs font-mono font-bold uppercase tracking-wider text-slate-500 animate-pulse">
              Loading subscriptions...
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="divide-y-2 divide-[#121212]">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-black uppercase tracking-wide text-[#121212]">
                        {sub.name}
                      </span>
                      <span
                        className={`neo-badge ${
                          sub.status === "active"
                            ? "neo-badge-green"
                            : "neo-badge-gray"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    {sub.next_billing_date && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Calendar className="h-3 w-3 text-[#836EF9]" />
                        <span>Next renewal: {sub.next_billing_date}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-[#121212]">
                        ${Number(sub.amount).toFixed(2)}
                      </span>
                      <span className="block text-[10px] font-black text-slate-500 uppercase">
                        {sub.frequency}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleStatus(sub.id)}
                      className="neo-btn neo-btn-secondary text-[11px] py-1 px-3"
                    >
                      {sub.status === "active" ? "Pause" : "Resume"}
                    </button>

                    <button
                      onClick={() => handleDeleteSub(sub.id)}
                      className="text-slate-400 hover:text-[#b91c1c] transition p-1"
                      title="Delete subscription"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#121212] bg-[#f8f9fa] p-10 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] mx-auto">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                No Subscriptions Tracked Yet
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Add recurring services like GitHub, Vercel, Netflix, or cloud
                hosting to track burn rate and receive renewal notices.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="neo-btn neo-btn-primary"
              >
                <Plus className="h-4 w-4" />
                <span>Track First Subscription</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Subscription Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]">
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                Track Subscription
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSub} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. GitHub Copilot, Vercel Pro, Figma"
                  className="mt-1 w-full neo-input font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    placeholder="20.00"
                    className="mt-1 w-full neo-input font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Frequency
                  </label>
                  <select
                    value={subFrequency}
                    onChange={(e) =>
                      setSubFrequency(
                        e.target.value as "monthly" | "yearly" | "weekly",
                      )
                    }
                    className="mt-1 w-full neo-input font-semibold"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Next Renewal Date
                </label>
                <input
                  type="date"
                  value={subNextBilling}
                  onChange={(e) => setSubNextBilling(e.target.value)}
                  className="mt-1 w-full neo-input font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t-2 border-[#121212]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="neo-btn neo-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="neo-btn neo-btn-primary">
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
