"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type AlertVariant = "default" | "success" | "warning" | "error" | "info" | "monad";

export interface WatermelonAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; iconColor: string; defaultIcon: React.ReactNode }> = {
  default: {
    container: "bg-white text-[#121212] border-[#121212]",
    iconColor: "text-[#121212]",
    defaultIcon: <Info className="h-5 w-5" />,
  },
  info: {
    container: "bg-[#f0f7ff] text-[#0055d4] border-[#121212]",
    iconColor: "text-[#0055d4]",
    defaultIcon: <Info className="h-5 w-5" />,
  },
  success: {
    container: "bg-[#f0fdf4] text-[#166534] border-[#121212]",
    iconColor: "text-[#15803d]",
    defaultIcon: <CheckCircle2 className="h-5 w-5" />,
  },
  warning: {
    container: "bg-[#fffbeb] text-[#92400e] border-[#121212]",
    iconColor: "text-[#b45309]",
    defaultIcon: <TriangleAlert className="h-5 w-5" />,
  },
  error: {
    container: "bg-[#fef2f2] text-[#991b1b] border-[#121212]",
    iconColor: "text-[#dc2626]",
    defaultIcon: <AlertCircle className="h-5 w-5" />,
  },
  monad: {
    container: "bg-[#f5f3ff] text-[#4c1d95] border-[#121212]",
    iconColor: "text-[#836EF9]",
    defaultIcon: <CheckCircle2 className="h-5 w-5" />,
  },
};

export function WatermelonAlert({
  variant = "default",
  title,
  description,
  icon,
  onClose,
  action,
  className,
  children,
  ...props
}: WatermelonAlertProps) {
  const currentVariant = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="alert"
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-xl border-2 shadow-[3px_3px_0_0_#121212] transition-all",
        currentVariant.container,
        className
      )}
      {...(props as any)}
    >
      <div className={cn("shrink-0 mt-0.5", currentVariant.iconColor)}>
        {icon || currentVariant.defaultIcon}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h5 className="font-mono text-xs font-black uppercase tracking-wider mb-0.5">
            {title}
          </h5>
        )}
        {description && (
          <div className="text-xs font-medium opacity-90 leading-relaxed">
            {description}
          </div>
        )}
        {children}
      </div>

      {action && <div className="shrink-0 ml-2">{action}</div>}

      {onClose && (
        <button
          onClick={onClose}
          type="button"
          aria-label="Dismiss alert"
          className="shrink-0 p-1 rounded-md border border-transparent hover:border-[#121212] hover:bg-black/5 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
