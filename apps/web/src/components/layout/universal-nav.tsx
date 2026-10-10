"use client";

import type { PlatformMode } from "@/lib/supabase/types";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ClarioLogo } from "@/components/ui/clario-logo";
import {
  LayoutDashboard,
  Receipt,
  RotateCcw,
  ChartNoAxesCombined,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  UsersRound,
  FileText,
  Target,
  HandCoins,
  ClipboardCheck,
  ClipboardList,
  Landmark,
  Bot,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  AnimatedBackground,
  BorderTrail,
  Magnetic,
} from "@/components/ui/motion";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const MODE_NAV_CONFIG: Record<PlatformMode, NavItem[]> = {
  personal: [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/?mode=personal&view=overview",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: TrendingDown,
      href: "/?mode=personal&view=expenses",
    },
    {
      id: "income",
      label: "Income",
      icon: TrendingUp,
      href: "/?mode=personal&view=income",
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: ChartNoAxesCombined,
      href: "/?mode=personal&view=budgets",
    },
    {
      id: "recurring",
      label: "Recurring",
      icon: RotateCcw,
      href: "/?mode=personal&view=recurring",
    },
    {
      id: "receipts",
      label: "Saved Receipts",
      icon: Receipt,
      href: "/?mode=personal&view=receipts",
    },
  ],
  freelancer: [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/?mode=freelancer&view=overview",
    },
    {
      id: "clients",
      label: "Clients",
      icon: UsersRound,
      href: "/?mode=freelancer&view=clients",
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: FileText,
      href: "/?mode=freelancer&view=invoices",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: Receipt,
      href: "/?mode=freelancer&view=expenses",
    },
    {
      id: "receipts",
      label: "Receipts",
      icon: Receipt,
      href: "/?mode=freelancer&view=receipts",
    },
    {
      id: "tax",
      label: "Tax",
      icon: Landmark,
      href: "/?mode=freelancer&view=tax",
    },
  ],
  family: [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/?mode=family&view=overview",
    },
    {
      id: "members",
      label: "Members",
      icon: UsersRound,
      href: "/?mode=family&view=members",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: Receipt,
      href: "/?mode=family&view=expenses",
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: ChartNoAxesCombined,
      href: "/?mode=family&view=budgets",
    },
    {
      id: "bills",
      label: "Bills",
      icon: CalendarDays,
      href: "/?mode=family&view=bills",
    },
    {
      id: "goals",
      label: "Goals",
      icon: Target,
      href: "/?mode=family&view=goals",
    },
    {
      id: "settlements",
      label: "Settlements",
      icon: HandCoins,
      href: "/?mode=family&view=settlements",
    },
  ],
  business: [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/?mode=business&view=overview",
    },
    {
      id: "team",
      label: "Team",
      icon: UsersRound,
      href: "/?mode=business&view=team",
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: Receipt,
      href: "/?mode=business&view=expenses",
    },
    {
      id: "reimbursements",
      label: "Reimbursements",
      icon: HandCoins,
      href: "/?mode=business&view=reimbursements",
    },
    {
      id: "approvals",
      label: "Approvals",
      icon: ClipboardCheck,
      href: "/?mode=business&view=approvals",
    },
    {
      id: "policies",
      label: "Policies",
      icon: ShieldCheck,
      href: "/?mode=business&view=policies",
    },
    {
      id: "audit",
      label: "Audit Log",
      icon: ClipboardList,
      href: "/?mode=business&view=audit",
    },
    {
      id: "reports",
      label: "Reports",
      icon: ChartNoAxesCombined,
      href: "/?mode=business&view=reports",
    },
    {
      id: "governance",
      label: "Enterprise Protocol",
      icon: ShieldCheck,
      href: "/?mode=business&view=governance",
    },
  ],
};

interface UniversalNavProps {
  currentMode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
  onOpenCopilot?: () => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export function UniversalNav({
  currentMode,
  onModeChange,
  onOpenCopilot,
  activeView,
  onViewChange,
}: UniversalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, hasConnectedEvmWallet, connectEvmWallet } =
    useClarioAuth();

  const isHome = pathname === "/";
  const navItems = MODE_NAV_CONFIG[currentMode] || MODE_NAV_CONFIG.personal;
  const activeItemId = isHome
    ? activeView || "overview"
    : navItems.find((n) => n.href === pathname)?.id || "overview";

  const handleNavClick = (item: NavItem) => {
    if (isHome && onViewChange) {
      onViewChange(item.id);
    } else {
      router.push(item.href);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-[#121212] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand + Mode Switcher */}
        <div className="flex items-center gap-4 sm:gap-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <ClarioLogo
              size={36}
              className="transition group-hover:translate-x-[1px] group-hover:translate-y-[1px]"
            />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-[#121212] uppercase flex items-center gap-1.5">
                Clario
                <span className="relative overflow-hidden text-[10px] font-black uppercase text-[#836EF9] bg-[#f3f0ff] px-2.5 py-0.5 rounded-full border-1.5 border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1">
                  <MonadLogo className="h-3 w-3" />
                  Monad
                  <BorderTrail
                    size={24}
                    className="bg-[#836EF9]"
                    transition={{
                      repeat: Infinity,
                      duration: 3.5,
                      ease: "linear",
                    }}
                  />
                </span>
              </span>
            </div>
          </Link>

          <ModeSwitcher currentMode={currentMode} onModeChange={onModeChange} />
        </div>

        {/* Center: Mode-Aware Main Navigation with Sliding Active Indicator */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-[#f9fafb] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl">
          <AnimatedBackground
            defaultValue={activeItemId}
            className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItemId === item.id;

              return (
                <button
                  key={item.id}
                  data-id={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`flex items-center gap-1.5 rounded-lg pl-2 pr-2.5 py-1.5 text-xs font-black uppercase tracking-wider transition-colors duration-150 ease-out active:scale-[0.96] ${
                    isActive
                      ? "text-white"
                      : "text-[#121212] hover:text-[#836EF9]"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 stroke-[2.5] ${isActive ? "text-white" : "text-[#121212]"}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </AnimatedBackground>
        </nav>

        {/* Right: Tour, Proof Center, Copilot & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 text-xs font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] transition-colors duration-150 ease-out hover:bg-slate-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none active:scale-[0.96]"
          >
            <span>Tour</span>
          </Link>

          <Magnetic range={70} intensity={0.35}>
            <button
              onClick={() => onOpenCopilot && onOpenCopilot()}
              className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#f3f0ff] pl-3 pr-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-[#836EF9] shadow-[2px_2px_0_0_#121212] transition-colors duration-150 ease-out hover:bg-[#ebe5ff] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none active:scale-[0.96]"
            >
              <Bot className="h-3.5 w-3.5 text-[#836EF9] stroke-[2.5]" aria-hidden="true" />
              <span>Clario</span>
            </button>
          </Magnetic>

          {isAuthenticated && !hasConnectedEvmWallet && (
            <button
              type="button"
              onClick={connectEvmWallet}
              className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] pl-2.5 pr-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition-colors duration-150 ease-out active:translate-x-[1px] active:translate-y-[1px] active:scale-[0.96] cursor-pointer"
              title="Connect your EVM wallet for on-chain actions"
            >
              <Wallet className="h-3.5 w-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Wallet</span>
            </button>
          )}

          <Magnetic range={50} intensity={0.3}>
            <UserButton />
          </Magnetic>
        </div>
      </div>

      {/* Mobile/Tablet Sub-Navigation Scrollbar */}
      <div className="lg:hidden flex items-center gap-1.5 px-4 py-2 border-t border-[#121212]/10 overflow-x-auto no-scrollbar bg-white">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isHome
            ? activeView
              ? activeView === item.id
              : item.id === "overview"
            : pathname === item.href;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              className={`flex items-center gap-1.5 shrink-0 rounded-lg pl-2 pr-2.5 py-1 text-[11px] font-black uppercase tracking-wider transition-colors duration-150 ease-out active:scale-[0.96] ${
                isActive
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-[#121212] border border-transparent hover:border-[#121212] hover:bg-[#f3f4f6]"
              }`}
            >
              <Icon
                className={`h-3 w-3 stroke-[2.5] ${isActive ? "text-white" : "text-[#121212]"}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
