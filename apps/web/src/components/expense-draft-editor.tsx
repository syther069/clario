"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  findTokenAsset,
  isValidAddress,
  normalizeAddress,
  parseBaseUnits,
  SUPPORTED_TOKENS,
} from "@/lib/expense/amount";
import type {
  EvidenceAttachmentSummary,
  ExpenseDraftPayload,
  ExpenseDraftRecord,
} from "@/lib/expense/types";
import { TransactionImportDialog } from "./transaction-import-dialog";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import { getSupportedChain, getExplorerTxUrl } from "@/lib/import/chains";
import {
  type NormalizedTransaction,
  IMPORTED_FACTS_DISCLAIMER,
} from "@/lib/import/types";
import { CryptoChainIcon, CryptoCoinIcon } from "@/components/ui/crypto-icon";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_SOURCES,
  validateExpenseDraft,
} from "@/lib/expense/validation";
import { ExpenseSubmitDialog } from "./expense-submit-dialog";
import { AiExtractionPanel, type AppliedAiFields } from "./ai-extraction-panel";
import { ExpenseWarningPanel } from "./expense-warning-panel";
import {
  Check,
  AlertTriangle,
  Loader2,
  Clock,
  Info,
  CircleDot,
  Circle,
} from "lucide-react";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";

interface ExpenseDraftEditorProps {
  workspaceId: string;
  expenseId: string;
  userAddress: string;
  csrfToken?: string | undefined;
  onBack: () => void;
  onDeleted?: (() => void) | undefined;
  onSubmitted?: ((txHash: string) => void) | undefined;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export function ExpenseDraftEditor({
  workspaceId,
  expenseId,
  userAddress,
  csrfToken,
  onBack,
  onDeleted,
}: ExpenseDraftEditorProps) {
  const auth = useClarioAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [connectedChainId, setConnectedChainId] = useState<number>(31337);

  // Form State
  const [title, setTitle] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [category, setCategory] = useState("other");
  const [project, setProject] = useState("");
  const [merchant, setMerchant] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [claimAmount, setClaimAmount] = useState("0");
  const [claimAsset, setClaimAsset] = useState(SUPPORTED_TOKENS[0]!.address);
  const [recipient, setRecipient] = useState(userAddress);
  const [paymentSource, setPaymentSource] = useState<
    "manual" | "transaction_hash" | "imported_transaction"
  >("manual");
  const [sourceChainId, setSourceChainId] = useState<number | null>(null);
  const [sourceTransactionHash, setSourceTransactionHash] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsStr, setTagsStr] = useState("");

  // Evidence state
  const [evidenceList, setEvidenceList] = useState<EvidenceAttachmentSummary[]>(
    [],
  );
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [warningRevision, setWarningRevision] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  // Check connected chain ID
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (
        window as unknown as {
          ethereum?: { request: (args: unknown) => Promise<unknown> };
        }
      ).ethereum
    ) {
      const ethereum = (
        window as unknown as {
          ethereum: { request: (args: unknown) => Promise<unknown> };
        }
      ).ethereum;
      ethereum
        .request({ method: "eth_chainId" })
        .then((hex) => {
          if (typeof hex === "string") {
            setConnectedChainId(parseInt(hex, 16));
          }
        })
        .catch(() => {});
    }
  }, []);

  // 1. Load draft on mount
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}`,
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error?.message || "Failed to load expense draft.",
          );
        }
        const data = (await res.json()) as { draft: ExpenseDraftRecord };
        if (!ignore && data.draft) {
          const p = data.draft.payload;
          setTitle(p.title || "");
          setBusinessPurpose(p.businessPurpose || "");
          setCategory(p.category || "other");
          setProject(p.project || "");
          setMerchant(p.merchant || "");
          setExpenseDate(
            p.expenseDate || new Date().toISOString().slice(0, 10),
          );
          setClaimAmount(p.claimAmount || "0");
          setClaimAsset(p.claimAsset || SUPPORTED_TOKENS[0]!.address);
          setRecipient(p.recipient || userAddress);
          setPaymentSource(p.paymentSource || "manual");
          setSourceChainId(p.sourceChainId || null);
          setSourceTransactionHash(p.sourceTransactionHash || "");
          setClientName(p.client || "");
          setInvoiceNumber(p.invoiceNumber || "");
          setLocation(p.location || "");
          setNotes(p.notes || "");
          setTagsStr(p.tags?.join(", ") || "");
          setEvidenceList(data.draft.evidence || []);
          if (
            p.client ||
            p.invoiceNumber ||
            p.location ||
            p.notes ||
            p.tags?.length
          ) {
            setShowOptionalFields(true);
          }
          setSaveStatus("saved");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading draft.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          initialLoadRef.current = false;
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [workspaceId, expenseId, userAddress]);

  // Construct current payload
  const currentPayload: ExpenseDraftPayload = {
    title,
    businessPurpose,
    category,
    project,
    merchant,
    expenseDate,
    claimAmount,
    claimAsset,
    recipient: isValidAddress(recipient)
      ? normalizeAddress(recipient)
      : (recipient as `0x${string}`),
    paymentSource,
    sourceChainId: sourceChainId || null,
    sourceTransactionHash: sourceTransactionHash
      ? (sourceTransactionHash as `0x${string}`)
      : null,
    client: clientName || null,
    invoiceNumber: invoiceNumber || null,
    location: location || null,
    notes: notes || null,
    tags: tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };

  const handleSelectTransaction = async (
    tx: NormalizedTransaction,
    source: "imported_transaction" | "transaction_hash",
  ) => {
    setPaymentSource(source);
    setSourceChainId(tx.sourceChainId);
    setSourceTransactionHash(tx.sourceTransactionHash);
    setClaimAmount(tx.formattedAmount);
    if (tx.recipient) {
      setRecipient(tx.recipient);
    }
    if (tx.blockTimestamp) {
      setExpenseDate(tx.blockTimestamp.slice(0, 10));
    }
    if (!title.trim()) {
      setTitle(`Payment via ${tx.sourceTransactionHash.slice(0, 10)}...`);
    }
    if (!merchant.trim()) {
      setMerchant(
        tx.recipient
          ? `Transfer to ${tx.recipient.slice(0, 8)}...`
          : "Imported Payment",
      );
    }
    handleFieldChange();

    // Register claim in source_transactions table
    try {
      await fetch(`/api/workspaces/${workspaceId}/import/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          expenseId,
          transaction: tx,
        }),
      });
    } catch {
      // Ignored for offline/best-effort
    }
  };

  // 2. Autosave function
  const saveDraft = useCallback(
    async (payloadToSave: ExpenseDraftPayload) => {
      try {
        setSaveStatus("saving");
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            },
            body: JSON.stringify({ payload: payloadToSave }),
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Failed to save draft.");
        }

        const data = (await res.json()) as { draft: ExpenseDraftRecord };
        if (data.draft) {
          setSaveStatus("saved");
          setWarningRevision((revision) => revision + 1);
        }
        setError(null);
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof Error ? err.message : "Autosave failed.");
      }
    },
    [workspaceId, expenseId, csrfToken],
  );

  // 3. Trigger debounced autosave on field edits
  const handleFieldChange = () => {
    if (initialLoadRef.current) return;
    setSaveStatus("unsaved");

    // Local validation preview
    const val = validateExpenseDraft(currentPayload, false);
    setFieldErrors(val.errors);

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveDraft(currentPayload);
    }, 1000);
  };

  const handleApplyAiSuggestions = async (fields: AppliedAiFields) => {
    const nextPayload: ExpenseDraftPayload = {
      ...currentPayload,
      ...(fields.merchant !== undefined ? { merchant: fields.merchant } : {}),
      ...(fields.expenseDate !== undefined
        ? { expenseDate: fields.expenseDate }
        : {}),
      ...(fields.invoiceNumber !== undefined
        ? { invoiceNumber: fields.invoiceNumber }
        : {}),
      ...(fields.claimAmount !== undefined
        ? { claimAmount: fields.claimAmount }
        : {}),
      ...(fields.category !== undefined ? { category: fields.category } : {}),
      ...(fields.project !== undefined ? { project: fields.project } : {}),
    };

    if (fields.merchant !== undefined) setMerchant(fields.merchant);
    if (fields.expenseDate !== undefined) setExpenseDate(fields.expenseDate);
    if (fields.invoiceNumber !== undefined) {
      setInvoiceNumber(fields.invoiceNumber);
      setShowOptionalFields(true);
    }
    if (fields.claimAmount !== undefined) setClaimAmount(fields.claimAmount);
    if (fields.category !== undefined) setCategory(fields.category);
    if (fields.project !== undefined) setProject(fields.project);
    setFieldErrors(validateExpenseDraft(nextPayload, false).errors);
    await saveDraft(nextPayload);
  };

  // 4. Warn beforeunload if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [saveStatus]);

  // 5. Delete Draft
  const handleDeleteDraft = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this unsubmitted draft? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}`,
        {
          method: "DELETE",
          headers: {
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to delete draft.");
      }

      if (onDeleted) {
        onDeleted();
      } else {
        onBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting draft.");
      setIsDeleting(false);
    }
  };

  // 6. Evidence file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]!;
    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds maximum allowed limit of 10MB.");
      return;
    }

    const allowedMimes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedMimes.includes(file.type)) {
      alert("Only PDF, PNG, or JPEG receipts and invoices are accepted.");
      return;
    }

    try {
      setUploadingEvidence(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", workspaceId);
      formData.append("version", "1");

      const res = await fetch(`/api/expenses/${expenseId}/evidence`, {
        method: "POST",
        headers: {
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to upload evidence.");
      }

      // Reload draft to get updated evidence list
      const draftRes = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}`,
      );
      if (draftRes.ok) {
        const draftData = (await draftRes.json()) as {
          draft: ExpenseDraftRecord;
        };
        setEvidenceList(draftData.draft.evidence || []);
        setWarningRevision((revision) => revision + 1);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Evidence upload error.");
    } finally {
      setUploadingEvidence(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 7. Delete evidence
  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm("Remove this evidence attachment?")) return;

    try {
      const res = await fetch(
        `/api/expenses/${expenseId}/evidence/${evidenceId}`,
        {
          method: "DELETE",
          headers: {
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to delete evidence.");
      }

      setEvidenceList((prev) =>
        prev.filter((item) => item.evidenceId !== evidenceId),
      );
      setWarningRevision((revision) => revision + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete evidence.");
    }
  };

  // Compute calculated base units for preview
  const selectedToken = findTokenAsset(claimAsset) || SUPPORTED_TOKENS[0]!;
  let calculatedBaseUnits = "0";
  try {
    calculatedBaseUnits = parseBaseUnits(
      claimAmount,
      selectedToken.decimals,
    ).toString();
  } catch {
    calculatedBaseUnits = "Invalid";
  }

  if (loading) {
    return (
      <div
        style={{ padding: "40px", color: "var(--muted)", textAlign: "center" }}
      >
        Loading expense draft...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            ← Back
          </button>
          <div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--foreground)",
                margin: 0,
              }}
            >
              {title.trim() || "Untitled Expense Draft"}
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <span className="mono-badge" style={{ fontSize: "0.75rem" }}>
                Draft v1 (Offchain)
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                ID: {expenseId.slice(0, 10)}...{expenseId.slice(-6)}
              </span>
            </div>
          </div>
        </div>

        {/* Status indicators and action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {saveStatus === "saving" && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--monad-purple)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#836EF9]" />
              <span>Saving changes...</span>
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--warning)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Unsaved changes</span>
            </span>
          )}
          {saveStatus === "saved" && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved to private ledger</span>
            </span>
          )}
          {saveStatus === "error" && (
            <button
              type="button"
              onClick={() => void saveDraft(currentPayload)}
              style={{
                fontSize: "0.8rem",
                color: "var(--error)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span>Save failed (click to retry)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void saveDraft(currentPayload)}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            Save Now
          </button>

          <button
            type="button"
            onClick={() => {
              const validation = validateExpenseDraft(currentPayload, true);
              if (!validation.valid) {
                setFieldErrors(validation.errors);
                setError(
                  "Please complete all required fields before submitting to Monad.",
                );
                return;
              }
              void saveDraft(currentPayload);
              setIsSubmitDialogOpen(true);
            }}
            className="btn-primary"
            style={{
              fontSize: "0.85rem",
              padding: "6px 16px",
              background: "var(--monad-purple)",
            }}
          >
            Review & Submit on Monad
          </button>

          <button
            type="button"
            onClick={() => void handleDeleteDraft()}
            disabled={isDeleting}
            style={{
              padding: "6px 12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              borderRadius: "4px",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {isDeleting ? "Deleting..." : "Discard Draft"}
          </button>
        </div>
      </div>

      {error && (
        <div className="callout-box warning" style={{ margin: 0 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Proof Spine layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "24px",
        }}
      >
        {/* Left: Form Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Section: Primary Information */}
          <div className="card" style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: "16px",
              }}
            >
              1. Business Purpose & Classification
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginBottom: "6px",
                  }}
                >
                  Expense Title <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  placeholder="e.g. AWS Validator Node Hosting - September"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    handleFieldChange();
                  }}
                />
                {fieldErrors.title && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--error)",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    {fieldErrors.title}
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginBottom: "6px",
                  }}
                >
                  Business Purpose{" "}
                  <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={businessPurpose}
                  placeholder="Explain why this expense was necessary for the organization..."
                  onChange={(e) => {
                    setBusinessPurpose(e.target.value);
                    handleFieldChange();
                  }}
                />
                {fieldErrors.businessPurpose && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--error)",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    {fieldErrors.businessPurpose}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Category <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <NeoSelect
                    value={category}
                    onChange={(val) => {
                      setCategory(val);
                      handleFieldChange();
                    }}
                    options={EXPENSE_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: cat.toUpperCase(),
                    }))}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Project / Cost Center{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={project}
                    placeholder="e.g. core-eng"
                    onChange={(e) => {
                      setProject(e.target.value);
                      handleFieldChange();
                    }}
                  />
                  {fieldErrors.project && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--error)",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      {fieldErrors.project}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Merchant / Payee{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={merchant}
                    placeholder="e.g. Amazon Web Services"
                    onChange={(e) => {
                      setMerchant(e.target.value);
                      handleFieldChange();
                    }}
                  />
                  {fieldErrors.merchant && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--error)",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      {fieldErrors.merchant}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginBottom: "6px",
                  }}
                >
                  Expense Date (UTC){" "}
                  <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <NeoDatePicker
                  value={expenseDate}
                  onChange={(date) => {
                    setExpenseDate(date);
                    handleFieldChange();
                  }}
                />
                {fieldErrors.expenseDate && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--error)",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    {fieldErrors.expenseDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section: Financial & Settlement Terms */}
          <div className="card" style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: "16px",
              }}
            >
              2. Reimbursement Amount & Settlement Payee
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Claim Amount{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={claimAmount}
                    placeholder="e.g. 150.00"
                    onChange={(e) => {
                      setClaimAmount(e.target.value);
                      handleFieldChange();
                    }}
                  />
                  {fieldErrors.claimAmount && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--error)",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      {fieldErrors.claimAmount}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Settlement Asset{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "2px solid #121212",
                        background: "#fbf9fe",
                        flexShrink: 0,
                      }}
                    >
                      <CryptoCoinIcon
                        symbol={findTokenAsset(claimAsset)?.symbol || "USDC"}
                        className="h-5 w-5"
                      />
                    </div>
                    <NeoSelect
                      value={claimAsset}
                      onChange={(val) => {
                        setClaimAsset(val as `0x${string}`);
                        handleFieldChange();
                      }}
                      options={SUPPORTED_TOKENS.map((token) => ({
                        value: token.address,
                        label: `${token.symbol} (${token.decimals} dec)`,
                      }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Recipient Payee Address{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipient(userAddress);
                      handleFieldChange();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--monad-purple)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Use connected wallet
                  </button>
                </div>
                <input
                  type="text"
                  className="input-field font-mono"
                  value={recipient}
                  placeholder="0x..."
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    handleFieldChange();
                  }}
                />
                {fieldErrors.recipient && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--error)",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    {fieldErrors.recipient}
                  </span>
                )}
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      margin: 0,
                    }}
                  >
                    Payment Provenance Source
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsImportDialogOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--monad-purple)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    Import from Wallet / Explorer ↗
                  </button>
                </div>
                <NeoSelect
                  value={paymentSource}
                  onChange={(val) => {
                    setPaymentSource(
                      val as "manual" | "transaction_hash" | "imported_transaction",
                    );
                    handleFieldChange();
                  }}
                  options={PAYMENT_SOURCES.map((src) => ({
                    value: src,
                    label:
                      src === "manual"
                        ? "Manual Entry (Invoice / Receipt Only)"
                        : src === "transaction_hash"
                          ? "Existing Transaction Hash"
                          : "Imported Provider Transaction",
                  }))}
                />
              </div>

              {paymentSource !== "manual" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <CryptoChainIcon
                        chain={sourceChainId || 10143}
                        className="h-4 w-4"
                      />
                      <span>
                        Source Chain:{" "}
                        <strong>
                          {sourceChainId
                            ? getSupportedChain(sourceChainId)?.name ||
                              `Chain ${sourceChainId}`
                            : "Monad Testnet"}
                        </strong>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsImportDialogOpen(true)}
                      className="btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                    >
                      Browse Transactions
                    </button>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Source Transaction Hash{" "}
                      <span style={{ color: "var(--error)" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        className="input-field font-mono"
                        value={sourceTransactionHash}
                        placeholder="0x..."
                        onChange={(e) => {
                          setSourceTransactionHash(e.target.value);
                          handleFieldChange();
                        }}
                      />
                      {sourceChainId &&
                        sourceTransactionHash &&
                        getExplorerTxUrl(
                          sourceChainId,
                          sourceTransactionHash,
                        ) && (
                          <a
                            href={getExplorerTxUrl(
                              sourceChainId,
                              sourceTransactionHash,
                            )!}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            style={{
                              fontSize: "0.8rem",
                              padding: "6px 10px",
                              display: "flex",
                              alignItems: "center",
                              textDecoration: "none",
                            }}
                            title="View on Explorer"
                          >
                            ↗
                          </a>
                        )}
                    </div>
                    {fieldErrors.sourceTransactionHash && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--error)",
                          marginTop: "4px",
                          display: "block",
                        }}
                      >
                        {fieldErrors.sourceTransactionHash}
                      </span>
                    )}
                  </div>

                  {/* Non-authoritative disclaimer */}
                  <div
                    style={{
                      padding: "8px 10px",
                      backgroundColor: "rgba(102, 77, 255, 0.08)",
                      border: "1px solid rgba(102, 77, 255, 0.2)",
                      borderRadius: "4px",
                      fontSize: "0.73rem",
                      color: "#a49fff",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Info className="w-4 h-4 shrink-0 text-[#836EF9]" />
                    <span>{IMPORTED_FACTS_DISCLAIMER}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Optional Metadata */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <button
              type="button"
              onClick={() => setShowOptionalFields((prev) => !prev)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "none",
                border: "none",
                color: "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span>3. Optional Metadata (Invoices, Tags, Notes)</span>
              <span>{showOptionalFields ? "▲ Hide" : "▼ Show"}</span>
            </button>

            {showOptionalFields && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  marginTop: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Client Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={clientName}
                      placeholder="e.g. Monad Labs"
                      onChange={(e) => {
                        setClientName(e.target.value);
                        handleFieldChange();
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Invoice / Receipt Number
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={invoiceNumber}
                      placeholder="e.g. INV-2026-0042"
                      onChange={(e) => {
                        setInvoiceNumber(e.target.value);
                        handleFieldChange();
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Location
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={location}
                      placeholder="e.g. Lisbon, Portugal"
                      onChange={(e) => {
                        setLocation(e.target.value);
                        handleFieldChange();
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={tagsStr}
                      placeholder="e.g. travel, conference, offsite"
                      onChange={(e) => {
                        setTagsStr(e.target.value);
                        handleFieldChange();
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "4px",
                    }}
                  >
                    Private Notes
                  </label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={notes}
                    placeholder="Internal team notes (remains encrypted offchain)..."
                    onChange={(e) => {
                      setNotes(e.target.value);
                      handleFieldChange();
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Evidence & Proof Spine */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Base Unit Calculation Stamp */}
          <div className="card" style={{ padding: "16px" }}>
            <h4
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--foreground)",
                margin: "0 0 12px 0",
              }}
            >
              Settlement Commitment
            </h4>
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                padding: "12px",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Token:</span>
                <span className="font-mono">{selectedToken.symbol}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Decimals:</span>
                <span className="font-mono">{selectedToken.decimals}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Base Units:</span>
                <span
                  className="font-mono"
                  style={{ color: "var(--monad-purple)", fontWeight: 600 }}
                >
                  {calculatedBaseUnits}
                </span>
              </div>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                marginTop: "10px",
                lineHeight: 1.4,
              }}
            >
              Integer base units are bound to the Monad smart contract
              settlement registry to eliminate floating-point drift.
            </p>
          </div>

          {/* Encrypted Evidence Section */}
          <div className="card" style={{ padding: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  margin: 0,
                }}
              >
                Private Evidence ({evidenceList.length})
              </h4>
              <span className="mono-badge" style={{ fontSize: "0.7rem" }}>
                AES-256-GCM
              </span>
            </div>

            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                marginBottom: "12px",
                lineHeight: 1.4,
              }}
            >
              Uploaded invoices and receipts are envelope-encrypted offchain. No
              raw bytes or personal data are anchored to Monad.
            </p>

            {/* Upload Button / Dropzone */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => void handleFileUpload(e)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={uploadingEvidence}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "0.8rem",
                marginBottom: "14px",
              }}
            >
              {uploadingEvidence
                ? "Encrypting & Uploading..."
                : "+ Attach Receipt / Invoice"}
            </button>

            {/* Evidence items list */}
            {evidenceList.length === 0 ? (
              <div
                style={{
                  padding: "14px",
                  border: "1px dashed var(--border)",
                  borderRadius: "4px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                }}
              >
                No evidence attached yet. (PDF, PNG, JPG up to 10MB)
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {evidenceList.map((item) => (
                  <div
                    key={item.evidenceId}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      padding: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          color: "var(--foreground)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.originalFilename ||
                          `Evidence ${item.evidenceId.slice(0, 8)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteEvidence(item.evidenceId)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--error)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.7rem",
                        color: "var(--muted)",
                      }}
                    >
                      <span>{(item.byteLength / 1024).toFixed(1)} KB</span>
                      <span className="font-mono">
                        SHA: {item.sha256Hash.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AiExtractionPanel
            workspaceId={workspaceId}
            expenseId={expenseId}
            evidence={evidenceList}
            csrfToken={csrfToken}
            onApply={handleApplyAiSuggestions}
            onAnalysisChange={() =>
              setWarningRevision((revision) => revision + 1)
            }
          />

          <ExpenseWarningPanel
            workspaceId={workspaceId}
            expenseId={expenseId}
            csrfToken={csrfToken}
            refreshKey={warningRevision}
          />

          {/* Workflow Proof Spine indicator */}
          <div className="card" style={{ padding: "16px" }}>
            <h4
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--foreground)",
                margin: "0 0 12px 0",
              }}
            >
              Proof Spine Progress
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "0.8rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--monad-purple)",
                }}
              >
                <CircleDot className="w-3.5 h-3.5 shrink-0 text-[#836EF9]" />{" "}
                <strong>Stage 1:</strong> Private Draft (Active)
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--muted)",
                }}
              >
                <Circle className="w-3.5 h-3.5 shrink-0 text-slate-400" /> Stage
                2: Canonical Salted Commitment
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--muted)",
                }}
              >
                <Circle className="w-3.5 h-3.5 shrink-0 text-slate-400" /> Stage
                3: Monad Onchain Registration
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--muted)",
                }}
              >
                <Circle className="w-3.5 h-3.5 shrink-0 text-slate-400" /> Stage
                4: Authorized Review
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionImportDialog
        isOpen={isImportDialogOpen}
        workspaceId={workspaceId}
        userAddress={userAddress || auth.connectedEvmAddress || undefined}
        onClose={() => setIsImportDialogOpen(false)}
        onConnectWallet={auth.connectEvmWallet}
        onSelectTransaction={handleSelectTransaction}
      />

      <ExpenseSubmitDialog
        isOpen={isSubmitDialogOpen}
        workspaceId={workspaceId}
        expenseId={expenseId}
        connectedChainId={connectedChainId}
        csrfToken={csrfToken}
        onClose={() => setIsSubmitDialogOpen(false)}
        onSubmitted={() => {
          setIsSubmitDialogOpen(false);
          onBack();
        }}
      />
    </div>
  );
}
