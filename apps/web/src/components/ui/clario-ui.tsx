"use client";

import React, { forwardRef } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. CLARIO BUTTON
// ============================================================================

export interface ClarioButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "dark"
    | "outline"
    | "ghost"
    | "danger"
    | "success";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode;
  isStatic?: boolean;
}

export const ClarioButton = forwardRef<HTMLButtonElement, ClarioButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      isLoading = false,
      loading,
      loadingText,
      leftIcon,
      rightIcon,
      icon,
      isStatic = false,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isBusy = isLoading || Boolean(loading);
    const startIcon = leftIcon || icon;

    const baseStyles = cn(
      "relative inline-flex items-center justify-center font-mono font-black uppercase tracking-wider transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9] focus-visible:ring-offset-2",
      !isStatic && "active:not-disabled:scale-[0.96]",
    );

    const variantStyles = {
      primary:
        "border-2 border-[#121212] bg-[#836EF9] text-white shadow-[3px_3px_0_0_#121212] hover:bg-[#7257f8] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      secondary:
        "border-2 border-[#121212] bg-[#ffffff] text-[#121212] shadow-[3px_3px_0_0_#121212] hover:bg-[#f3f4f6] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      dark: "border-2 border-[#121212] bg-[#836EF9] text-white shadow-[3px_3px_0_0_#121212] hover:bg-[#7257f8] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      outline:
        "border-2 border-[#121212] bg-transparent text-[#121212] hover:bg-[#121212]/5 active:translate-x-[1px] active:translate-y-[1px]",
      ghost:
        "border-2 border-transparent text-[#121212] hover:bg-[#121212]/5 hover:border-[#121212]/20",
      danger:
        "border-2 border-[#121212] bg-[#ef4444] text-white shadow-[3px_3px_0_0_#121212] hover:bg-[#dc2626] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      success:
        "border-2 border-[#121212] bg-[#10b981] text-white shadow-[3px_3px_0_0_#121212] hover:bg-[#059669] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    };

    const sizeStyles = {
      sm: "h-8 px-2.5 text-[11px] rounded-lg gap-1.5",
      md: "h-10 px-4 text-xs rounded-xl gap-2",
      lg: "h-12 px-6 text-sm rounded-xl gap-2.5",
      icon: "h-9 w-9 p-0 rounded-lg justify-center relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2",
    };

    const opticalPadding =
      size === "icon"
        ? ""
        : startIcon && !rightIcon
          ? size === "sm"
            ? "!pl-2 !pr-2.5"
            : size === "md"
              ? "!pl-3.5 !pr-4"
              : "!pl-5 !pr-6"
          : rightIcon && !startIcon
            ? size === "sm"
              ? "!pl-2.5 !pr-2"
              : size === "md"
                ? "!pl-4 !pr-3.5"
                : "!pl-6 !pr-5"
            : "";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isBusy}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          opticalPadding,
          className,
        )}
        {...props}
      >
        {isBusy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {startIcon && <span className="shrink-0">{startIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);
ClarioButton.displayName = "ClarioButton";

// ============================================================================
// 2. CLARIO BADGE
// ============================================================================

export interface ClarioBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    "neutral" | "purple" | "green" | "yellow" | "red" | "verified" | "local";
  size?: "sm" | "md";
  hasDot?: boolean;
}

export function ClarioBadge({
  children,
  className,
  variant = "neutral",
  size = "sm",
  hasDot = false,
  ...props
}: ClarioBadgeProps) {
  const variantStyles = {
    neutral: "bg-[#f3f4f6] text-[#374151] border-[#121212]/30",
    purple: "bg-[#f3f0ff] text-[#836EF9] border-[#836EF9]/50",
    green: "bg-[#dcfce7] text-[#15803d] border-[#15803d]/50",
    yellow: "bg-[#fef9c3] text-[#a16207] border-[#a16207]/50",
    red: "bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]/50",
    verified: "bg-[#dcfce7] text-[#15803d] border-[#121212] font-black",
    local: "bg-[#f3f4f6] text-[#6b7280] border-[#121212] font-bold",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono uppercase tracking-wider rounded-md border font-bold shadow-[1px_1px_0_0_#121212]",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {hasDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "purple" && "bg-[#836EF9]",
            variant === "green" && "bg-[#15803d]",
            variant === "verified" && "bg-[#10b981]",
            variant === "yellow" && "bg-[#a16207]",
            variant === "red" && "bg-[#b91c1c]",
            variant === "neutral" && "bg-gray-500",
            variant === "local" && "bg-gray-400",
          )}
        />
      )}
      {children}
    </span>
  );
}

// ============================================================================
// 3. CLARIO CARD SYSTEM
// ============================================================================

export interface ClarioCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "flat" | "elevated";
  isInteractive?: boolean;
}

export function ClarioCard({
  children,
  className,
  variant = "default",
  isInteractive = false,
  ...props
}: ClarioCardProps) {
  const variantStyles = {
    default:
      "rounded-2xl border-2 border-[#121212] bg-white shadow-[4px_4px_0_0_#121212]",
    flat: "rounded-xl border-2 border-[#121212] bg-white shadow-none",
    elevated:
      "rounded-2xl border-2 border-[#121212] bg-white shadow-[6px_6px_0_0_#121212]",
  };

  return (
    <div
      className={cn(
        variantStyles[variant],
        isInteractive &&
          "transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#121212] cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ClarioCardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-5 border-b-2 border-[#121212]/15 flex items-center justify-between gap-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ClarioCardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-black tracking-tight text-[#121212] uppercase font-sans",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function ClarioCardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-gray-500 font-mono mt-0.5", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function ClarioCardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function ClarioCardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-3.5 border-t-2 border-[#121212]/15 bg-[#f8f9fa] rounded-b-[14px] flex items-center justify-between text-xs font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// 4. CLARIO METRIC CARD
// ============================================================================

export interface ClarioMetricProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  badge?: string;
  className?: string;
}

export function ClarioMetric({
  label,
  value,
  subValue,
  trend,
  icon,
  badge,
  className,
}: ClarioMetricProps) {
  return (
    <ClarioCard className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-mono font-black uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <ClarioBadge variant="purple" size="sm">
              {badge}
            </ClarioBadge>
          )}
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-1.5 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[1px_1px_0_0_#121212]">
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-[#121212]">
          {value}
        </span>

        {trend && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs font-mono font-black px-2 py-0.5 rounded border-1.5 shadow-[1px_1px_0_0_#121212]",
              trend.isPositive
                ? "bg-[#dcfce7] text-[#15803d] border-[#15803d]"
                : "bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]",
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {subValue && (
        <p className="text-[11px] font-mono text-gray-500 mt-2 truncate">
          {subValue}
        </p>
      )}
    </ClarioCard>
  );
}

// ============================================================================
// 5. CLARIO TABS SYSTEM
// ============================================================================

export interface ClarioTabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface ClarioTabsProps {
  items: readonly ClarioTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function ClarioTabs({
  items,
  activeTab,
  onChange,
  className,
}: ClarioTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex flex-wrap items-center gap-1.5 p-1 rounded-xl border-2 border-[#121212] bg-[#f8f9fa] shadow-[2px_2px_0_0_#121212]",
        className,
      )}
    >
      {items.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider transition-[background-color,color,box-shadow,border-color] duration-150 ease-out",
              isActive
                ? "bg-[#836EF9] text-white border-1.5 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                : "text-gray-600 hover:text-[#121212] hover:bg-white/60",
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-mono font-black",
                  isActive
                    ? "bg-white text-[#836EF9]"
                    : "bg-gray-200 text-gray-700",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// 6. CLARIO EMPTY STATE
// ============================================================================

export interface ClarioEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  className?: string;
}

export function ClarioEmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  className,
}: ClarioEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-[#121212]/30 bg-[#ffffff] p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6 shadow-[3px_3px_0_0_#121212]/10",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[2px_2px_0_0_#121212] mb-4">
          {icon}
        </div>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[2px_2px_0_0_#121212] mb-4">
          <HelpCircle className="h-6 w-6" />
        </div>
      )}

      <h4 className="text-base font-black uppercase tracking-tight text-[#121212] font-sans">
        {title}
      </h4>
      <p className="text-xs text-gray-500 font-mono mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>

      {actionText && onAction && (
        <ClarioButton
          variant="primary"
          size="sm"
          onClick={onAction}
          className="mt-5"
          rightIcon={actionIcon || <ArrowRight className="h-3.5 w-3.5" />}
        >
          {actionText}
        </ClarioButton>
      )}
    </div>
  );
}

// ============================================================================
// 7. CLARIO SKELETON
// ============================================================================

export function ClarioSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-200 border border-[#121212]/10",
        className,
      )}
      {...props}
    />
  );
}

// ============================================================================
// 8. CLARIO STATUS BADGE
// ============================================================================

export interface ClarioStatusProps {
  status: "verified" | "unverified" | "pending" | "confirmed" | "failed";
  label?: string;
  className?: string;
}

export function ClarioStatus({ status, label, className }: ClarioStatusProps) {
  if (status === "verified" || status === "confirmed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#15803d] border border-[#15803d] shadow-[1px_1px_0_0_#15803d]",
          className,
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        <span>{label || "Monad Verified"}</span>
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#fef9c3] text-[#a16207] border border-[#a16207] shadow-[1px_1px_0_0_#a16207]",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{label || "Anchoring..."}</span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c] shadow-[1px_1px_0_0_#b91c1c]",
          className,
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>{label || "Failed"}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280] border border-gray-300",
        className,
      )}
    >
      <span>{label || "Local Record"}</span>
    </span>
  );
}

// ============================================================================
// 9. CLARIO SECTION HEADER
// ============================================================================

export interface ClarioSectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ClarioSectionHeader({
  title,
  description,
  badge,
  action,
  className,
}: ClarioSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-4 border-b-2 border-[#121212]/15",
        className,
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          {badge && (
            <ClarioBadge variant="purple" size="sm">
              {badge}
            </ClarioBadge>
          )}
          <h2 className="text-xl sm:text-2xl font-black text-[#121212] tracking-tight uppercase font-sans">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-2 shrink-0">{action}</div>
      )}
    </div>
  );
}
