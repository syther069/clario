"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ContextualIconSwapProps {
  isActive: boolean;
  ActiveIcon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  InactiveIcon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  activeIcon?: React.ReactNode;
  initialIcon?: React.ReactNode;
  inactiveIcon?: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  strokeWidth?: number | string;
}

export function ContextualIconSwap({
  isActive,
  ActiveIcon,
  InactiveIcon,
  activeIcon,
  initialIcon,
  inactiveIcon,
  className,
  activeClassName,
  inactiveClassName,
  strokeWidth,
}: ContextualIconSwapProps) {
  const shouldReduceMotion = useReducedMotion();
  const strokeProp = strokeWidth !== undefined ? { strokeWidth } : {};

  const renderContent = (active: boolean) => {
    if (active) {
      if (activeIcon) return activeIcon;
      if (ActiveIcon) {
        return (
          <ActiveIcon
            className={cn(className, activeClassName)}
            {...strokeProp}
          />
        );
      }
    } else {
      const fallback = initialIcon ?? inactiveIcon;
      if (fallback) return fallback;
      if (InactiveIcon) {
        return (
          <InactiveIcon
            className={cn(className, inactiveClassName)}
            {...strokeProp}
          />
        );
      }
    }
    return null;
  };

  if (shouldReduceMotion) {
    return (
      <span className={cn("inline-flex items-center justify-center shrink-0", className)}>
        {renderContent(isActive)}
      </span>
    );
  }

  return (
    <span className={cn("relative inline-flex items-center justify-center shrink-0", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={isActive ? "active" : "inactive"}
          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          className="inline-flex items-center justify-center shrink-0"
        >
          {renderContent(isActive)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
