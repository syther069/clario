"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface NeoDatePickerProps {
  value: string; // ISO format "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NeoDatePicker({
  value,
  onChange,
  placeholder = "Select Date",
  label,
  className = "",
  buttonClassName = "",
  disabled = false,
  fullWidth = false,
}: NeoDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current selected date or fallback to today
  const selectedDate = value ? new Date(value + "T00:00:00") : null;
  const initialYear = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
  const initialMonth = selectedDate ? selectedDate.getMonth() : new Date().getMonth();

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
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

  // Generate calendar days matrix for current Month & Year
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? currentYear - 1 : currentYear,
    currentMonth === 0 ? 11 : currentMonth - 1
  );

  const calendarCells = [];

  // Padding days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthDays - i,
      month: currentMonth === 0 ? 11 : currentMonth - 1,
      year: currentMonth === 0 ? currentYear - 1 : currentYear,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({
      day: d,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true,
    });
  }

  // Padding days for next month to complete grid (up to 42 cells)
  const remaining = 42 - calendarCells.length;
  for (let n = 1; n <= remaining; n++) {
    calendarCells.push({
      day: n,
      month: currentMonth === 11 ? 0 : currentMonth + 1,
      year: currentMonth === 11 ? currentYear + 1 : currentYear,
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (cell: { day: number; month: number; year: number }) => {
    const formattedMonth = String(cell.month + 1).padStart(2, "0");
    const formattedDay = String(cell.day).padStart(2, "0");
    const dateStr = `${cell.year}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const formattedValueLabel = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : placeholder;

  return (
    <div
      className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`}
      ref={popoverRef}
    >
      {label && (
        <label className="block text-[11px] font-mono font-black uppercase tracking-wider text-[#121212] mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex items-center justify-between gap-2 border-2 border-[#121212] rounded-lg text-xs font-mono font-black uppercase tracking-wider bg-white text-[#121212] shadow-[2px_2px_0_0_#121212] transition-all hover:bg-[#faf5ff] focus:outline-none focus:ring-2 focus:ring-[#836EF9] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } px-3 py-1.5 ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
          <span className="truncate">{formattedValueLabel}</span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="absolute left-0 mt-1.5 z-50 w-72 rounded-2xl border-2 border-[#121212] bg-white p-3 shadow-[6px_6px_0_0_#121212] text-[#121212]"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-[#121212]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md border border-[#121212] hover:bg-[#f3f0ff] hover:text-[#836EF9] transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-mono font-black uppercase tracking-wider text-[#121212]">
                {MONTHS[currentMonth]} {currentYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md border border-[#121212] hover:bg-[#f3f0ff] hover:text-[#836EF9] transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAYS_OF_WEEK.map((day) => (
                <span
                  key={day}
                  className="text-[10px] font-mono font-bold text-slate-400 uppercase"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.slice(0, 35).map((cell, idx) => {
                const formattedMonth = String(cell.month + 1).padStart(2, "0");
                const formattedDay = String(cell.day).padStart(2, "0");
                const cellDateStr = `${cell.year}-${formattedMonth}-${formattedDay}`;

                const isSelected = value === cellDateStr;
                const isToday =
                  cellDateStr === new Date().toISOString().split("T")[0];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell)}
                    className={`h-7 w-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center mx-auto cursor-pointer ${
                      isSelected
                        ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                        : isToday
                          ? "border border-[#836EF9] text-[#836EF9] font-black"
                          : cell.isCurrentMonth
                            ? "text-[#121212] hover:bg-[#f3f0ff] hover:text-[#836EF9]"
                            : "text-slate-300"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="mt-3 pt-2 border-t-2 border-[#121212] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const todayStr = new Date().toISOString().split("T")[0]!;
                  onChange(todayStr);
                  setIsOpen(false);
                }}
                className="text-[10px] font-mono font-black uppercase text-[#836EF9] hover:underline"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="text-[10px] font-mono font-black uppercase text-slate-400 hover:text-rose-600"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
