"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Bot } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";

interface ClarioAssistantTriggerProps {
  onOpen: () => void;
  isOpen: boolean;
}

export function ClarioAssistantTrigger({
  onOpen,
  isOpen,
}: ClarioAssistantTriggerProps) {
  const [showGreeting, setShowGreeting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Trigger assistant greeting popup after a short entrance delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDismissed && !isOpen) {
        setShowGreeting(true);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [isDismissed, isOpen]);

  // When drawer opens, hide greeting popup
  useEffect(() => {
    if (isOpen) {
      setShowGreeting(false);
    }
  }, [isOpen]);

  const handleDismissGreeting = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGreeting(false);
    setIsDismissed(true);
  };

  const handleTriggerClick = () => {
    setShowGreeting(false);
    onOpen();
  };

  return (
    <aside
      aria-label="Clario Assistant"
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-none"
    >
      {/* Assistant-style Popup Above the Clario Button */}
      <AnimatePresence>
        {showGreeting && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 26,
              mass: 0.8,
            }}
            className="pointer-events-auto relative mb-3.5 max-w-[280px] sm:max-w-xs origin-bottom-right"
          >
            <div
              onClick={handleTriggerClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTriggerClick();
                }
              }}
              className="cursor-pointer group relative rounded-2xl border-2 border-[#121212] bg-white p-3.5 shadow-[4px_4px_0_0_#121212] transition-all duration-200 hover:shadow-[5px_5px_0_0_#836EF9] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_0_#121212]"
            >
              <div className="flex items-start gap-2.5">
                {/* Assistant Mini Icon */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#f4f0ff] text-[#836EF9] shadow-[1px_1px_0_0_#121212]">
                  <Sparkles className="h-4 w-4 fill-[#836EF9]/20" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#836EF9] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#836EF9] border border-white" />
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#836EF9]">
                      Clario
                    </span>
                    <span className="inline-block h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-[9px] font-mono uppercase font-bold text-slate-500">
                      Assistant
                    </span>
                  </div>
                  {/* Exact prompt text */}
                  <p className="text-xs font-black text-[#121212] tracking-tight leading-snug">
                    Need a hand??
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight font-medium">
                    Tap to ask ledger, budget, or invoice questions.
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={handleDismissGreeting}
                  aria-label="Dismiss greeting"
                  className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-[#121212] hover:bg-slate-100 border border-transparent hover:border-[#121212] transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Speech bubble indicator / tail pointing to circular button */}
              <div
                aria-hidden="true"
                className="absolute -bottom-[9px] right-6 h-4 w-4 rotate-45 border-r-2 border-b-2 border-[#121212] bg-white"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circular Clario Assistant Button */}
      <div className="pointer-events-auto relative">
        <motion.button
          type="button"
          onClick={handleTriggerClick}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.94, y: 1 }}
          transition={{
            type: "spring",
            stiffness: 450,
            damping: 24,
            mass: 0.7,
          }}
          aria-label="Open Clario Assistant"
          className="group relative flex h-14 w-14 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 border-[#121212] bg-[#836EF9] text-white shadow-[4px_4px_0_0_#121212] transition-colors hover:bg-[#7257f8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9] focus-visible:ring-offset-2 active:shadow-[1px_1px_0_0_#121212]"
        >
          {/* Subtle Outer Glow Rings on hover */}
          <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />

          {/* Assistant Icon */}
          <div className="relative flex items-center justify-center">
            <Bot className="h-6 w-6 text-white transition-transform duration-200 group-hover:rotate-6" aria-hidden="true" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-300 fill-amber-300 animate-pulse" aria-hidden="true" />
          </div>

          {/* Monad Verified Badge Dot */}
          <span
            title="Monad Native"
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#121212] bg-white text-[#836EF9] shadow-[1px_1px_0_0_#121212]"
          >
            <MonadLogo className="h-2 w-2" />
          </span>
        </motion.button>
      </div>
    </aside>
  );
}
