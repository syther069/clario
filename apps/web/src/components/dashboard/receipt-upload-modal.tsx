"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import type { ExtractedReceiptData } from "@/lib/ai/gemini-ocr";
import type { Transaction } from "@/lib/supabase/types";
import { ClarioBadge } from "@/components/ui/clario-ui";
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { motion, AnimatePresence } from "motion/react";

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: (tx: Partial<Transaction>) => void;
  userId?: string;
}

export function ReceiptUploadModal({
  isOpen,
  onClose,
  onTransactionCreated,
  userId = "user_default",
}: ReceiptUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{
    sha256Hash: string;
    extractedData: ExtractedReceiptData | null;
    storagePath: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(selectedFile: File) {
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("userId", userId);

      const res = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Upload failed with status ${res.status}`,
        );
      }

      const data = await res.json();
      setResult({
        sha256Hash: data.sha256Hash,
        extractedData: data.extractedData,
        storagePath: data.storagePath,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleSaveAsTransaction() {
    if (!result || !result.extractedData) return;

    setIsSaving(true);
    const ext = result.extractedData;
    const newTx: Partial<Transaction> = {
      user_id: userId,
      type: "expense",
      amount: ext.totalAmount,
      currency: ext.currency || "USD",
      merchant: ext.merchant,
      description: `${ext.merchant} (Receipt OCR)`,
      category: ext.categorySlug || "other",
      category_id: ext.categorySlug || "other",
      date: ext.date || new Date().toISOString().split("T")[0]!,
      timestamp: ext.date || new Date().toISOString(),
      payment_method: ext.paymentMethod || "Card",
      verification_state: "anchored_onchain",
      verification_status: "anchored",
      proof_hash: result.sha256Hash,
      notes: ext.rawTextSummary || "Extracted via Gemini 2.5 Flash OCR",
    };

    setTimeout(() => {
      onTransactionCreated(newTx);
      setIsSaving(false);
      onClose();
    }, 300);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 w-full max-w-xl rounded-2xl border-2 border-[#121212] bg-white shadow-[6px_6px_0_0_#121212] p-6 overflow-hidden text-[#121212]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Upload Receipt or Invoice
                  </h3>
                  <p className="text-xs text-slate-500">
                    Multimodal extraction with SHA-256 proof anchoring.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Upload Dropzone */}
            {!result && (
              <div className="mt-6 space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#121212] bg-[#f8f9fa] p-8 text-center cursor-pointer transition hover:bg-[#f3f0ff]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />

                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-[#836EF9]" />
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Scanning receipt & computing cryptographic hash...
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Gemini 2.5 Flash is extracting merchant, items, and tax
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                        <FileText className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Click to select or drag & drop receipt
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Supports PNG, JPG, WEBP, or PDF
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <WatermelonAlert
                    variant="error"
                    title="Extraction Error"
                    description={error}
                    onClose={() => setError(null)}
                  />
                )}
              </div>
            )}

            {/* Extracted Results Preview */}
            {result && (
              <div className="mt-6 space-y-4">
                <WatermelonAlert
                  variant="monad"
                  title="Cryptographic Proof Anchored"
                  icon={<ShieldCheck className="h-5 w-5 text-[#836EF9]" />}
                  description={
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[280px]">
                        SHA-256: {result.sha256Hash}
                      </span>
                      <ClarioBadge variant="purple" size="sm">
                        Monad Ready
                      </ClarioBadge>
                    </div>
                  }
                />

                {result.extractedData && (
                  <div className="rounded-xl border-2 border-[#121212] bg-[#f8f9fa] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Merchant
                      </span>
                      <span className="text-xs font-black text-[#121212]">
                        {result.extractedData.merchant}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Date
                      </span>
                      <span className="text-xs font-black font-mono text-[#121212]">
                        {result.extractedData.date}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Total Amount
                      </span>
                      <span className="text-base font-black font-mono text-[#15803d]">
                        ${Number(result.extractedData.totalAmount).toFixed(2)}{" "}
                        <span className="text-xs text-slate-500 font-bold">
                          {result.extractedData.currency}
                        </span>
                      </span>
                    </div>
                    {result.extractedData.taxAmount !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          Tax
                        </span>
                        <span className="text-xs font-black font-mono text-[#121212]">
                          ${Number(result.extractedData.taxAmount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {result.extractedData.items?.length > 0 && (
                      <div className="border-t-2 border-[#121212] pt-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Itemized Breakdown
                        </span>
                        <ul className="mt-1.5 space-y-1 text-xs">
                          {result.extractedData.items.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex justify-between text-[#121212] font-medium"
                            >
                              <span>{item.description}</span>
                              <span className="font-mono font-bold">
                                ${Number(item.total).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <WatermelonButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setResult(null);
                    }}
                    morphText="Scan Another"
                  />
                  <WatermelonButton
                    type="button"
                    variant="primary"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    isLoading={isSaving}
                    loadingText="Saving to Ledger..."
                    morphText="Save to Ledger"
                    onClick={handleSaveAsTransaction}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

