"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useId,
  useEffect,
} from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

interface MorphingPopoverContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  uniqueId: string;
}

const MorphingPopoverContext = createContext<MorphingPopoverContextType | null>(
  null,
);

export function useMorphingPopover() {
  const context = useContext(MorphingPopoverContext);
  if (!context) {
    throw new Error(
      "useMorphingPopover must be used within a MorphingPopover",
    );
  }
  return context;
}

export interface MorphingPopoverProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  transition?: Transition;
}

const DEFAULT_SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
};

export function MorphingPopover({
  children,
  className,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  transition = DEFAULT_SPRING,
}: MorphingPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const uniqueId = useId();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <MorphingPopoverContext.Provider value={{ isOpen, setIsOpen, uniqueId }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </MorphingPopoverContext.Provider>
  );
}

export interface MorphingPopoverTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function MorphingPopoverTrigger({
  children,
  className,
}: MorphingPopoverTriggerProps) {
  const { isOpen, setIsOpen, uniqueId } = useMorphingPopover();

  return (
    <motion.button
      layoutId={`popover-trigger-${uniqueId}`}
      type="button"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(!isOpen)}
      className={cn("outline-none cursor-pointer", className)}
    >
      {children}
    </motion.button>
  );
}

export interface MorphingPopoverContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MorphingPopoverContent({
  children,
  className,
}: MorphingPopoverContentProps) {
  const { isOpen, setIsOpen, uniqueId } = useMorphingPopover();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={contentRef}
          layoutId={`popover-trigger-${uniqueId}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={DEFAULT_SPRING}
          className={cn(
            "absolute z-50 mt-2 rounded-xl border-2 border-[#121212] bg-white p-4 shadow-[4px_4px_0_0_#121212]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
