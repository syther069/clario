"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  Loader2,
  X,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Layers,
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
  const [uploadStep, setUploadStep] = useState(
    "Step 1/3: Reading receipt & generating SHA-256 fingerprint...",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveOnChain, setSaveOnChain] = useState(false);
  const [result, setResult] = useState<{
    sha256Hash: string;
    extractedData: ExtractedReceiptData | null;
    storagePath: string;
  } | null>(null);

  // Editable review states (Founder Invariant 10: Human sign-off is mandatory)
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("other");
  const [editTaxAmount, setEditTaxAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("Card");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(selectedFile: File) {
    setError(null);
    setResult(null);
    setSaveOnChain(false);
    setUploading(true);
    setUploadStep(
      "Step 1/3: Reading receipt & generating SHA-256 fingerprint...",
    );

    const stepTimer1 = setTimeout(() => {
      setUploadStep("Step 2/3: Multimodal OCR extraction via Gemini AI...");
    }, 1800);

    const stepTimer2 = setTimeout(() => {
      setUploadStep("Step 3/3: Parsing merchant, total amount & line items...");
    }, 4200);

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

      if (data.extractedData) {
        const ext = data.extractedData as ExtractedReceiptData;
        setEditMerchant(ext.merchant || "");
        setEditAmount(String(ext.totalAmount || ""));
        setEditCurrency(ext.currency || "USD");
        setEditDate(
          ext.date || new Date().toISOString().split("T")[0] || "",
        );
        setEditCategory(ext.categorySlug || "other");
        setEditPaymentMethod(ext.paymentMethod || "Card");
        setEditTaxAmount(
          ext.taxAmount !== undefined ? String(ext.taxAmount) : "",
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setUploading(false);
    }
  }

  function handleSaveAsTransaction() {
    if (!result || !result.extractedData) return;

    setIsSaving(true);
    const ext = result.extractedData;
    const numAmount = parseFloat(editAmount) || ext.totalAmount || 0;
    const numTax = editTaxAmount ? parseFloat(editTaxAmount) : ext.taxAmount;

    const newTx: Partial<Transaction> = {
      user_id: userId,
      type: "expense",
      amount: numAmount,
      currency: editCurrency || "USD",
      merchant: editMerchant || ext.merchant,
      description: `${editMerchant || ext.merchant} (Receipt OCR)`,
      category: editCategory || ext.categorySlug || "other",
      category_id: editCategory || ext.categorySlug || "other",
      date: editDate || ext.date || new Date().toISOString().split("T")[0]!,
      timestamp: editDate || ext.date || new Date().toISOString(),
      payment_method: editPaymentMethod || ext.paymentMethod || "Card",
      verification_state: saveOnChain ? "pending_anchor" : "unverified",
      verification_status: saveOnChain ? "pending_anchor" : "unverified",
      blockchain_network: saveOnChain ? "Monad Testnet" : null,
      blockchain_chain_id: saveOnChain ? 10143 : null,
      blockchain_status: saveOnChain ? "unverified" : null,
      proof_hash: result.sha256Hash,
      notes: ext.rawTextSummary || "Extracted via Gemini 2.5 Flash OCR",
    };

    setTimeout(() => {
      onTransactionCreated(newTx);
      setIsSaving(false);
      onClose();
    }, 300);
  }

  const renderConfidence = (conf?: number) => {
    if (conf === undefined) return null;
    const pct = Math.round(conf * 100);
    const isHigh = pct >= 85;
    return (
      <span
        className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
          isHigh
            ? "bg-[#e8f5e9] text-[#15803d] border-[#15803d]/30"
            : "bg-[#fff8e1] text-[#b45309] border-[#b45309]/30"
        }`}
      >
        {pct}% CONF
      </span>
    );
  };

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
            className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#121212] bg-white shadow-[6px_6px_0_0_#121212] p-6 text-[#121212]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                      Upload Receipt or Invoice
                    </h3>
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase bg-[#f3f0ff] text-[#836EF9] px-2 py-0.5 rounded border border-[#836EF9]/30">
                      <Sparkles className="h-3 w-3" />
                      Gemini OCR
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Multimodal extraction with off-chain privacy and cryptographic Monad anchoring.
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
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212] font-mono">
                        {uploadStep}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Private offchain evidence remains safe — only cryptographic hash anchors to Monad.
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

            {/* Extracted Results Preview & Review Form */}
            {result && (
              <div className="mt-6 space-y-4">
                {/* Fingerprint Header */}
                <WatermelonAlert
                  variant="info"
                  title="Receipt Fingerprinted (SHA-256)"
                  icon={<ShieldCheck className="h-5 w-5 text-[#836EF9]" />}
                  description={
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[280px]">
                        SHA-256: {result.sha256Hash}
                      </span>
                      <ClarioBadge variant="neutral" size="sm">
                        Off-Chain Private
                      </ClarioBadge>
                    </div>
                  }
                />

                {/* Anomalies Alert Box if detected */}
                {result.extractedData?.anomalies &&
                  result.extractedData.anomalies.length > 0 && (
                    <div className="rounded-xl border-2 border-[#ff3b30] bg-[#fff5f5] p-3.5 shadow-[3px_3px_0_0_#ff3b30]">
                      <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-[#ff3b30]">
                        <AlertTriangle className="h-4 w-4" />
                        <span>
                          AI Anomaly Detected (
                          {result.extractedData.anomalies.length})
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs">
                        {result.extractedData.anomalies.map((anom, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-slate-800"
                          >
                            <span className="font-mono text-[10px] font-bold uppercase bg-[#ff3b30]/15 text-[#ff3b30] px-1.5 py-0.5 rounded border border-[#ff3b30]/30 shrink-0">
                              {anom.field}
                            </span>
                            <span className="text-[11px] leading-snug">
                              {anom.issue}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Human Review Form (Founder Invariant 10) */}
                <div className="rounded-xl border-2 border-[#121212] bg-[#f8f9fa] p-4 space-y-4 shadow-[3px_3px_0_0_#121212]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#121212]/15">
                    <span className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-[#836EF9]" />
                      Human Review & Approval (Editable Draft)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                      Invariant 10
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Merchant */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 uppercase text-[11px]">
                          Merchant / Seller
                        </label>
                        {renderConfidence(
                          result.extractedData?.fieldConfidences?.merchant,
                        )}
                      </div>
                      <input
                        type="text"
                        value={editMerchant}
                        onChange={(e) => setEditMerchant(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 uppercase text-[11px]">
                          Date (YYYY-MM-DD)
                        </label>
                        {renderConfidence(
                          result.extractedData?.fieldConfidences?.date,
                        )}
                      </div>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-mono font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                      />
                    </div>

                    {/* Total Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 uppercase text-[11px]">
                          Total Amount ($)
                        </label>
                        {renderConfidence(
                          result.extractedData?.fieldConfidences?.totalAmount,
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-mono font-black text-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                        />
                        <select
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value)}
                          className="rounded-lg border-2 border-[#121212] bg-white px-2 font-mono font-bold text-xs"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="MON">MON</option>
                        </select>
                      </div>
                    </div>

                    {/* Tax Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 uppercase text-[11px]">
                          Tax / VAT ($)
                        </label>
                        {renderConfidence(
                          result.extractedData?.fieldConfidences?.taxAmount,
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={editTaxAmount}
                        onChange={(e) => setEditTaxAmount(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-mono font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block font-bold text-slate-600 uppercase text-[11px] mb-1">
                        Category
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-bold text-[#121212]"
                      >
                        <option value="software_tools">Software & Tools</option>
                        <option value="food_dining">Food & Dining</option>
                        <option value="transportation">Transportation</option>
                        <option value="office_expenses">Office Expenses</option>
                        <option value="utilities">Utilities</option>
                        <option value="travel">Travel</option>
                        <option value="housing">Housing</option>
                        <option value="other">Other / General</option>
                      </select>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 uppercase text-[11px]">
                          Payment Method
                        </label>
                        {renderConfidence(
                          result.extractedData?.fieldConfidences?.paymentMethod,
                        )}
                      </div>
                      <input
                        type="text"
                        value={editPaymentMethod}
                        onChange={(e) => setEditPaymentMethod(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1.5 font-bold text-[#121212]"
                      />
                    </div>
                  </div>

                  {/* Itemized Line Items Preview */}
                  {result.extractedData?.items &&
                    result.extractedData.items.length > 0 && (
                      <div className="border-t-2 border-[#121212]/15 pt-2.5 mt-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Itemized Line Items ({result.extractedData.items.length})
                        </span>
                        <ul className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto">
                          {result.extractedData.items.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between bg-white p-2 rounded-lg border border-[#121212]/20 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <span className="font-medium text-[#121212] truncate">
                                  {item.description}
                                </span>
                                {item.quantity && item.quantity > 1 && (
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                                    x{item.quantity}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.confidence && renderConfidence(item.confidence)}
                                <span className="font-mono font-bold text-[#121212]">
                                  ${Number(item.total).toFixed(2)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* Optional Monad Onchain Save Toggle */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border-2 border-[#121212] bg-[#fbf9fe] cursor-pointer shadow-[2px_2px_0_0_#121212] hover:bg-[#f3edff] transition">
                  <input
                    type="checkbox"
                    checked={saveOnChain}
                    onChange={(e) => setSaveOnChain(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-2 border-[#121212] accent-[#836EF9]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#836EF9]" />
                      <span className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Anchor proof to Monad Testnet
                      </span>
                      <span className="text-[9px] font-mono font-bold uppercase text-[#836EF9] bg-[#f3f0ff] px-1.5 py-0.2 rounded border border-[#836EF9]/30">
                        Optional
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Anchors cryptographic hash to Monad Testnet for tamper-proof audit verification. Private receipt evidence stays off-chain.
                    </p>
                  </div>
                </label>

                {/* Invariant Footer Note */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-dashed border-[#121212]/30 text-[10px] text-slate-600 font-mono">
                  <strong>FOUNDER INVARIANT 10:</strong> AI suggestions populate draft inputs only; human sign-off remains mandatory before ledger commitment.
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <WatermelonButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setResult(null);
                      setSaveOnChain(false);
                    }}
                    morphText="Scan Another"
                  />
                  <WatermelonButton
                    type="button"
                    variant={saveOnChain ? "primary" : "secondary"}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    isLoading={isSaving}
                    loadingText={
                      saveOnChain
                        ? "Saving & Anchoring..."
                        : "Saving to Ledger..."
                    }
                    morphText={
                      saveOnChain
                        ? "Confirm & Anchor to Monad"
                        : "Confirm & Save to Ledger"
                    }
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
