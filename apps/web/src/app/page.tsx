"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import LandingPage from "@/app/landing/page";
import { ModeHeader, type CorePillar } from "@/components/layout/mode-header";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { FreelancerDashboard } from "@/components/dashboard/freelancer-dashboard";
import { FamilyDashboard } from "@/components/dashboard/family-dashboard";
import { BusinessDashboard } from "@/components/dashboard/business-dashboard";
import { CopilotDrawer } from "@/components/ai/copilot-drawer";
import { ClarioAssistantTrigger } from "@/components/ai/clario-assistant-trigger";
import type { CopilotContext } from "@/lib/ai/copilot";
import { ReceiptUploadModal } from "@/components/dashboard/receipt-upload-modal";
import { TransactionModal } from "@/components/dashboard/transaction-modal";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  PlatformMode,
  Transaction,
  Subscription,
  Budget,
  FinancialGoal,
  VerificationState,
  PersonalView,
  FreelancerView,
  FamilyView,
  BusinessView,
} from "@/lib/supabase/types";
import { LogIn } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { TransactionShareModal } from "@/components/dashboard/transaction-share-modal";
import { executeSaveTransaction } from "@/lib/blockchain/save-transaction";

function DashboardContent({ initialMode }: { initialMode: PlatformMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useClarioAuth();
  const {
    user,
    isAuthenticated,
    displayName,
    hasConnectedEvmWallet,
    connectedEvmAddress,
    connectEvmWallet,
  } = auth;
  const [selectedProofTx, setSelectedProofTx] = useState<Transaction | null>(null);
  const [savingOnChainTxId, setSavingOnChainTxId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CorePillar>("expenses");
  const [activeMode, setActiveMode] = useState<PlatformMode>(initialMode);
  const [personalView, setPersonalView] = useState<PersonalView>("overview");
  const [freelancerView, setFreelancerView] =
    useState<FreelancerView>("overview");
  const [familyView, setFamilyView] = useState<FamilyView>("overview");
  const [businessView, setBusinessView] = useState<BusinessView>("overview");
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Sync mode and view from searchParams
  useEffect(() => {
    const urlMode = searchParams.get("mode") as PlatformMode | null;
    const validModes: PlatformMode[] = [
      "personal",
      "freelancer",
      "family",
      "business",
      "crypto",
      "power_user",
    ];

    if (urlMode && validModes.includes(urlMode) && urlMode !== activeMode) {
      setActiveMode(urlMode);
    }

    const urlView = searchParams.get("view");
    if (urlView) {
      const personalViews: PersonalView[] = [
        "overview",
        "expenses",
        "income",
        "budgets",
        "recurring",
        "receipts",
      ];
      if (personalViews.includes(urlView as PersonalView)) {
        setPersonalView(urlView as PersonalView);
      }

      const freelancerViews: FreelancerView[] = [
        "overview",
        "clients",
        "invoices",
        "expenses",
        "receipts",
        "tax",
      ];
      if (freelancerViews.includes(urlView as FreelancerView)) {
        setFreelancerView(urlView as FreelancerView);
      }

      const familyViews: FamilyView[] = [
        "overview",
        "members",
        "expenses",
        "budgets",
        "bills",
        "goals",
        "settlements",
      ];
      if (familyViews.includes(urlView as FamilyView)) {
        setFamilyView(urlView as FamilyView);
      }

      const businessViews: BusinessView[] = [
        "overview",
        "team",
        "expenses",
        "reimbursements",
        "policies",
        "approvals",
        "audit",
        "reports",
        "governance",
      ];
      if (businessViews.includes(urlView as BusinessView)) {
        setBusinessView(urlView as BusinessView);
      }
    }

    const urlTxId = searchParams.get("txId");
    if (urlTxId) {
      const supabase = getSupabaseClient();
      supabase
        .from("transactions")
        .select("*")
        .eq("id", urlTxId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedProofTx(data as Transaction);
        });
    }
  }, [searchParams, activeMode]);

  const handleModeChange = (mode: PlatformMode) => {
    setActiveMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("clario_active_mode", mode);
      const url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      url.searchParams.delete("view");
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    }
  };

  const handlePersonalViewChange = (view: PersonalView) => {
    setPersonalView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    }
  };

  const handleFreelancerViewChange = (view: FreelancerView) => {
    setFreelancerView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    }
  };

  const handleFamilyViewChange = (view: FamilyView) => {
    setFamilyView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    }
  };

  const handleBusinessViewChange = (view: BusinessView) => {
    setBusinessView(view);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      router.replace(url.pathname + "?" + url.searchParams.toString(), { scroll: false });
    }
  };

  const handleTabChange = (tab: CorePillar) => {
    setActiveTab(tab);
    if (tab === "expenses") {
      setPersonalView("overview");
      setFreelancerView("overview");
      setFamilyView("overview");
      setBusinessView("overview");
    } else if (tab === "vault") {
      setPersonalView("receipts");
      setFreelancerView("receipts");
      setFamilyView("settlements");
      setBusinessView("audit");
    } else if (tab === "insights") {
      setPersonalView("budgets");
      setFreelancerView("tax");
      setFamilyView("budgets");
      setBusinessView("reports");
    }
  };
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalSubLedger, setTxModalSubLedger] = useState<"fiat" | "onchain">("fiat");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);

  const effectiveUserId = user?.id || connectedEvmAddress || "demo_user";
  const userId = effectiveUserId;

  // Load financial data from Supabase scoped to current user/wallet
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const supabase = getSupabaseClient(effectiveUserId);

        let txQuery = supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false });
        if (effectiveUserId) {
          const userFilters = [`user_id.eq.${effectiveUserId}`];
          if (user?.id && user.id !== effectiveUserId) {
            userFilters.push(`user_id.eq.${user.id}`);
          }
          if (connectedEvmAddress && connectedEvmAddress !== effectiveUserId) {
            userFilters.push(`user_id.eq.${connectedEvmAddress}`);
          }
          txQuery = txQuery.or(userFilters.join(","));
        }
        const { data: txData } = await txQuery;

        if (txData && !ignore) {
          setTransactions(txData as Transaction[]);
        }

        let subQuery = supabase.from("subscriptions").select("*");
        if (effectiveUserId) {
          const userFilters = [`user_id.eq.${effectiveUserId}`];
          if (user?.id && user.id !== effectiveUserId) {
            userFilters.push(`user_id.eq.${user.id}`);
          }
          subQuery = subQuery.or(userFilters.join(","));
        }
        const { data: subData } = await subQuery;
        if (subData && !ignore) {
          setSubscriptions(subData as Subscription[]);
        }

        let budQuery = supabase.from("budgets").select("*");
        if (effectiveUserId) {
          const userFilters = [`user_id.eq.${effectiveUserId}`];
          if (user?.id && user.id !== effectiveUserId) {
            userFilters.push(`user_id.eq.${user.id}`);
          }
          budQuery = budQuery.or(userFilters.join(","));
        }
        const { data: budData } = await budQuery;
        if (budData && !ignore) {
          setBudgets(budData as Budget[]);
        }

        let goalQuery = supabase.from("financial_goals").select("*");
        if (effectiveUserId) {
          const userFilters = [`user_id.eq.${effectiveUserId}`];
          if (user?.id && user.id !== effectiveUserId) {
            userFilters.push(`user_id.eq.${user.id}`);
          }
          goalQuery = goalQuery.or(userFilters.join(","));
        }
        const { data: goalData } = await goalQuery;
        if (goalData && !ignore) {
          setGoals(goalData as FinancialGoal[]);
        }
      } catch (e) {
        console.warn("Error loading financial data:", e);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [effectiveUserId, user?.id, connectedEvmAddress]);

  function handleAddTransaction(newTx: Partial<Transaction>) {
    const fullTx: Transaction = {
      id: newTx.id || crypto.randomUUID(),
      user_id: newTx.user_id || userId,
      type: newTx.type || "expense",
      amount: newTx.amount || 0,
      currency: newTx.currency || "USD",
      merchant:
        newTx.merchant || newTx.description || "Uncategorized Transaction",
      description:
        newTx.description || newTx.merchant || "Uncategorized Transaction",
      category: newTx.category || newTx.category_id || "other",
      category_id:
        newTx.category_id ||
        (typeof newTx.category === "string"
          ? newTx.category
          : newTx.category?.slug) ||
        "other",
      timestamp: newTx.timestamp || newTx.date || new Date().toISOString(),
      date: newTx.date || new Date().toISOString().split("T")[0]!,
      payment_method: newTx.payment_method?.trim() || "Card",
      verification_state:
        (newTx.verification_state as VerificationState) || "unverified",
      verification_status: newTx.verification_status || "unverified",
      blockchain_network: newTx.blockchain_network || "Monad Testnet",
      blockchain_status:
        newTx.blockchain_status ||
        (newTx.verification_state === "verified" ? "confirmed" : "unverified"),
      blockchain_tx_hash:
        newTx.blockchain_tx_hash || newTx.monad_tx_hash || null,
      blockchain_contract_address: newTx.blockchain_contract_address || null,
      blockchain_chain_id: newTx.blockchain_chain_id || 10143,
      blockchain_data_hash:
        newTx.blockchain_data_hash || newTx.commitment_hash || null,
      blockchain_timestamp: newTx.blockchain_timestamp || null,
      monad_tx_hash: newTx.monad_tx_hash || newTx.blockchain_tx_hash || null,
      monad_block: newTx.monad_block || null,
      commitment_hash:
        newTx.commitment_hash || newTx.blockchain_data_hash || null,
      proof_hash: newTx.proof_hash || null,
      status: "cleared",
      source: newTx.source || "manual",
      version: newTx.version || 1,
      notes: newTx.notes || null,
      created_at: newTx.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => [
      fullTx,
      ...prev.filter((t) => t.id !== fullTx.id),
    ]);

    // Upsert to Supabase
    const supabase = getSupabaseClient();
    supabase
      .from("transactions")
      .upsert(fullTx)
      .then(() => {});
  }

  const handleSaveTransactionOnChain = async (tx: Transaction) => {
    if (savingOnChainTxId === tx.id) return;
    if (!hasConnectedEvmWallet || !connectedEvmAddress) {
      connectEvmWallet();
      return;
    }

    setSavingOnChainTxId(tx.id);
    const activeWallet =
      auth.activeWallet ||
      auth.externalEvmWallet ||
      auth.embeddedWallet ||
      auth.wallets.find(
        (w) =>
          w.address.toLowerCase() === (connectedEvmAddress || "").toLowerCase(),
      );

    try {
      const result = await executeSaveTransaction({
        transactionData: {
          ...tx,
          amount: Number(tx.amount),
          merchant: tx.merchant,
          type: (tx.type as "expense" | "income" | "transfer") || "expense",
        },
        userId,
        userAddress: connectedEvmAddress,
        connectedWallet: activeWallet,
      });

      if (result.success && result.transaction) {
        handleAddTransaction(result.transaction);
      }
    } catch (err) {
      console.error("Failed to save transaction on Monad:", err);
    } finally {
      setSavingOnChainTxId(null);
    }
  };

  const copilotContext = useMemo<CopilotContext>(() => {
    let clients;
    let invoices;
    let familyMembers;
    let familyBills;
    let familySettlements;
    let businessTeam;
    let businessClaims;
    let businessPolicies;
    let businessAuditEvents;

    if (typeof window !== "undefined") {
      try {
        if (activeMode === "freelancer") {
          const rawClients = localStorage.getItem("clario_freelancer_clients");
          const rawInvoices = localStorage.getItem(
            "clario_freelancer_invoices",
          );
          if (rawClients) clients = JSON.parse(rawClients);
          if (rawInvoices) invoices = JSON.parse(rawInvoices);
        } else if (activeMode === "family") {
          const rawMembers = localStorage.getItem("clario_family_members");
          const rawBills = localStorage.getItem("clario_family_bills");
          const rawSettlements = localStorage.getItem(
            "clario_family_settlements",
          );
          if (rawMembers) familyMembers = JSON.parse(rawMembers);
          if (rawBills) familyBills = JSON.parse(rawBills);
          if (rawSettlements) familySettlements = JSON.parse(rawSettlements);
        } else if (activeMode === "business") {
          const rawTeam = localStorage.getItem("clario_business_team");
          const rawClaims = localStorage.getItem(
            "clario_business_reimbursements",
          );
          const rawPolicies = localStorage.getItem("clario_business_policies");
          const rawAudit = localStorage.getItem("clario_business_audit_events");
          if (rawTeam) businessTeam = JSON.parse(rawTeam);
          if (rawClaims) businessClaims = JSON.parse(rawClaims);
          if (rawPolicies) businessPolicies = JSON.parse(rawPolicies);
          if (rawAudit) businessAuditEvents = JSON.parse(rawAudit);
        }
      } catch {
        // Safe fallback
      }
    }

    return {
      transactions,
      subscriptions,
      budgets,
      activeMode,
      userName: displayName || "User",
      clients,
      invoices,
      familyMembers,
      familyBills,
      familySettlements,
      businessTeam,
      businessClaims,
      businessPolicies,
      businessAuditEvents,
    };
  }, [transactions, subscriptions, budgets, activeMode, displayName]);

  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans">
      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page-Level Header: Mode Selector, 3 Core Pillars & Primary CTA */}
        <ModeHeader
          currentMode={activeMode}
          onModeChange={handleModeChange}
          onOpenCopilot={() => setCopilotOpen(true)}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogExpense={() => {
            setTxModalSubLedger(activeMode === "crypto" ? "onchain" : "fiat");
            setTxModalOpen(true);
          }}
        />

        {/* Connect Reassurance for Unauthenticated Visitors */}
        {!isAuthenticated && (
          <div className="bg-[#f5f3ff] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#836EF9] border border-[#121212] flex items-center justify-center text-white shrink-0 shadow-[1px_1px_0_0_#121212]">
                <MonadLogo className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#121212]">
                    Connect to Monad Testnet
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Sign in with Email, Google, Passkey, or Web3 Wallet to anchor verifiable cryptographic receipts.
                </p>
              </div>
            </div>

            <button
              onClick={connectEvmWallet}
              className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shrink-0"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Connect Wallet / Sign In</span>
            </button>
          </div>
        )}

        {activeMode === "freelancer" && (
          <FreelancerDashboard
            transactions={transactions}
            activeView={freelancerView}
            onViewChange={handleFreelancerViewChange}
            onAddTransaction={() => setTxModalOpen(true)}
            onUploadReceipt={() => setReceiptModalOpen(true)}
            onUpdateTransaction={handleAddTransaction}
            onViewReceipt={setSelectedProofTx}
            onSaveOnChain={handleSaveTransactionOnChain}
            userId={userId}
            userAddress={connectedEvmAddress || undefined}
            hasConnectedWallet={hasConnectedEvmWallet}
            onConnectWallet={connectEvmWallet}
            currencySymbol="$"
          />
        )}

        {activeMode === "family" && (
          <FamilyDashboard
            transactions={transactions}
            budgets={budgets}
            goals={goals}
            activeView={familyView}
            onViewChange={handleFamilyViewChange}
            onAddTransaction={() => setTxModalOpen(true)}
            onUploadReceipt={() => setReceiptModalOpen(true)}
            onUpdateTransaction={handleAddTransaction}
            onViewReceipt={setSelectedProofTx}
            onSaveOnChain={handleSaveTransactionOnChain}
            userId={userId}
            userAddress={connectedEvmAddress || undefined}
            hasConnectedWallet={hasConnectedEvmWallet}
            onConnectWallet={connectEvmWallet}
            currencySymbol="$"
          />
        )}

        {activeMode === "business" && (
          <BusinessDashboard
            transactions={transactions}
            activeView={businessView}
            onViewChange={handleBusinessViewChange}
            onAddTransaction={() => setTxModalOpen(true)}
            onUploadReceipt={() => setReceiptModalOpen(true)}
            onUpdateTransaction={handleAddTransaction}
            onViewReceipt={setSelectedProofTx}
            onSaveOnChain={handleSaveTransactionOnChain}
            userId={userId}
            userAddress={connectedEvmAddress || undefined}
            hasConnectedWallet={hasConnectedEvmWallet}
            onConnectWallet={connectEvmWallet}
            currencySymbol="$"
          />
        )}

        {(activeMode === "personal" ||
          activeMode === "crypto" ||
          activeMode === "power_user") && (
          <PersonalDashboard
            transactions={transactions}
            subscriptions={subscriptions}
            budgets={budgets}
            goals={goals}
            currencySymbol="$"
            activeView={personalView}
            onViewChange={handlePersonalViewChange}
            onAddTransaction={(subLedger) => {
              setTxModalSubLedger(subLedger || "fiat");
              setTxModalOpen(true);
            }}
            onUploadReceipt={() => setReceiptModalOpen(true)}
            onUpdateTransaction={handleAddTransaction}
            userId={userId}
            userAddress={connectedEvmAddress || undefined}
            hasConnectedWallet={hasConnectedEvmWallet}
            onConnectWallet={connectEvmWallet}
          />
        )}
      </main>

      {/* Slide-over Copilot Drawer */}
      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={copilotContext}
      />

      {/* Floating Bottom-Right Clario Circular Button & Greeting Popup */}
      <ClarioAssistantTrigger
        isOpen={copilotOpen}
        onOpen={() => setCopilotOpen(true)}
      />

      {/* Receipt Upload & OCR Modal */}
      <ReceiptUploadModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onTransactionCreated={handleAddTransaction}
        userId={userId}
      />

      {/* Manual & Onchain Transaction Modal with AI Scan Shortcut */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSave={handleAddTransaction}
        onScanReceipt={() => setReceiptModalOpen(true)}
        onViewReceipt={setSelectedProofTx}
        userId={userId}
        userAddress={connectedEvmAddress || undefined}
        hasConnectedWallet={hasConnectedEvmWallet}
        onConnectWallet={connectEvmWallet}
        initialSubLedger={txModalSubLedger}
      />

      {/* Shareable & Downloadable Receipt Modal */}
      <TransactionShareModal
        isOpen={!!selectedProofTx}
        onClose={() => setSelectedProofTx(null)}
        transaction={selectedProofTx}
      />
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode") as PlatformMode | null;
  const urlTxId = searchParams.get("txId");

  const validModes: PlatformMode[] = [
    "personal",
    "freelancer",
    "family",
    "business",
    "crypto",
    "power_user",
  ];

  const isDashboard = (!!urlMode && validModes.includes(urlMode)) || !!urlTxId;

  if (!isDashboard) {
    return <LandingPage />;
  }

  const effectiveInitialMode: PlatformMode =
    urlMode && validModes.includes(urlMode) ? urlMode : "personal";

  return <DashboardContent initialMode={effectiveInitialMode} />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-grid flex items-center justify-center font-mono text-xs uppercase tracking-wider text-gray-700">
          <div className="bg-white px-4 py-2 border-2 border-black shadow-[2px_2px_0px_#000]">
            Loading Clario...
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
