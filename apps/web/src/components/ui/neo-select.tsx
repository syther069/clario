"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface NeoSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
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
}: NeoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-2.5 px-3 py-1.5 border-2 border-[#121212] rounded-lg text-xs font-mono font-black uppercase tracking-wider bg-white text-[#121212] shadow-[2px_2px_0_0_#121212] transition-all hover:bg-[#faf5ff] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none cursor-pointer ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#121212] transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180 text-[#836EF9]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 mt-1.5 w-max min-w-[200px] max-w-[280px] rounded-xl border-2 border-[#121212] bg-white p-1.5 shadow-[4px_4px_0_0_#121212] z-50 animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
        >
          <div className="space-y-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-mono font-black uppercase tracking-wider transition cursor-pointer ${
                    isSelected
                      ? "bg-[#f3f0ff] text-[#836EF9] border border-[#836EF9]/50 shadow-[1px_1px_0_0_#121212]"
                      : "text-[#121212] hover:bg-[#faf5ff] hover:text-[#836EF9] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
