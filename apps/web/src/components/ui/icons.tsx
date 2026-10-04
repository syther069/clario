import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Receipt,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CircleX,
  AlertTriangle,
  TriangleAlert,
  ShieldCheck,
  Lock,
  Search,
  Settings,
  Bell,
  Bot,
  Upload,
  Download,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Ellipsis,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Copy,
  Users,
  UserRound,
  UsersRound,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  FileText,
  Calendar,
  CalendarDays,
  Target,
  HandCoins,
  CreditCard,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Filter,
  PieChart,
} from "lucide-react";

/**
 * Standard Clario Icon Sizes (in pixels)
 * Following Lucide Icon Guide:
 * 12px -> micro metadata
 * 14px -> compact controls
 * 16px -> standard UI
 * 18px -> navigation / prominent controls
 * 20px -> buttons / cards
 * 24px -> empty states / feature icons
 * 32px+ -> hero illustrations
 */
export const ICON_SIZES = {
  micro: 12,
  compact: 14,
  standard: 16,
  nav: 18,
  button: 20,
  empty: 24,
  hero: 32,
} as const;

/**
 * Platform Mode Semantic Mapping
 * Personal -> UserRound
 * Freelancer -> BriefcaseBusiness
 * Family -> UsersRound
 * Business -> Building2
 * Crypto -> Wallet
 */
export const MODE_ICONS: Record<string, LucideIcon> = {
  personal: UserRound,
  freelancer: BriefcaseBusiness,
  family: UsersRound,
  business: Building2,
  crypto: Wallet,
};

/**
 * Transaction Type Semantic Mapping
 */
export const TRANSACTION_TYPE_ICONS: Record<string, LucideIcon> = {
  income: TrendingUp,
  expense: TrendingDown,
  transfer: ArrowLeftRight,
  payment: CreditCard,
  wallet: Wallet,
  receipt: Receipt,
};

/**
 * Verification & Status Icons
 * Never use color alone - always accompany with icon + text label.
 */
export const STATUS_ICONS = {
  verified: BadgeCheck,
  confirmed: CheckCircle2,
  pending: Clock,
  failed: CircleX,
  warning: TriangleAlert,
  security: ShieldCheck,
  privacy: Lock,
};

/**
 * Primary Actions Semantic Mapping
 */
export const ACTION_ICONS = {
  search: Search,
  filter: Filter,
  settings: Settings,
  notifications: Bell,
  ai: Bot,
  upload: Upload,
  download: Download,
  external: ExternalLink,
  refresh: RefreshCw,
  add: Plus,
  delete: Trash2,
  edit: Pencil,
  more: Ellipsis,
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,
  check: Check,
  copy: Copy,
};

export {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Receipt,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CircleX,
  AlertTriangle,
  TriangleAlert,
  ShieldCheck,
  Lock,
  Search,
  Settings,
  Bell,
  Bot,
  Upload,
  Download,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Ellipsis,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Copy,
  Users,
  UserRound,
  UsersRound,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  FileText,
  Calendar,
  CalendarDays,
  Target,
  HandCoins,
  CreditCard,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Filter,
  PieChart,
};
