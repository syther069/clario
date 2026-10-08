"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Download,
  ChevronUp,
  FileSpreadsheet,
  FileCode,
  FileText,
  FileCheck2,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  type ExportFormat,
  type NormalizedReceiptData,
  triggerReceiptExport,
} from "@/lib/export/receipt-exporter";

interface ReceiptExportDropdownProps {
  receiptData: NormalizedReceiptData;
  className?: string;
  size?: "sm" | "md";
}

interface FormatOption {
  format: ExportFormat;
  label: string;
  extension: string;
  description: string;
  icon: React.ReactNode;
  badgeBg: string;
  badgeColor: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: "pdf",
    label: "PDF Receipt",
    extension: ".PDF",
    description: "Formatted human-readable proof document",
    icon: <FileCheck2 className="h-4 w-4 text-[#ef4444]" />,
    badgeBg: "bg-red-50",
    badgeColor: "text-red-600 border-red-200",
  },
  {
    format: "csv",
    label: "CSV Spreadsheet",
    extension: ".CSV",
    description: "Itemized transactions with metadata",
    icon: <FileSpreadsheet className="h-4 w-4 text-[#15803d]" />,
    badgeBg: "bg-emerald-50",
    badgeColor: "text-emerald-700 border-emerald-200",
  },
  {
    format: "png",
    label: "PNG Image",
    extension: ".PNG",
    description: "Visual high-DPI receipt card image",
    icon: <ImageIcon className="h-4 w-4 text-[#836EF9]" />,
    badgeBg: "bg-purple-50",
    badgeColor: "text-[#836EF9] border-[#836EF9]/30",
  },
  {
    format: "json",
    label: "JSON Canonical Data",
    extension: ".JSON",
    description: "Full structured payload & Monad proof",
    icon: <FileCode className="h-4 w-4 text-[#836EF9]" />,
    badgeBg: "bg-[#f3f0ff]",
    badgeColor: "text-[#836EF9] border-[#836EF9]/30",
  },
  {
    format: "txt",
    label: "Plain Text Document",
    extension: ".TXT",
    description: "Clean readable text proof ledger",
    icon: <FileText className="h-4 w-4 text-slate-700" />,
    badgeBg: "bg-slate-100",
    badgeColor: "text-slate-700 border-slate-300",
  },
];

export function ReceiptExportDropdown({
  receiptData,
  className = "",
  size = "md",
}: ReceiptExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<ExportFormat | null>(
    null,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  const handleSelectFormat = async (fmt: ExportFormat) => {
    setActiveFormat(fmt);
    try {
      await triggerReceiptExport(receiptData, fmt);
      setDownloadSuccess(fmt);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsOpen(false);
      setTimeout(() => {
        setDownloadSuccess(null);
      }, 2500);
    }
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={`neo-btn neo-btn-secondary ${
          isSmall ? "!py-1.5 !px-2.5 text-[11px]" : "!py-2 !px-3 text-xs"
        } font-mono font-black uppercase flex items-center gap-2 shadow-[2px_2px_0_0_#121212] select-none cursor-pointer transition-all hover:bg-[#faf5ff] active:translate-x-[1px] active:translate-y-[1px]`}
      >
        <Download className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
        <span>Export Receipt</span>
        <ChevronUp
          className={`h-3 w-3 text-[#121212] transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-[#836EF9]" : ""
          }`}
        />
      </button>

      {/* Drop-up Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={menuId}
            role="menu"
            aria-orientation="vertical"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 450, damping: 26 }}
            className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-xl border-2 border-[#121212] bg-white p-2 shadow-[4px_4px_0_0_#121212]"
          >
            {/* Menu Header */}
            <div className="px-2.5 py-1.5 pb-2 border-b border-slate-200 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-500">
                Choose Format
              </span>
              <span className="text-[9px] font-mono font-bold text-[#836EF9] bg-[#f3f0ff] px-1.5 py-0.5 rounded border border-[#836EF9]/30">
                4 Available
              </span>
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              {FORMAT_OPTIONS.map((opt) => {
                const isRecentlyDownloaded = downloadSuccess === opt.format;

                return (
                  <button
                    key={opt.format}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectFormat(opt.format)}
                    className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition cursor-pointer hover:bg-[#fbf9fe] hover:border-[#836EF9]/40 border border-transparent group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 p-1 rounded-md bg-white border border-[#121212]/20 shadow-[1px_1px_0_0_#121212] group-hover:border-[#836EF9] shrink-0">
                        {opt.icon}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-black uppercase text-[#121212] group-hover:text-[#836EF9] transition-colors">
                            {opt.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-sans text-slate-500 truncate mt-0.5">
                          {opt.description}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center pl-1">
                      {isRecentlyDownloaded ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${opt.badgeBg} ${opt.badgeColor}`}
                        >
                          {opt.extension}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Menu Footer */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 px-2 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>Canonical data</span>
              <span>Monad Testnet</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
