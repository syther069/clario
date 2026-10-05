"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface NeoSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface NeoSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NeoSelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  direction?: "down" | "up";
  align?: "left" | "right";
}

export function NeoSelect({
  value,
  onChange,
  options,
  placeholder = "Select Option",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  icon,
  disabled = false,
  fullWidth = false,
  size = "md",
  label,
  direction = "down",
  align = "left",
}: NeoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex((opt) => opt.value === value);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1
        );
        break;
      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          const opt = options[highlightedIndex];
          if (opt && !opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
          }
        }
        break;
    }
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-3 py-1.5 text-xs",
    lg: "px-3.5 py-2 text-xs sm:text-sm",
  }[size];

  return (
    <div
      className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`}
      ref={dropdownRef}
    >
      {label && (
        <label className="block text-[11px] font-mono font-black uppercase tracking-wider text-[#121212] mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        className={`flex items-center justify-between gap-2.5 border-2 border-[#121212] rounded-lg font-mono font-black uppercase tracking-wider bg-white text-[#121212] shadow-[2px_2px_0_0_#121212] transition-all hover:bg-[#faf5ff] focus:outline-none focus:ring-2 focus:ring-[#836EF9] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } ${sizeClasses} ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0 text-[#836EF9]">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#121212] transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-[#836EF9]" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            initial={{
              opacity: 0,
              scale: 0.96,
              y: direction === "up" ? 6 : -6,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: direction === "up" ? 6 : -6,
            }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={`absolute ${align === "right" ? "right-0" : "left-0"} ${
              direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } z-50 ${
              fullWidth ? "w-full" : "w-max min-w-[200px] max-w-[320px]"
            } rounded-xl border-2 border-[#121212] bg-white p-1.5 shadow-[4px_4px_0_0_#121212] max-h-60 overflow-y-auto ${menuClassName}`}
          >
            <div className="space-y-1">
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setIsOpen(false);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-mono font-black uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-[#f3f0ff] text-[#836EF9] border border-[#836EF9]/50 shadow-[1px_1px_0_0_#121212]"
                        : isHighlighted
                          ? "bg-[#faf5ff] text-[#836EF9] border border-[#121212]/20"
                          : "text-[#121212] hover:bg-[#faf5ff] hover:text-[#836EF9] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="truncate flex flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] font-normal text-slate-500 normal-case truncate">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
