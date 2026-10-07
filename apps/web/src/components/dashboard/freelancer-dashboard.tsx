"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  Transaction,
  Client,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  FreelancerView,
  ReceiptBundle,
} from "@/lib/supabase/types";
import {
  UsersRound,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  Receipt,
  Download,
  ShieldCheck,
  Search,
  X,
  Building2,
  Mail,
  Trash2,
  Edit2,
  Printer,
  Eye,
  BadgeCheck,
} from "lucide-react";
import {
  getClients,
  saveClient,
  deleteClient,
  getInvoices,
  saveInvoice,
  deleteInvoice,
  updateInvoiceStatus,
} from "@/lib/modes/mode-storage";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getMonadExplorerTxUrl } from "@/lib/blockchain/registry";
import { ReceiptBundleModal } from "./receipt-bundle-modal";
import { AnimatedBackground } from "@/components/ui/motion/animated-background";
import { Magnetic } from "@/components/ui/motion/magnetic";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { motion, AnimatePresence } from "motion/react";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";

interface FreelancerDashboardProps {
  transactions: Transaction[];
  activeView?: FreelancerView | undefined;
  onViewChange?: ((view: FreelancerView) => void) | undefined;
  onAddTransaction?: (() => void) | undefined;
  onUploadReceipt?: (() => void) | undefined;
  onUpdateTransaction?: ((tx: Partial<Transaction>) => void) | undefined;
  userId?: string | undefined;
  userAddress?: string | null | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
  currencySymbol?: string | undefined;
}

export function FreelancerDashboard({
  transactions = [],
  activeView: propActiveView,
  onViewChange,
  onAddTransaction,
  onUploadReceipt,
  onUpdateTransaction,
  userId = "demo_user",
  userAddress,
  currencySymbol = "$",
}: FreelancerDashboardProps) {
  const [internalView, setInternalView] = useState<FreelancerView>("overview");
  const activeView = propActiveView || internalView;

  const currentTab = useMemo<"overview" | "invoices" | "expenses" | "tax">(() => {
    if (activeView === "clients" || activeView === "invoices") return "invoices";
    if (activeView === "expenses") return "expenses";
    if (activeView === "tax" || activeView === "receipts") return "tax";
    return "overview";
  }, [activeView]);

  const [invoiceSubTab, setInvoiceSubTab] = useState<"invoices" | "clients">(
    activeView === "clients" ? "clients" : "invoices",
  );
  const [taxSubTab, setTaxSubTab] = useState<"tax" | "proofs">(
    activeView === "receipts" ? "proofs" : "tax",
  );

  const handleViewChange = (view: FreelancerView) => {
    if (view === "clients") {
      setInvoiceSubTab("clients");
    } else if (view === "invoices") {
      setInvoiceSubTab("invoices");
    } else if (view === "receipts") {
      setTaxSubTab("proofs");
    } else if (view === "tax") {
      setTaxSubTab("tax");
    }
    if (onViewChange) {
      onViewChange(view);
    }
    setInternalView(view);
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [inspectingBundle, setInspectingBundle] =
    useState<ReceiptBundle | null>(null);

  // Time range for charts
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "3M" | "6M" | "1Y">(
    "30D",
  );

  // Filters state
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState<
    "all" | "active" | "lead" | "inactive"
  >("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<
    "all" | InvoiceStatus
  >("all");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [receiptsTab, setReceiptsTab] = useState<"all" | "anchored">("all");
  const [taxRateBracket, setTaxRateBracket] = useState(25); // 25% default self-employment + income bracket

  // Client Form state
  const [clientForm, setClientForm] = useState({
    name: "",
    company: "",
    email: "",
    rate_currency: "USD",
    hourly_rate: "",
    status: "active" as "active" | "inactive" | "lead",
    notes: "",
  });

  // Invoice Form state
  const [invoiceForm, setInvoiceForm] = useState(() => ({
    client_name: "",
    client_id: "",
    invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    issue_date: new Date().toISOString().split("T")[0]!,
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]!,
    currency: "USD",
    tax_rate: "0",
    notes: "Payment due within 14 days. Thank you for your business.",
    items: [
      {
        id: "item-1",
        description: "Consulting & Engineering Services",
        quantity: 10,
        rate: 120,
        amount: 1200,
      },
    ] as InvoiceItem[],
  }));

  // Load clients and invoices
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      try {
        const [loadedClients, loadedInvoices] = await Promise.all([
          getClients(userId),
          getInvoices(userId),
        ]);
        if (!ignore) {
          setClients(loadedClients);
          setInvoices(loadedInvoices);
        }
      } catch (err) {
        console.warn("Error loading freelancer data:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [userId]);

  // Derived Financial Metrics
  const paidInvoicesTotal = useMemo(() => {
    return invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
  }, [invoices]);

  const unpaidInvoicesTotal = useMemo(() => {
    return invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
  }, [invoices]);

  // Business deductible expenses
  const deductibleExpenses = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.type === "expense" &&
        (t.mode === "freelancer" ||
          t.tax_deductible ||
          t.category === "software_tools" ||
          t.category === "office_expenses" ||
          t.category === "travel_meals" ||
          t.category === "professional_services"),
    );
  }, [transactions]);

  const totalDeductibleAmount = useMemo(() => {
    return deductibleExpenses.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0,
    );
  }, [deductibleExpenses]);

  // Gross Revenue includes paid invoices + any manual income marked as freelancer
  const totalRevenue = useMemo(() => {
    const freelanceIncomeTx = transactions
      .filter(
        (t) =>
          t.type === "income" &&
          (t.mode === "freelancer" || t.notes?.includes("Invoice")),
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return Math.max(paidInvoicesTotal, freelanceIncomeTx);
  }, [transactions, paidInvoicesTotal]);

  const netProfit = totalRevenue - totalDeductibleAmount;
  const _profitMargin =
    totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 100;
  const estimatedTaxLiability = Math.max(0, netProfit * (taxRateBracket / 100));

  // Chart Data: Invoiced Revenue vs Business Expenses over time
  const chartData = useMemo(() => {
    const days =
      timeRange === "7D"
        ? 7
        : timeRange === "30D"
          ? 30
          : timeRange === "3M"
            ? 90
            : timeRange === "6M"
              ? 180
              : 365;
    const result: Array<{
      date: string;
      displayDate: string;
      revenue: number;
      expenses: number;
    }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      const displayDate = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const dailyRev = invoices
        .filter(
          (inv) =>
            inv.status === "paid" &&
            (inv.payment_received_date === dateStr ||
              inv.issue_date === dateStr),
        )
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      const dailyExp = deductibleExpenses
        .filter((tx) => (tx.date || tx.timestamp?.split("T")[0]) === dateStr)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      result.push({
        date: dateStr,
        displayDate,
        revenue: dailyRev,
        expenses: dailyExp,
      });
    }

    if (days > 30) {
      const grouped: typeof result = [];
      const step = days === 90 ? 3 : days === 180 ? 6 : 12;
      for (let i = 0; i < result.length; i += step) {
        const slice = result.slice(i, i + step);
        const item = slice[0]!;
        const rev = slice.reduce((s, x) => s + x.revenue, 0);
        const exp = slice.reduce((s, x) => s + x.expenses, 0);
        grouped.push({
          date: item.date,
          displayDate: item.displayDate,
          revenue: rev,
          expenses: exp,
        });
      }
      return grouped;
    }

    return result;
  }, [invoices, deductibleExpenses, timeRange]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.company &&
          c.company.toLowerCase().includes(clientSearch.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(clientSearch.toLowerCase()));
      const matchesStatus =
        clientStatusFilter === "all" || c.status === clientStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, clientSearch, clientStatusFilter]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      const matchesSearch =
        i.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
        i.client_name.toLowerCase().includes(invoiceSearch.toLowerCase());
      const matchesStatus =
        invoiceStatusFilter === "all" || i.status === invoiceStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, invoiceSearch, invoiceStatusFilter]);

  // Filtered Business Expenses
  const filteredExpenses = useMemo(() => {
    return deductibleExpenses.filter((tx) => {
      const matchesSearch =
        tx.merchant.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        (tx.client_name &&
          tx.client_name.toLowerCase().includes(expenseSearch.toLowerCase())) ||
        (tx.notes &&
          tx.notes.toLowerCase().includes(expenseSearch.toLowerCase()));
      const matchesCategory =
        expenseCategoryFilter === "all" ||
        tx.category === expenseCategoryFilter ||
        tx.tax_category === expenseCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [deductibleExpenses, expenseSearch, expenseCategoryFilter]);

  // Receipts / Evidence
  const businessReceipts = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.mode === "freelancer" ||
        tx.tax_deductible ||
        tx.receipt_id ||
        tx.receipt ||
        tx.monad_tx_hash,
    );
  }, [transactions]);

  const anchoredReceipts = useMemo(() => {
    return businessReceipts.filter((tx) =>
      Boolean(tx.monad_tx_hash || tx.blockchain_tx_hash),
    );
  }, [businessReceipts]);

  // Schedule C Breakdown by Category
  const scheduleCDeductions = useMemo(() => {
    let software = 0;
    let equipment = 0;
    let office = 0;
    let travel = 0;
    let professional = 0;
    let other = 0;

    deductibleExpenses.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      const cat = String(tx.category || "").toLowerCase();
      if (
        cat.includes("software") ||
        cat.includes("tool") ||
        cat.includes("subscription")
      ) {
        software += amt;
      } else if (
        cat.includes("hardware") ||
        cat.includes("equipment") ||
        cat.includes("computer")
      ) {
        equipment += amt;
      } else if (cat.includes("office") || cat.includes("rent")) {
        office += amt;
      } else if (
        cat.includes("travel") ||
        cat.includes("meal") ||
        cat.includes("food")
      ) {
        travel += amt;
      } else if (
        cat.includes("legal") ||
        cat.includes("service") ||
        cat.includes("professional")
      ) {
        professional += amt;
      } else {
        other += amt;
      }
    });

    const categoryList = [
      { name: "Software & Subscriptions", amount: software },
      { name: "Equipment & Hardware", amount: equipment },
      { name: "Office & Co-Working", amount: office },
      { name: "Travel & Meals", amount: travel },
      { name: "Professional Services", amount: professional },
      { name: "Other Business Expenses", amount: other },
    ];

    return categoryList.map((item) => ({
      name: item.name,
      amount: item.amount,
      percentage:
        totalDeductibleAmount > 0
          ? Math.round((item.amount / totalDeductibleAmount) * 100)
          : 0,
    }));
  }, [deductibleExpenses, totalDeductibleAmount]);

  // Handlers for Client
  function handleOpenCreateClient() {
    setEditingClient(null);
    setClientForm({
      name: "",
      company: "",
      email: "",
      rate_currency: "USD",
      hourly_rate: "",
      status: "active",
      notes: "",
    });
    setIsClientModalOpen(true);
  }

  function handleOpenEditClient(client: Client) {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      company: client.company || "",
      email: client.email || "",
      rate_currency: client.rate_currency,
      hourly_rate: client.hourly_rate ? String(client.hourly_rate) : "",
      status: client.status,
      notes: client.notes || "",
    });
    setIsClientModalOpen(true);
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!clientForm.name.trim()) return;

    const clientPayload: Client = {
      id: editingClient ? editingClient.id : crypto.randomUUID(),
      user_id: userId,
      name: clientForm.name.trim(),
      company: clientForm.company.trim() || null,
      email: clientForm.email.trim() || null,
      rate_currency: clientForm.rate_currency,
      hourly_rate: clientForm.hourly_rate
        ? Number(clientForm.hourly_rate)
        : null,
      status: clientForm.status,
      notes: clientForm.notes.trim() || null,
      created_at: editingClient
        ? editingClient.created_at
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await saveClient(clientPayload);
    setClients((prev) => {
      if (editingClient) {
        return prev.map((c) => (c.id === saved.id ? saved : c));
      }
      return [saved, ...prev];
    });
    setIsClientModalOpen(false);
  }

  async function handleDeleteClient(clientId: string) {
    if (!confirm("Are you sure you want to remove this client?")) return;
    await deleteClient(clientId);
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  }

  // Handlers for Invoice
  function handleOpenCreateInvoice(
    prefillClientName?: string,
    prefillClientId?: string,
  ) {
    const selectedClient = clients.find(
      (c) => c.id === prefillClientId || c.name === prefillClientName,
    );
    const rate = selectedClient?.hourly_rate || 120;

    setInvoiceForm({
      client_name: selectedClient?.name || prefillClientName || "",
      client_id: selectedClient?.id || prefillClientId || "",
      invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      issue_date: new Date().toISOString().split("T")[0]!,
      due_date: new Date(Date.now() + 14 * 86400000)
        .toISOString()
        .split("T")[0]!,
      currency: selectedClient?.rate_currency || "USD",
      tax_rate: "0",
      notes: userAddress
        ? `Payment due within 14 days.\nMonad Testnet Wallet: ${userAddress}\nThank you for your business.`
        : "Payment due within 14 days. Thank you for your business.",
      items: [
        {
          id: `item-${Date.now()}`,
          description: "Consulting & Engineering Deliverables",
          quantity: 10,
          rate,
          amount: 10 * rate,
        },
      ],
    });
    setIsInvoiceModalOpen(true);
  }

  function handleAddInvoiceLineItem() {
    setInvoiceForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          description: "",
          quantity: 1,
          rate: 100,
          amount: 100,
        },
      ],
    }));
  }

  function handleUpdateInvoiceItem(
    id: string,
    field: "description" | "quantity" | "rate",
    val: string | number,
  ) {
    setInvoiceForm((prev) => {
      const updated = prev.items.map((item) => {
        if (item.id !== id) return item;
        const newItem = { ...item, [field]: val };
        newItem.amount =
          Number(newItem.quantity || 0) * Number(newItem.rate || 0);
        return newItem;
      });
      return { ...prev, items: updated };
    });
  }

  function handleRemoveInvoiceItem(id: string) {
    setInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceForm.client_name.trim()) return;

    const subtotal = invoiceForm.items.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const taxRate = Number(invoiceForm.tax_rate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      user_id: userId,
      client_id: invoiceForm.client_id || null,
      client_name: invoiceForm.client_name.trim(),
      invoice_number: invoiceForm.invoice_number,
      issue_date: invoiceForm.issue_date,
      due_date: invoiceForm.due_date,
      currency: invoiceForm.currency,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: "sent",
      notes: invoiceForm.notes,
      items: invoiceForm.items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await saveInvoice(newInvoice);
    setInvoices((prev) => [saved, ...prev]);
    setIsInvoiceModalOpen(false);
  }

  async function handleMarkInvoicePaid(inv: Invoice) {
    const today = new Date().toISOString().split("T")[0]!;
    await updateInvoiceStatus(inv.id, "paid", today);
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === inv.id
          ? { ...i, status: "paid", payment_received_date: today }
          : i,
      ),
    );

    if (onUpdateTransaction) {
      const incomeTx: Transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        amount: Number(inv.total_amount),
        currency: inv.currency,
        type: "income",
        merchant: `Client Payment: ${inv.client_name}`,
        description: `Invoice ${inv.invoice_number} paid by ${inv.client_name}`,
        category: "freelance_income",
        category_id: "freelance_income",
        timestamp: new Date().toISOString(),
        date: today,
        status: "cleared",
        source: "manual",
        mode: "freelancer",
        client_name: inv.client_name,
        verification_state: "unverified",
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onUpdateTransaction(incomeTx);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    await deleteInvoice(invoiceId);
    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice(null);
    }
  }

  function handleToggleDeductible(tx: Transaction) {
    if (onUpdateTransaction) {
      onUpdateTransaction({
        ...tx,
        tax_deductible: !tx.tax_deductible,
        mode: "freelancer",
      });
    }
  }

  function handleExportExpensesCSV() {
    if (deductibleExpenses.length === 0) {
      alert("No business deductible expenses to export.");
      return;
    }
    const headers = [
      "Date",
      "Merchant",
      "Category",
      "Client / Project",
      "Amount",
      "Currency",
      "Tax Deductible",
      "Monad Tx Hash",
    ];
    const rows = deductibleExpenses.map((tx) => [
      tx.date || tx.timestamp?.split("T")[0],
      `"${tx.merchant.replace(/"/g, '""')}"`,
      `"${tx.tax_category || tx.category || "General"}"`,
      `"${tx.client_name || tx.project_name || "General Business"}"`,
      tx.amount,
      tx.currency || "USD",
      "Yes",
      tx.monad_tx_hash || tx.blockchain_tx_hash || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `clario_freelance_deductions_${new Date().getFullYear()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header & Sub-Navigation Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#121212]">
              Freelance
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Client invoices, deductible expenses, clients, and tax estimates.
            </p>
          </div>

          <div>
            <Magnetic range={70} intensity={0.4}>
              <WatermelonButton
                variant="primary"
                textMorph
                onClick={() => handleOpenCreateInvoice()}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create invoice
              </WatermelonButton>
            </Magnetic>
          </div>
        </div>

        {/* Primary Mode Navigation Bar: Fixed 4 tabs */}
        <nav
          aria-label="Freelancer Navigation"
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
              if (id) handleViewChange(id as FreelancerView);
            }}
          >
            {[
              { id: "overview" as const, label: "Overview", icon: TrendingUp },
              {
                id: "invoices" as const,
                label: "Invoices & clients",
                icon: FileText,
                count:
                  invoices.filter((i) => i.status === "sent" || i.status === "overdue").length > 0
                    ? invoices.filter((i) => i.status === "sent" || i.status === "overdue").length
                    : undefined,
              },
              {
                id: "expenses" as const,
                label: "Expenses",
                icon: DollarSign,
              },
              { id: "tax" as const, label: "Tax & proofs", icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-id={tab.id}
                  type="button"
                  onClick={() => handleViewChange(tab.id as FreelancerView)}
                  className={`group flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center ${
                    isActive
                      ? "text-white"
                      : "text-[#121212] hover:bg-slate-100/60"
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
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERVIEW VIEW: Exactly 4 stat cards */}
      {/* ========================================================================= */}
      {currentTab === "overview" && (
        <div className="space-y-6">
          {/* Exactly 4 Freelancer KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gross Revenue */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Gross revenue
              </span>
              <div className="text-2xl font-bold font-mono text-[#121212] mt-1">
                {currencySymbol}
                {totalRevenue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Paid client receipts & income
              </p>
            </div>

            {/* Outstanding Invoices */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Unpaid invoices
              </span>
              <div className="text-2xl font-bold font-mono text-[#854d0e] mt-1">
                {currencySymbol}
                {unpaidInvoicesTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {
                  invoices.filter(
                    (i) => i.status === "sent" || i.status === "overdue",
                  ).length
                }{" "}
                awaiting payment
              </p>
            </div>

            {/* Deductible Expenses */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Deductible expenses
              </span>
              <div className="text-2xl font-bold font-mono text-[#b91c1c] mt-1">
                {currencySymbol}
                {totalDeductibleAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Schedule C write-offs
              </p>
            </div>

            {/* Tax Reserve Estimate */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <span className="text-xs font-medium text-slate-500">
                Estimated tax
              </span>
              <div className="text-2xl font-bold font-mono text-[#836EF9] mt-1">
                {currencySymbol}
                {estimatedTaxLiability.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                At {taxRateBracket}% bracket
              </p>
            </div>
          </div>

          {/* Cash Flow Trend Chart */}
          <div className="neo-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  Freelance Cash Flow Dynamics
                </h3>
                <p className="text-xs text-slate-500">
                  Invoiced client revenue vs. deductible business expenditures.
                </p>
              </div>

              {/* Time Range Filter */}
              <div className="flex items-center gap-1 bg-[#f3f4f6] p-1 rounded-lg border-2 border-[#121212]">
                {(["7D", "30D", "3M", "6M", "1Y"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded transition ${
                      timeRange === r
                        ? "bg-[#836EF9] text-white shadow-[1px_1px_0_0_#121212]"
                        : "text-[#121212] hover:bg-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="freelanceRevenueGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#836EF9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#836EF9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="freelanceExpenseGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "#121212", strokeWidth: 1.5 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "#121212", strokeWidth: 1.5 }}
                    tickFormatter={(val) => `${currencySymbol}${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "2px solid #121212",
                      borderRadius: "8px",
                      boxShadow: "4px 4px 0px #121212",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                    formatter={(val: unknown) => [
                      `${currencySymbol}${Number(val || 0).toFixed(2)}`,
                      "",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Invoiced Revenue"
                    stroke="#836EF9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#freelanceRevenueGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Deductible Spend"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#freelanceExpenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Invoice & Client Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invoices List / Queue */}
            <div className="lg:col-span-2 neo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Recent Client Invoices
                  </h3>
                  <p className="text-xs text-slate-500">
                    Track client billings and settlement progress
                  </p>
                </div>
                <button
                  onClick={() => handleViewChange("invoices")}
                  className="text-xs font-black uppercase tracking-wider text-[#836EF9] hover:underline"
                >
                  View All ({invoices.length}) →
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#121212] p-8 text-center bg-[#fafafa]">
                  <FileText className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    No Invoices Created Yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Generate professional invoices with custom line items, due
                    dates, and tax calculations.
                  </p>
                  <Magnetic range={60} intensity={0.35}>
                    <WatermelonButton
                      onClick={() => handleOpenCreateInvoice()}
                      variant="primary"
                      textMorph
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                      className="mt-4"
                    >
                      Create First Invoice
                    </WatermelonButton>
                  </Magnetic>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600">
                          Invoice #
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600">
                          Client
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600">
                          Due Date
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600 text-right">
                          Amount
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600">
                          Status
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase tracking-wider text-slate-600 text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b border-[#121212]">
                      {invoices.slice(0, 5).map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-[#f3f0ff]/30 transition"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[#121212]">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="hover:text-[#836EF9] hover:underline"
                            >
                              {inv.invoice_number}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-bold text-[#121212]">
                            {inv.client_name}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {inv.due_date}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-[#121212] text-right">
                            {currencySymbol}
                            {Number(inv.total_amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#121212] ${
                                inv.status === "paid"
                                  ? "bg-[#dcfce7] text-[#15803d]"
                                  : inv.status === "overdue"
                                    ? "bg-[#fee2e2] text-[#b91c1c]"
                                    : "bg-[#fef9c3] text-[#854d0e]"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                title="View / Print Invoice"
                                className="p-1 rounded border border-[#121212] hover:bg-[#f3f4f6]"
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                              {inv.status !== "paid" ? (
                                <button
                                  onClick={() => handleMarkInvoicePaid(inv)}
                                  className="px-2 py-0.5 bg-[#836EF9] text-white text-[10px] font-black uppercase tracking-wider rounded border border-[#121212] shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#7257f8] transition"
                                >
                                  Mark Paid
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#15803d]">
                                  <BadgeCheck className="w-3 h-3 shrink-0" />
                                  <span>Cleared</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Tax & Deductions Summary Card */}
            <div className="neo-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-[#836EF9]" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Tax Reserve Assistant
                  </span>
                </div>
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  Estimated Quarterly Tax
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Based on {taxRateBracket}% federal + self-employment tax
                  bracket on net income.
                </p>

                <div className="mt-5 p-4 rounded-xl border-2 border-[#121212] bg-[#f3f0ff] shadow-[2px_2px_0_0_#121212]">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Recommended Reserve
                  </div>
                  <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                    {currencySymbol}
                    {estimatedTaxLiability.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 flex justify-between">
                    <span>
                      Taxable Net: {currencySymbol}
                      {Math.max(0, netProfit).toFixed(2)}
                    </span>
                    <span className="font-bold">
                      Bracket: {taxRateBracket}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-black uppercase text-slate-500">
                    Top Write-Off Categories
                  </div>
                  {scheduleCDeductions.slice(0, 3).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-600">{item.name}:</span>
                      <span className="font-mono font-bold text-[#121212]">
                        {currencySymbol}
                        {item.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t-2 border-[#121212]">
                <button
                  onClick={() => handleViewChange("tax")}
                  className="w-full neo-btn neo-btn-secondary text-center justify-center"
                >
                  <span>Open Full Tax Organizer →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVOICES & CLIENTS VIEW */}
      {/* ========================================================================= */}
      {currentTab === "invoices" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1 bg-white border border-[#121212]/15 rounded-lg shadow-sm">
              <button
                type="button"
                onClick={() => setInvoiceSubTab("invoices")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  invoiceSubTab === "invoices"
                    ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Invoices ({invoices.length})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceSubTab("clients")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  invoiceSubTab === "clients"
                    ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Clients ({clients.length})
              </button>
            </div>

            {invoiceSubTab === "clients" ? (
              <button
                type="button"
                onClick={handleOpenCreateClient}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Add client</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenCreateInvoice()}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create invoice</span>
              </button>
            )}
          </div>

          {invoiceSubTab === "clients" ? (
            <div className="space-y-6">

          {/* Search & Filter Bar */}
          <div className="neo-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients by name, company, or email..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(["all", "active", "lead", "inactive"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setClientStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded border-2 border-[#121212] transition ${
                    clientStatusFilter === st
                      ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                      : "bg-white text-[#121212] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212] animate-pulse">
              <UsersRound className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Loading client roster...
              </p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212]">
              <UsersRound className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                {clients.length === 0
                  ? "No Clients In Your Roster"
                  : "No Matching Clients Found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {clients.length === 0
                  ? "Add your direct clients, companies, or agencies to track hourly rates, invoices, and payment statuses."
                  : "Try clearing your search query or status filter."}
              </p>
              {clients.length === 0 && (
                <Magnetic range={60} intensity={0.35}>
                  <WatermelonButton
                    onClick={handleOpenCreateClient}
                    variant="primary"
                    textMorph
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="mt-4"
                  >
                    Add Your First Client
                  </WatermelonButton>
                </Magnetic>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClients.map((client) => {
                const clientInvoices = invoices.filter(
                  (i) =>
                    i.client_id === client.id || i.client_name === client.name,
                );
                const billedTotal = clientInvoices.reduce(
                  (sum, i) => sum + Number(i.total_amount || 0),
                  0,
                );
                const unpaidTotal = clientInvoices
                  .filter((i) => i.status !== "paid")
                  .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

                return (
                  <div
                    key={client.id}
                    className="neo-card p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                            {client.name}
                          </h3>
                          {client.company && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              <span>{client.company}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#121212] ${
                              client.status === "active"
                                ? "bg-[#dcfce7] text-[#15803d]"
                                : client.status === "lead"
                                  ? "bg-[#fef9c3] text-[#854d0e]"
                                  : "bg-[#f3f4f6] text-slate-500"
                            }`}
                          >
                            {client.status}
                          </span>
                          <button
                            onClick={() => handleOpenEditClient(client)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600"
                            title="Edit Client"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-1 rounded hover:bg-slate-100 text-rose-500"
                            title="Delete Client"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {client.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-3">
                          <Mail className="h-3 w-3" />
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:underline hover:text-[#836EF9]"
                          >
                            {client.email}
                          </a>
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t-2 border-[#121212]">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            Hourly Rate
                          </span>
                          <div className="text-sm font-black font-mono text-[#121212]">
                            {client.hourly_rate
                              ? `${currencySymbol}${client.hourly_rate}/hr`
                              : "Project Fixed"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            Total Invoiced
                          </span>
                          <div className="text-sm font-black font-mono text-[#836EF9]">
                            {currencySymbol}
                            {billedTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {unpaidTotal > 0 && (
                        <div className="mt-3 p-2 rounded bg-[#fef9c3] border border-[#121212] text-[11px] font-bold text-[#854d0e] flex items-center justify-between">
                          <span>Outstanding:</span>
                          <span className="font-mono">
                            {currencySymbol}
                            {unpaidTotal.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-[#121212] flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">
                        {clientInvoices.length} Invoices
                      </span>
                      <button
                        onClick={() =>
                          handleOpenCreateInvoice(client.name, client.id)
                        }
                        className="text-xs font-black uppercase tracking-wider text-[#836EF9] hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Bill Client</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Search & Status Filters */}
          <div className="neo-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by invoice number or client name..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  "all",
                  "sent",
                  "draft",
                  "paid",
                  "overdue",
                  "cancelled",
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  onClick={() => setInvoiceStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded border-2 border-[#121212] shrink-0 transition ${
                    invoiceStatusFilter === st
                      ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                      : "bg-white text-[#121212] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212] animate-pulse">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Loading invoices...
              </p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212]">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                {invoices.length === 0
                  ? "No Invoices Created"
                  : "No Matching Invoices Found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {invoices.length === 0
                  ? "Generate and send your first client invoice. Marking an invoice as paid automatically updates your Universal Ledger."
                  : "Try adjusting your search query or status filter."}
              </p>
              {invoices.length === 0 && (
                <Magnetic range={60} intensity={0.35}>
                  <WatermelonButton
                    onClick={() => handleOpenCreateInvoice()}
                    variant="primary"
                    textMorph
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="mt-4"
                  >
                    Create First Invoice
                  </WatermelonButton>
                </Magnetic>
              )}
            </div>
          ) : (
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Invoice #
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Client
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Issue Date
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Due Date
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                        Items
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                        Total
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Status
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-[#121212]">
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-[#f3f0ff]/30 transition"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="hover:text-[#836EF9] hover:underline"
                          >
                            {inv.invoice_number}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#121212]">
                          {inv.client_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {inv.issue_date}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {inv.due_date}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-right">
                          {inv.items?.length || 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-[#121212] text-right">
                          {currencySymbol}
                          {Number(inv.total_amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#121212] ${
                              inv.status === "paid"
                                ? "bg-[#dcfce7] text-[#15803d]"
                                : inv.status === "overdue"
                                  ? "bg-[#fee2e2] text-[#b91c1c]"
                                  : "bg-[#fef9c3] text-[#854d0e]"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              title="Inspect & Print Invoice"
                              className="p-1 rounded border border-[#121212] hover:bg-[#f3f4f6]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {inv.status !== "paid" ? (
                              <button
                                onClick={() => handleMarkInvoicePaid(inv)}
                                className="neo-btn neo-btn-secondary py-0.5 px-2 text-[10px]"
                              >
                                <span>Mark Paid</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#15803d]">
                                <BadgeCheck className="w-3 h-3 shrink-0" />
                                <span>Cleared</span>
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              title="Delete Invoice"
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
    </div>
  )}

      {/* ========================================================================= */}
      {/* 4. BUSINESS EXPENSES VIEW */}
      {/* ========================================================================= */}
      {currentTab === "expenses" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Freelance Business Deductions
              </h2>
              <p className="text-xs text-slate-500">
                Expenses eligible for business write-offs (Software, Equipment,
                Travel, Subscriptions).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExpensesCSV}
                className="neo-btn neo-btn-secondary"
              >
                <Download className="h-4 w-4 text-[#836EF9]" />
                <span>Export Deductions CSV</span>
              </button>
              {onAddTransaction && (
                <button
                  onClick={onAddTransaction}
                  className="neo-btn neo-btn-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span>Log Business Expense</span>
                </button>
              )}
            </div>
          </div>

          {/* 3-Card Deduction Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="neo-card p-5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Total Business Outflow
              </span>
              <div className="text-2xl font-black font-mono text-[#b91c1c] mt-1">
                -{currencySymbol}
                {totalDeductibleAmount.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {deductibleExpenses.length} deductible transactions recorded
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Estimated Tax Shield
              </span>
              <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
                +{currencySymbol}
                {(totalDeductibleAmount * (taxRateBracket / 100)).toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Direct tax savings at {taxRateBracket}% rate
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Receipt Verification Rate
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {deductibleExpenses.length > 0
                  ? Math.round(
                      (deductibleExpenses.filter(
                        (t) => t.receipt_id || t.receipt || t.monad_tx_hash,
                      ).length /
                        deductibleExpenses.length) *
                        100,
                    )
                  : 100}
                %
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Protected against audit disallowances
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="neo-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search business expenses by merchant or client..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
              />
            </div>

            <div className="flex items-center gap-2">
              <NeoSelect
                value={expenseCategoryFilter}
                onChange={setExpenseCategoryFilter}
                options={[
                  { value: "all", label: "All Categories" },
                  { value: "software_tools", label: "Software & Cloud Tools" },
                  { value: "office_expenses", label: "Office & Hardware" },
                  { value: "travel_meals", label: "Travel & Client Meals" },
                  { value: "professional_services", label: "Professional & Legal" },
                ]}
              />
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212]">
              <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                No Deductible Expenses Found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Log business software tools, internet, client meals, or hardware
                to calculate your tax write-offs.
              </p>
              {onAddTransaction && (
                <button
                  onClick={onAddTransaction}
                  className="mt-4 neo-btn neo-btn-primary inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  <span>Log Expense Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Date
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Merchant / Purpose
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Tax Category
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Client / Project
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                        Amount
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Proof Status
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-[#121212]">
                    {filteredExpenses.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#f3f0ff]/30 transition"
                      >
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {tx.date || tx.timestamp?.split("T")[0]}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#121212]">
                          {tx.merchant}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#f3f0ff] text-[#836EF9] border border-[#121212]">
                            {tx.tax_category ||
                              String(tx.category || "General")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {tx.client_name ||
                            tx.project_name ||
                            "General Business"}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-[#b91c1c] text-right">
                          -{currencySymbol}
                          {Number(tx.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {tx.monad_tx_hash ? (
                            <a
                              href={getMonadExplorerTxUrl(tx.monad_tx_hash)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#dcfce7] text-[#15803d] border border-[#121212] flex items-center gap-1 w-fit hover:underline"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Anchored
                            </a>
                          ) : tx.receipt_id || tx.receipt ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#fef9c3] text-[#854d0e] border border-[#121212] flex items-center gap-1 w-fit">
                              <Receipt className="h-3 w-3" />
                              Receipt Attached
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              Unanchored
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleDeductible(tx)}
                            title="Toggle Tax Deductible Status"
                            className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-[#121212] hover:bg-slate-100"
                          >
                            {tx.tax_deductible ? "Deductible" : "Non-Ded"}
                          </button>
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
      {/* 5. TAX & PROOFS VIEW */}
      {/* ========================================================================= */}
      {currentTab === "tax" && (
        <div className="space-y-6">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#121212]/15 rounded-lg shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setTaxSubTab("tax")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                taxSubTab === "tax"
                  ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Tax organizer
            </button>
            <button
              type="button"
              onClick={() => setTaxSubTab("proofs")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                taxSubTab === "proofs"
                  ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Receipts & proofs ({businessReceipts.length})
            </button>
          </div>

          {taxSubTab === "proofs" ? (
            <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Freelance Receipts & Proofs Vault
              </h2>
              <p className="text-xs text-slate-500">
                Cryptographically anchored business evidence for clients,
                reimbursements, and tax audits.
              </p>
            </div>
            {onUploadReceipt && (
              <button
                onClick={onUploadReceipt}
                className="neo-btn neo-btn-primary"
              >
                <Receipt className="h-4 w-4" />
                <span>Scan Receipt (OCR)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Total Business Evidence
              </span>
              <div className="text-2xl font-black font-mono text-[#121212] mt-1">
                {businessReceipts.length} Receipts
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Backed by digital evidence
              </p>
            </div>
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Monad Anchored
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {anchoredReceipts.length} Proofs
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Onchain SHA-256 commitments
              </p>
            </div>
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Audit Readiness
              </span>
              <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
                100%
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Private evidence preserved
              </p>
            </div>
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Monad Network
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                Monad Testnet
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Monad Testnet Verified
              </p>
            </div>
          </div>

          {/* Sub-Tabs: All Receipts vs Anchored */}
          <div className="flex items-center gap-2 border-b-2 border-[#121212] pb-2">
            <button
              onClick={() => setReceiptsTab("all")}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg border-2 transition ${
                receiptsTab === "all"
                  ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                  : "bg-white text-[#121212] border-transparent hover:border-[#121212]"
              }`}
            >
              All Receipts ({businessReceipts.length})
            </button>
            <button
              onClick={() => setReceiptsTab("anchored")}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg border-2 transition ${
                receiptsTab === "anchored"
                  ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                  : "bg-white text-[#121212] border-transparent hover:border-[#121212]"
              }`}
            >
              On-Chain Monad Anchors ({anchoredReceipts.length})
            </button>
          </div>

          {/* Receipts Table */}
          {(receiptsTab === "all" ? businessReceipts : anchoredReceipts)
            .length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white shadow-[2px_2px_0_0_#121212]">
              <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                {receiptsTab === "anchored"
                  ? "No On-Chain Anchors Found"
                  : "No Business Receipts Uploaded"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {receiptsTab === "anchored"
                  ? "Anchor business transactions onto Monad Testnet to create tamper-proof proof bundles."
                  : "Use the multimodal Gemini OCR scanner to extract merchants, totals, and dates from receipts."}
              </p>
              {onUploadReceipt && (
                <button
                  onClick={onUploadReceipt}
                  className="mt-4 neo-btn neo-btn-primary inline-flex"
                >
                  <Receipt className="h-4 w-4" />
                  <span>Scan Receipt Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Date
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Merchant
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Category
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Client
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                        Amount
                      </th>
                      <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                        Monad Proof
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-[#121212]">
                    {(receiptsTab === "all"
                      ? businessReceipts
                      : anchoredReceipts
                    ).map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#f3f0ff]/30 transition"
                      >
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {tx.date || tx.timestamp?.split("T")[0]}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#121212]">
                          {tx.merchant}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#f3f0ff] text-[#836EF9] border border-[#121212]">
                            {tx.tax_category ||
                              String(tx.category || "General")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {tx.client_name || "General Business"}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-[#121212] text-right">
                          {currencySymbol}
                          {Number(tx.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {tx.monad_tx_hash ? (
                            <a
                              href={getMonadExplorerTxUrl(tx.monad_tx_hash)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#dcfce7] text-[#15803d] border border-[#121212] flex items-center gap-1 w-fit hover:underline"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              View on Monad Explorer
                            </a>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              Local Offchain
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Tax Organizer & Schedule C Estimator
              </h2>
              <p className="text-xs text-slate-500">
                Track self-employment write-offs, net taxable earnings, and
                quarterly tax reserves.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="neo-btn neo-btn-secondary"
              >
                <Printer className="h-4 w-4" />
                <span>Print Tax Summary</span>
              </button>
              <button
                onClick={handleExportExpensesCSV}
                className="neo-btn neo-btn-primary"
              >
                <Download className="h-4 w-4" />
                <span>Export Schedule C (CSV)</span>
              </button>
            </div>
          </div>

          {/* Tax Calculator Card */}
          <div className="neo-card p-6">
            <h3 className="text-base font-black uppercase tracking-wider text-[#121212] mb-4">
              Estimated Self-Employment Tax Liability
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl border-2 border-[#121212] bg-[#f9fafb]">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  Gross Invoiced Income
                </span>
                <div className="text-xl font-black font-mono text-[#121212] mt-1">
                  {currencySymbol}
                  {totalRevenue.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-[#121212] bg-[#f9fafb]">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  Allowable Deductions
                </span>
                <div className="text-xl font-black font-mono text-[#b91c1c] mt-1">
                  -{currencySymbol}
                  {totalDeductibleAmount.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-[#121212] bg-[#f9fafb]">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  Net Taxable Profit
                </span>
                <div className="text-xl font-black font-mono text-[#15803d] mt-1">
                  {currencySymbol}
                  {Math.max(0, netProfit).toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-[#121212] bg-[#f3f0ff] shadow-[2px_2px_0_0_#121212]">
                <span className="text-[11px] font-black uppercase text-[#836EF9]">
                  Quarterly Reserve
                </span>
                <div className="text-xl font-black font-mono text-[#836EF9] mt-1">
                  {currencySymbol}
                  {estimatedTaxLiability.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Tax Bracket Picker */}
            <div className="pt-4 border-t-2 border-[#121212] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-xs font-bold text-slate-600">
                Adjust Combined Tax Rate Bracket:
              </span>
              <div className="flex items-center gap-2">
                {[15, 20, 25, 30, 35].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTaxRateBracket(pct)}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded border-2 border-[#121212] transition ${
                      taxRateBracket === pct
                        ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                        : "bg-white text-[#121212] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quarterly Deadlines Schedule & Schedule C Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quarterly Deadlines Schedule */}
            <div className="neo-card p-6">
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212] mb-3">
                Quarterly Estimated Tax Deadlines
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Recommended IRS Form 1040-ES estimated payments schedule.
              </p>

              <div className="space-y-3">
                {[
                  {
                    q: "Q1",
                    due: "April 15, 2026",
                    period: "Jan 1 – Mar 31",
                    amount: estimatedTaxLiability / 4,
                  },
                  {
                    q: "Q2",
                    due: "June 15, 2026",
                    period: "Apr 1 – May 31",
                    amount: estimatedTaxLiability / 4,
                  },
                  {
                    q: "Q3",
                    due: "September 15, 2026",
                    period: "Jun 1 – Aug 31",
                    amount: estimatedTaxLiability / 4,
                  },
                  {
                    q: "Q4",
                    due: "January 15, 2027",
                    period: "Sep 1 – Dec 31",
                    amount: estimatedTaxLiability / 4,
                  },
                ].map((quarter) => (
                  <div
                    key={quarter.q}
                    className="p-3.5 rounded-xl border-2 border-[#121212] bg-[#fafafa] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 bg-[#836EF9] text-white rounded border border-[#121212]">
                          {quarter.q}
                        </span>
                        <span className="font-bold text-xs text-[#121212]">
                          {quarter.due}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {quarter.period}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-black text-[#121212]">
                        {currencySymbol}
                        {quarter.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block">
                        estimated
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule C Category Breakdown Progress Bars */}
            <div className="neo-card p-6">
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212] mb-3">
                Deductions by Schedule C Category
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Itemized business expenses to offset 1099 freelance revenue.
              </p>

              <div className="space-y-3.5">
                {scheduleCDeductions.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#121212]">
                        {item.name}
                      </span>
                      <span className="font-mono font-black text-slate-700">
                        {currencySymbol}
                        {item.amount.toFixed(2)} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f3f4f6] h-2.5 rounded-full border border-[#121212] overflow-hidden">
                      <div
                        className="bg-[#836EF9] h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CLIENT */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsClientModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0_0_#121212]"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-[#836EF9]" />
                  {editingClient ? "Edit Client" : "Add New Client"}
                </h3>
                <button
                  onClick={() => setIsClientModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Client / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp / Monad Ecosystem"
                    value={clientForm.company}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, company: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="client@acme.com"
                      value={clientForm.email}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, email: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Hourly Rate ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="120"
                      value={clientForm.hourly_rate}
                      onChange={(e) =>
                        setClientForm({
                          ...clientForm,
                          hourly_rate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Client Status
                  </label>
                  <NeoSelect
                    value={clientForm.status}
                    onChange={(val) =>
                      setClientForm({
                        ...clientForm,
                        status: val as "active" | "lead" | "inactive",
                      })
                    }
                    options={[
                      { value: "active", label: "Active Client" },
                      { value: "lead", label: "Prospect / Lead" },
                      { value: "inactive", label: "Inactive / Past" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    placeholder="Terms, project scope, or contract reference..."
                    rows={2}
                    value={clientForm.notes}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>{editingClient ? "Update Client" : "Save Client"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CREATE INVOICE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsInvoiceModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 neo-card w-full max-w-2xl p-6 bg-white shadow-[6px_6px_0_0_#121212] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#836EF9]" />
                  Create New Invoice
                </h3>
                <button
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 border border-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Select Client *
                    </label>
                    {clients.length > 0 ? (
                      <NeoSelect
                        value={invoiceForm.client_name}
                        onChange={(val) => {
                          const sel = clients.find((c) => c.name === val);
                          setInvoiceForm({
                            ...invoiceForm,
                            client_name: val,
                            client_id: sel?.id || "",
                          });
                        }}
                        placeholder="-- Choose client --"
                        options={clients.map((c) => ({
                          value: c.name,
                          label: `${c.name}${c.company ? ` (${c.company})` : ""}`,
                        }))}
                      />
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Corp"
                        value={invoiceForm.client_name}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            client_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Invoice #
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceForm.invoice_number}
                      onChange={(e) =>
                        setInvoiceForm({
                          ...invoiceForm,
                          invoice_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Issue Date
                    </label>
                    <NeoDatePicker
                      value={invoiceForm.issue_date}
                      onChange={(date) =>
                        setInvoiceForm({
                          ...invoiceForm,
                          issue_date: date,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Due Date
                    </label>
                    <NeoDatePicker
                      value={invoiceForm.due_date}
                      onChange={(date) =>
                        setInvoiceForm({
                          ...invoiceForm,
                          due_date: date,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Line Items
                    </label>
                    <button
                      type="button"
                      onClick={handleAddInvoiceLineItem}
                      className="text-xs font-black uppercase tracking-wider text-[#836EF9] hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {invoiceForm.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Description of service / task"
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateInvoiceItem(
                              item.id,
                              "description",
                              e.target.value,
                            )
                          }
                          className="flex-1 px-3 py-1.5 text-xs font-bold border-2 border-[#121212] rounded-lg focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateInvoiceItem(
                              item.id,
                              "quantity",
                              Number(e.target.value),
                            )
                          }
                          className="w-16 px-2 py-1.5 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) =>
                            handleUpdateInvoiceItem(
                              item.id,
                              "rate",
                              Number(e.target.value),
                            )
                          }
                          className="w-24 px-2 py-1.5 text-xs font-mono font-bold border-2 border-[#121212] rounded-lg focus:outline-none"
                        />
                        <span className="w-20 text-right font-mono font-black text-xs">
                          {currencySymbol}
                          {item.amount.toFixed(2)}
                        </span>
                        {invoiceForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveInvoiceItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Instructions & Notes */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Payment Instructions & Wallet / Wire Details
                  </label>
                  <textarea
                    rows={3}
                    value={invoiceForm.notes}
                    onChange={(e) =>
                      setInvoiceForm({ ...invoiceForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-[#121212] rounded-lg focus:outline-none"
                  />
                </div>

                {/* Subtotal & Total Preview */}
                <div className="pt-3 border-t-2 border-[#121212] flex justify-end">
                  <div className="w-56 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Subtotal:</span>
                      <span className="font-mono">
                        {currencySymbol}
                        {invoiceForm.items
                          .reduce((s, i) => s + Number(i.amount || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#121212] font-black text-sm pt-1 border-t border-[#121212]">
                      <span>Total:</span>
                      <span className="font-mono text-[#836EF9]">
                        {currencySymbol}
                        {invoiceForm.items
                          .reduce((s, i) => s + Number(i.amount || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-[#121212] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <span>Generate & Send Invoice</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: INSPECT / PRINT INVOICE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedInvoice(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 neo-card w-full max-w-2xl p-6 sm:p-8 bg-white shadow-[8px_8px_0_0_#121212] max-h-[90vh] overflow-y-auto"
            >
              {/* Action Bar */}
              <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212] mb-6 print:hidden">
                <span className="text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-2.5 py-1 rounded border border-[#121212]">
                  Official Neo-Brutalist Invoice
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="neo-btn neo-btn-secondary py-1 px-3 text-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print / PDF</span>
                  </button>
                  {selectedInvoice.status !== "paid" && (
                    <button
                      onClick={() => {
                        handleMarkInvoicePaid(selectedInvoice);
                        setSelectedInvoice({
                          ...selectedInvoice,
                          status: "paid",
                        });
                      }}
                      className="neo-btn neo-btn-primary py-1 px-3 text-xs"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      <span>Mark as Paid</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="p-1.5 rounded hover:bg-slate-100 border border-[#121212]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Document */}
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#836EF9] border-2 border-[#121212] flex items-center justify-center text-white font-black">
                        C
                      </div>
                      <span className="text-xl font-black uppercase tracking-wider text-[#121212]">
                        CLARIO INVOICE
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Verifiable Freelance Billing & Settlement
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-mono font-black text-[#121212]">
                      {selectedInvoice.invoice_number}
                    </div>
                    <span
                      className={`inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-[#121212] ${
                        selectedInvoice.status === "paid"
                          ? "bg-[#dcfce7] text-[#15803d]"
                          : selectedInvoice.status === "overdue"
                            ? "bg-[#fee2e2] text-[#b91c1c]"
                            : "bg-[#fef9c3] text-[#854d0e]"
                      }`}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                </div>

                {/* Billed To / Dates */}
                <div className="grid grid-cols-2 gap-6 p-4 rounded-xl border-2 border-[#121212] bg-[#f9fafb]">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Billed To:
                    </span>
                    <div className="text-sm font-black text-[#121212]">
                      {selectedInvoice.client_name}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Freelance Client / Partner
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Issue Date:{" "}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#121212]">
                        {selectedInvoice.issue_date}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Due Date:{" "}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#121212]">
                        {selectedInvoice.due_date}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border-2 border-[#121212] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f3f4f6] border-b-2 border-[#121212]">
                        <th className="py-2.5 px-3 font-black uppercase text-slate-700">
                          Description
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase text-slate-700 text-center">
                          Qty / Hrs
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase text-slate-700 text-right">
                          Rate
                        </th>
                        <th className="py-2.5 px-3 font-black uppercase text-slate-700 text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-[#121212]">
                      {(selectedInvoice.items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-3 font-bold text-[#121212]">
                            {item.description}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {currencySymbol}
                            {Number(item.rate).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-[#121212]">
                            {currencySymbol}
                            {Number(item.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Subtotal:</span>
                      <span className="font-mono">
                        {currencySymbol}
                        {Number(selectedInvoice.subtotal).toFixed(2)}
                      </span>
                    </div>
                    {Number(selectedInvoice.tax_rate || 0) > 0 && (
                      <div className="flex justify-between text-slate-600 font-bold">
                        <span>Tax ({selectedInvoice.tax_rate}%):</span>
                        <span className="font-mono">
                          +{currencySymbol}
                          {Number(selectedInvoice.tax_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#121212] font-black text-base pt-2 border-t-2 border-[#121212]">
                      <span>Total Due:</span>
                      <span className="font-mono text-[#836EF9]">
                        {currencySymbol}
                        {Number(selectedInvoice.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Instructions */}
                {selectedInvoice.notes && (
                  <div className="p-4 rounded-xl border-2 border-[#121212] bg-[#f3f0ff]">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#836EF9] block mb-1">
                      Payment Instructions & Terms:
                    </span>
                    <p className="text-xs font-mono text-slate-700 whitespace-pre-line">
                      {selectedInvoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspect Bundle Modal */}
      {inspectingBundle && (
        <ReceiptBundleModal
          isOpen={true}
          onClose={() => setInspectingBundle(null)}
          bundle={inspectingBundle}
          transactions={transactions}
          userAddress={userAddress}
        />
      )}
    </div>
  );
}
