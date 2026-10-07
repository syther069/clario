"use client";

import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

interface ToolbarExpandableContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const ToolbarExpandableContext = createContext<ToolbarExpandableContextType | null>(
  null,
);

export function useToolbarExpandable() {
  const context = useContext(ToolbarExpandableContext);
  if (!context) {
    throw new Error(
      "useToolbarExpandable must be used within a ToolbarExpandable",
    );
  }
  return context;
}

export interface ToolbarExpandableProps {
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  transition?: Transition;
}

const DEFAULT_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 32,
};

export function ToolbarExpandable({
  children,
  className,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  transition = DEFAULT_SPRING,
}: ToolbarExpandableProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : uncontrolledExpanded;

  const setIsExpanded = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledExpanded(next);
    }
    onExpandedChange?.(next);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  return (
    <ToolbarExpandableContext.Provider value={{ isExpanded, setIsExpanded }}>
      <motion.div
        ref={containerRef}
        layout
        transition={transition}
        className={cn(
          "inline-flex items-center rounded-xl border-2 border-[#121212] bg-white shadow-[3px_3px_0_0_#121212] overflow-hidden transition-colors",
          className,
        )}
      >
        {children}
      </motion.div>
    </ToolbarExpandableContext.Provider>
  );
}

export interface ToolbarCollapsedProps {
  children: React.ReactNode;
  className?: string;
}

export function ToolbarCollapsed({ children, className }: ToolbarCollapsedProps) {
  const { isExpanded } = useToolbarExpandable();

  return (
    <AnimatePresence initial={false}>
      {!isExpanded && (
        <motion.div
          key="collapsed"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn("flex items-center gap-1.5 p-1.5", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ToolbarExpandedProps {
  children: React.ReactNode;
  className?: string;
}

export function ToolbarExpanded({ children, className }: ToolbarExpandedProps) {
  const { isExpanded } = useToolbarExpandable();

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className={cn("flex items-center gap-2 p-2", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ToolbarToggleProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function ToolbarToggle({ children, className, onClick }: ToolbarToggleProps) {
  const { isExpanded, setIsExpanded } = useToolbarExpandable();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
        onClick?.();
      }}
      className={cn(
        "inline-flex items-center justify-center font-mono text-[10px] uppercase font-black transition-colors focus:outline-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

