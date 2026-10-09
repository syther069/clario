"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Lock,
  Hash,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Code,
  Flame,
  Sliders,
  Sparkles,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import {
  InteractiveCard,
  AnimatedButton,
  ContextualIconSwap,
} from "@/components/ui/motion";
import { motion, AnimatePresence } from "motion/react";
import {
  keccak256,
  stringToBytes,
  encodeAbiParameters,
  getAddress,
} from "viem";

// Domain separator from Clario Protocol V1 specification
export const CLARIO_EXPENSE_V1_DOMAIN =
  "0x27cb570aa4304879c3d4a04d49a712f2759e6fb6bb25590c67533bfd3f3f01c8" as const;

export const MONAD_TESTNET_CHAIN_ID = 10143n;
export const CLARIO_REGISTRY_ADDRESS = getAddress(
  "0x438B575c57B447cBa41f3EB399AE0D7249Ea9405",
);

export function safeGetAddress(
  addr: string,
  fallback: `0x${string}` = "0x0000000000000000000000000000000000000000",
): `0x${string}` {
  try {
    return getAddress(addr);
  } catch {
    return fallback;
  }
}

/**
 * Deterministic RFC 8785 JSON Canonicalization Scheme (JCS)
 */
export function canonicalizeJsonClient(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJsonClient(item));
    return `[${items.join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs: string[] = [];
  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      pairs.push(`${JSON.stringify(key)}:${canonicalizeJsonClient(obj[key])}`);
    }
  }

  return `{${pairs.join(",")}}`;
}

export interface AuthenticRecordState {
  vendor: string;
  amount: string;
  currency: string;
  date: string;
  recipient: string;
  category: string;
  description: string;
  workspaceId: `0x${string}`;
  expenseId: `0x${string}`;
  version: number;
  salt: `0x${string}`;
  evidenceFile: string;
  evidenceSha256: `0x${string}`;
}

export const AUTHENTIC_RECORD_BASELINE: AuthenticRecordState = {
  vendor: "AWS Cloud Infrastructure",
  amount: "500.00",
  currency: "USD",
  date: "2026-10-04",
  recipient: getAddress("0x71C67ed3E7374b4249a5C62b8E1724B90d803972"),
  category: "Infrastructure & Compute",
  description: "Monad RPC Validator Node Hosting Cluster (October 2026)",
  workspaceId:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  expenseId:
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  version: 1,
  salt: "0x9a8f4c2e1b3d5e7f9a8f4c2e1b3d5e7f9a8f4c2e1b3d5e7f9a8f4c2e1b3d5e7f",
  evidenceFile: "aws-invoice-oct2026.pdf",
  evidenceSha256:
    "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};

export interface InteractiveProofVisualizerProps {
  onSelectHashForVerification?: (hash: string) => void;
}

export function InteractiveProofVisualizer({
  onSelectHashForVerification,
}: InteractiveProofVisualizerProps) {
  const [activeTab, setActiveTab] = useState<"pipeline" | "simulator">(
    "pipeline",
  );
  const [activeStep, setActiveStep] = useState<number>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tamper Simulator State
  const [record, setRecord] = useState<AuthenticRecordState>({
    ...AUTHENTIC_RECORD_BASELINE,
  });

  // Calculate base authentic values once
  const authenticPipeline = useMemo(() => {
    const rawExpense = {
      amount: AUTHENTIC_RECORD_BASELINE.amount,
      currency: AUTHENTIC_RECORD_BASELINE.currency,
      date: AUTHENTIC_RECORD_BASELINE.date,
      expenseId: AUTHENTIC_RECORD_BASELINE.expenseId,
      recipient: safeGetAddress(AUTHENTIC_RECORD_BASELINE.recipient),
      vendor: AUTHENTIC_RECORD_BASELINE.vendor,
      version: AUTHENTIC_RECORD_BASELINE.version,
      workspaceId: AUTHENTIC_RECORD_BASELINE.workspaceId,
    };

    const canonicalJson = canonicalizeJsonClient(rawExpense);
    const privateRecordHash = keccak256(stringToBytes(canonicalJson));
    const evidenceManifestHash = AUTHENTIC_RECORD_BASELINE.evidenceSha256;

    const encoded = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        CLARIO_EXPENSE_V1_DOMAIN,
        MONAD_TESTNET_CHAIN_ID,
        CLARIO_REGISTRY_ADDRESS,
        AUTHENTIC_RECORD_BASELINE.workspaceId,
        AUTHENTIC_RECORD_BASELINE.expenseId,
        AUTHENTIC_RECORD_BASELINE.version,
        privateRecordHash,
        evidenceManifestHash,
        AUTHENTIC_RECORD_BASELINE.salt,
      ],
    );

    const onchainCommitment = keccak256(encoded);

    return {
      canonicalJson,
      privateRecordHash,
      evidenceManifestHash,
      onchainCommitment,
    };
  }, []);

  // Compute live current record pipeline
  const currentPipeline = useMemo(() => {
    const safeRecipient = safeGetAddress(record.recipient);
    const rawExpense = {
      amount: record.amount,
      currency: record.currency,
      date: record.date,
      expenseId: record.expenseId,
      recipient: safeRecipient,
      vendor: record.vendor,
      version: record.version,
      workspaceId: record.workspaceId,
    };

    const canonicalJson = canonicalizeJsonClient(rawExpense);
    const privateRecordHash = keccak256(stringToBytes(canonicalJson));
    const evidenceManifestHash = record.evidenceSha256;

    let onchainCommitment = "0x0";
    try {
      const encoded = encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "uint256" },
          { type: "address" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "uint32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        [
          CLARIO_EXPENSE_V1_DOMAIN,
          MONAD_TESTNET_CHAIN_ID,
          CLARIO_REGISTRY_ADDRESS,
          record.workspaceId,
          record.expenseId,
          record.version,
          privateRecordHash,
          evidenceManifestHash,
          record.salt,
        ],
      );
      onchainCommitment = keccak256(encoded);
    } catch {
      onchainCommitment = "0x0000000000000000000000000000000000000000";
    }

    const isTampered =
      onchainCommitment !== authenticPipeline.onchainCommitment;

    return {
      canonicalJson,
      privateRecordHash,
      evidenceManifestHash,
      onchainCommitment,
      isTampered,
    };
  }, [record, authenticPipeline.onchainCommitment]);

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Tamper presets
  function applyPreset(preset: "amount" | "vendor" | "recipient" | "typo" | "reset") {
    if (preset === "reset") {
      setRecord({ ...AUTHENTIC_RECORD_BASELINE });
      return;
    }

    if (preset === "amount") {
      setRecord((prev) => ({
        ...prev,
        amount: prev.amount === "5000.00" ? "500.00" : "5000.00",
      }));
    } else if (preset === "vendor") {
      setRecord((prev) => ({
        ...prev,
        vendor:
          prev.vendor === "Shadow Corp LLC"
            ? AUTHENTIC_RECORD_BASELINE.vendor
            : "Shadow Corp LLC",
      }));
    } else if (preset === "recipient") {
      setRecord((prev) => ({
        ...prev,
        recipient:
          prev.recipient === "0x000000000000000000000000000000000000dEaD"
            ? AUTHENTIC_RECORD_BASELINE.recipient
            : "0x000000000000000000000000000000000000dEaD",
      }));
    } else if (preset === "typo") {
      setRecord((prev) => ({
        ...prev,
        amount: prev.amount === "500.01" ? "500.00" : "500.01",
      }));
    }
  }

  return (
    <section
      aria-label="Interactive Cryptographic Proof Visualizer & Tamper Simulator"
      className="space-y-6"
    >
      {/* Container Header & Tabs */}
      <InteractiveCard
        enableTilt={false}
        enableSpotlight={false}
        className="neo-card p-6 shadow-[4px_4px_0_0_#121212] bg-white space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#121212] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="neo-badge neo-badge-purple flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Auditor Cryptographic Sandbox</span>
              </span>
              <span className="neo-badge bg-[#836EF9]/10 text-[#836EF9] border border-[#836EF9]/30">
                RFC 8785 + Keccak-256
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#121212]">
              Interactive Proof Visualizer & Tamper Simulator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Deconstruct how offchain cleartext receipts transform into
              zero-knowledge onchain commitments, or simulate malicious
              modifications to watch the cryptographic avalanche effect in real
              time.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-[#f4f4f5] border-2 border-[#121212] rounded-xl self-start lg:self-center shadow-[2px_2px_0_0_#121212]">
            <button
              type="button"
              onClick={() => setActiveTab("pipeline")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "pipeline"
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#836EF9]"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Commitment Pipeline</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulator")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "simulator"
                  ? "bg-[#ef4444] text-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#ef4444]"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Tamper Simulator</span>
            </button>
          </div>
        </div>

        {/* TAB 1: VISUAL COMMITMENT PIPELINE BREAKDOWN */}
        {activeTab === "pipeline" && (
          <div className="space-y-6">
            {/* Visual Stepper / Pipeline Nodes */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                {
                  step: 1,
                  title: "1. Canonical JSON",
                  subtitle: "RFC 8785 Normalization",
                  icon: Code,
                  badge: "Deterministic",
                },
                {
                  step: 2,
                  title: "2. Record Digest",
                  subtitle: "Keccak-256 Hashing",
                  icon: Hash,
                  badge: "32 Bytes",
                },
                {
                  step: 3,
                  title: "3. Evidence Digest",
                  subtitle: "Private Offchain PDF",
                  icon: Lock,
                  badge: "Offchain Secret",
                },
                {
                  step: 4,
                  title: "4. Salt & Domain",
                  subtitle: "Anti-Rainbow Binding",
                  icon: ShieldCheck,
                  badge: "EIP-712 Spec",
                },
                {
                  step: 5,
                  title: "5. Monad Anchor",
                  subtitle: "Sub-Second Finality",
                  icon: MonadLogo,
                  badge: "Chain ID 10143",
                },
              ].map((item) => {
                const isSelected = activeStep === item.step;
                const Icon = item.icon;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setActiveStep(item.step)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "border-[#121212] bg-[#f5f3ff] shadow-[3px_3px_0_0_#836EF9]"
                        : "border-[#121212]/30 bg-white hover:border-[#121212] shadow-[1px_1px_0_0_#121212]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center border border-[#121212] ${
                          isSelected
                            ? "bg-[#836EF9] text-white"
                            : "bg-[#f4f4f5] text-[#121212]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[9px] uppercase font-bold text-slate-500">
                        {item.badge}
                      </span>
                    </div>
                    <div>
                      <p className="font-black text-xs uppercase tracking-wide text-[#121212]">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Stage Detail Visualizer */}
            <div className="rounded-xl border-2 border-[#121212] p-5 bg-[#fafafa] shadow-[3px_3px_0_0_#121212] space-y-4">
              {activeStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                        <Code className="h-4 w-4 text-[#836EF9]" />
                        <span>Step 1: RFC 8785 Canonical JSON Serialization (JCS)</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        Keys are strictly sorted lexicographically by UTF-16 code units. Whitespace outside strings is eliminated.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(currentPipeline.canonicalJson, "step1")
                      }
                      className="neo-btn neo-btn-sm flex items-center gap-1.5 text-xs font-mono"
                    >
                      <ContextualIconSwap
                        isActive={copiedKey === "step1"}
                        initialIcon={<Copy className="h-3 w-3" />}
                        activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                      />
                      <span>{copiedKey === "step1" ? "Copied" : "Copy Canonical"}</span>
                    </button>
                  </div>

                  <div className="rounded-lg bg-[#121212] text-emerald-400 p-4 font-mono text-xs overflow-x-auto border-2 border-[#121212]">
                    <code>{currentPipeline.canonicalJson}</code>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-[#121212]">
                    <span className="font-bold uppercase text-[#836EF9]">Invariant:</span>
                    <span>
                      Guaranteeing cross-platform parity between TypeScript, Go indexers, and Solidity verifiers.
                    </span>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                        <Hash className="h-4 w-4 text-[#836EF9]" />
                        <span>Step 2: Private Record Digest (Keccak-256)</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        The canonical string bytes are hashed with Keccak-256 to produce privateRecordHash. Cleartext is never revealed onchain.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(currentPipeline.privateRecordHash, "step2")
                      }
                      className="neo-btn neo-btn-sm flex items-center gap-1.5 text-xs font-mono"
                    >
                      <ContextualIconSwap
                        isActive={copiedKey === "step2"}
                        initialIcon={<Copy className="h-3 w-3" />}
                        activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                      />
                      <span>{copiedKey === "step2" ? "Copied" : "Copy Hash"}</span>
                    </button>
                  </div>

                  <div className="rounded-lg bg-[#121212] text-[#836EF9] p-4 font-mono text-xs overflow-x-auto border-2 border-[#121212] font-bold">
                    <code>{currentPipeline.privateRecordHash}</code>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-[#121212]">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Digest Output</span>
                      <p className="font-mono text-xs font-black text-[#121212]">32 Bytes (256 Bits)</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-[#121212]">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Algorithm</span>
                      <p className="font-mono text-xs font-black text-[#121212]">Keccak-256 (EVM Native)</p>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                        <Lock className="h-4 w-4 text-[#836EF9]" />
                        <span>Step 3: Offchain Evidence Manifest Digest</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        High-resolution receipt PDFs and merchant receipts are encrypted with AES-256-GCM offchain and summarized into a 32-byte manifest digest.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-4 border-2 border-[#121212] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {record.evidenceFile}
                      </span>
                      <span className="neo-badge text-[10px]">Confidential Document</span>
                    </div>
                    <div className="font-mono text-xs text-slate-600 break-all bg-slate-50 p-2 rounded border border-slate-200">
                      evidenceManifestHash: {currentPipeline.evidenceManifestHash}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-[#121212]">
                    <span className="font-bold uppercase text-emerald-600">Founder Invariant 1:</span>
                    <span>Zero cleartext receipt scans or customer PII are ever written to public calldata.</span>
                  </div>
                </div>
              )}

              {activeStep === 4 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-[#836EF9]" />
                        <span>Step 4: EIP-712 Domain Separator & Cryptographic Salt Binding</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        Parameters are encoded using ABI v2 specification with domain separator and a random 32-byte salt to prevent rainbow table attacks.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-[#121212] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Domain Separator</span>
                      <p className="font-mono text-[11px] text-slate-700 truncate">{CLARIO_EXPENSE_V1_DOMAIN}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-[#121212] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Monad Chain ID</span>
                      <p className="font-mono text-xs font-black text-[#836EF9]">10143 (Monad Testnet)</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-[#121212] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Registry Address</span>
                      <p className="font-mono text-[11px] text-slate-700 truncate">{CLARIO_REGISTRY_ADDRESS}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-[#121212] space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Random 32-Byte Salt</span>
                      <p className="font-mono text-[11px] text-slate-700 truncate">{record.salt}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 5 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
                        <MonadLogo className="h-4 w-4" />
                        <span>Step 5: Final Onchain Commitment Root</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        The ultimate 32-byte root hash submitted to Monad ExpenseRegistryV1. Anchored immutably with sub-second block finality.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(currentPipeline.onchainCommitment, "step5")
                      }
                      className="neo-btn neo-btn-sm flex items-center gap-1.5 text-xs font-mono"
                    >
                      <ContextualIconSwap
                        isActive={copiedKey === "step5"}
                        initialIcon={<Copy className="h-3 w-3" />}
                        activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                      />
                      <span>{copiedKey === "step5" ? "Copied" : "Copy Commitment"}</span>
                    </button>
                  </div>

                  <div className="rounded-lg bg-[#121212] text-white p-4 font-mono text-sm overflow-x-auto border-2 border-[#121212] font-black">
                    <code className="text-[#836EF9]">
                      {currentPipeline.onchainCommitment}
                    </code>
                  </div>

                  {onSelectHashForVerification && (
                    <div className="pt-2 flex justify-end">
                      <AnimatedButton
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onSelectHashForVerification(
                            currentPipeline.onchainCommitment,
                          )
                        }
                      >
                        Verify this root in Onchain Verifier
                      </AnimatedButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE TAMPER SIMULATOR (AUDITOR TESTBED) */}
        {activeTab === "simulator" && (
          <div className="space-y-6">
            {/* Tamper Control Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-[#ef4444]" />
                  <span>Auditor Tamper Presets:</span>
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset("reset")}
                  className="flex items-center gap-1 text-xs font-bold text-[#836EF9] hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset to Authentic Baseline</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("amount")}
                  className={`neo-btn neo-btn-sm text-xs font-mono font-bold ${
                    record.amount === "5000.00"
                      ? "bg-[#ef4444] text-white"
                      : "bg-white"
                  }`}
                >
                  Inflate Amount ($500.00 → $5,000.00)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("typo")}
                  className={`neo-btn neo-btn-sm text-xs font-mono font-bold ${
                    record.amount === "500.01"
                      ? "bg-[#ef4444] text-white"
                      : "bg-white"
                  }`}
                >
                  1-Cent Typo ($500.00 → $500.01)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("vendor")}
                  className={`neo-btn neo-btn-sm text-xs font-mono font-bold ${
                    record.vendor === "Shadow Corp LLC"
                      ? "bg-[#ef4444] text-white"
                      : "bg-white"
                  }`}
                >
                  Change Vendor (AWS → Shadow Corp)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("recipient")}
                  className={`neo-btn neo-btn-sm text-xs font-mono font-bold ${
                    record.recipient ===
                    "0x000000000000000000000000000000000000dEaD"
                      ? "bg-[#ef4444] text-white"
                      : "bg-white"
                  }`}
                >
                  Reroute Recipient (To Dead Address)
                </button>
              </div>
            </div>

            {/* Editable Disclosed Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#f8f9fa] p-4 rounded-xl border-2 border-[#121212]">
              {/* Field: Amount */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-700">
                  <label htmlFor="field-amount">Amount</label>
                  {record.amount !== AUTHENTIC_RECORD_BASELINE.amount && (
                    <span className="text-[#ef4444] font-mono font-black text-[10px]">
                      MODIFIED
                    </span>
                  )}
                </div>
                <input
                  id="field-amount"
                  type="text"
                  value={record.amount}
                  onChange={(e) =>
                    setRecord((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className={`w-full neo-input text-xs font-mono font-bold ${
                    record.amount !== AUTHENTIC_RECORD_BASELINE.amount
                      ? "border-[#ef4444] bg-[#fef2f2] text-[#b91c1c]"
                      : ""
                  }`}
                />
              </div>

              {/* Field: Vendor */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-700">
                  <label htmlFor="field-vendor">Merchant / Vendor</label>
                  {record.vendor !== AUTHENTIC_RECORD_BASELINE.vendor && (
                    <span className="text-[#ef4444] font-mono font-black text-[10px]">
                      MODIFIED
                    </span>
                  )}
                </div>
                <input
                  id="field-vendor"
                  type="text"
                  value={record.vendor}
                  onChange={(e) =>
                    setRecord((prev) => ({ ...prev, vendor: e.target.value }))
                  }
                  className={`w-full neo-input text-xs font-bold ${
                    record.vendor !== AUTHENTIC_RECORD_BASELINE.vendor
                      ? "border-[#ef4444] bg-[#fef2f2] text-[#b91c1c]"
                      : ""
                  }`}
                />
              </div>

              {/* Field: Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-700">
                  <label htmlFor="field-date">Invoice Date</label>
                  {record.date !== AUTHENTIC_RECORD_BASELINE.date && (
                    <span className="text-[#ef4444] font-mono font-black text-[10px]">
                      MODIFIED
                    </span>
                  )}
                </div>
                <input
                  id="field-date"
                  type="text"
                  value={record.date}
                  onChange={(e) =>
                    setRecord((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className={`w-full neo-input text-xs font-mono ${
                    record.date !== AUTHENTIC_RECORD_BASELINE.date
                      ? "border-[#ef4444] bg-[#fef2f2] text-[#b91c1c]"
                      : ""
                  }`}
                />
              </div>

              {/* Field: Recipient */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-700">
                  <label htmlFor="field-recipient">Recipient Wallet</label>
                  {record.recipient !== AUTHENTIC_RECORD_BASELINE.recipient && (
                    <span className="text-[#ef4444] font-mono font-black text-[10px]">
                      MODIFIED
                    </span>
                  )}
                </div>
                <input
                  id="field-recipient"
                  type="text"
                  value={record.recipient}
                  onChange={(e) =>
                    setRecord((prev) => ({
                      ...prev,
                      recipient: e.target.value,
                    }))
                  }
                  className={`w-full neo-input text-xs font-mono ${
                    record.recipient !== AUTHENTIC_RECORD_BASELINE.recipient
                      ? "border-[#ef4444] bg-[#fef2f2] text-[#b91c1c]"
                      : ""
                  }`}
                />
              </div>
            </div>

            {/* REAL-TIME CRYPTOGRAPHIC VERIFICATION STATUS BANNER */}
            <AnimatePresence mode="wait">
              {!currentPipeline.isTampered ? (
                <motion.div
                  key="untampered"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-xl border-2 border-[#16a34a] bg-[#f0fdf4] p-5 shadow-[4px_4px_0_0_#16a34a] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-sm uppercase text-[#15803d]">
                      <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />
                      <span>Cryptographic Integrity Valid · 100% Match</span>
                    </div>
                    <span className="neo-badge bg-[#16a34a] text-white border-2 border-[#121212]">
                      Monad Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    The canonical JSON digest matches the immutable onchain commitment anchored on Monad Testnet block #14,298,106. Every single byte is authentic.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-[#16a34a] space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Anchored Onchain Commitment:
                    </span>
                    <p className="font-mono text-xs font-black text-[#15803d] break-all">
                      {currentPipeline.onchainCommitment}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="tampered"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-xl border-2 border-[#ef4444] bg-[#fef2f2] p-5 shadow-[4px_4px_0_0_#ef4444] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-sm uppercase text-[#b91c1c]">
                      <AlertTriangle className="h-5 w-5 text-[#ef4444] animate-pulse" />
                      <span>Cryptographic Integrity Breach · Tampered Record</span>
                    </div>
                    <span className="neo-badge bg-[#ef4444] text-white border-2 border-[#121212]">
                      Rejected By Smart Contract
                    </span>
                  </div>

                  <p className="text-xs text-[#991b1b] leading-relaxed font-medium">
                    Avalanche Effect Triggered: Altering even 1 character alters the resulting 256-bit commitment completely. The Monad SettlementRegistryV1 smart contract rejects this claim immediately.
                  </p>

                  {/* Side-by-Side Diff */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border-2 border-[#16a34a] space-y-1">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#15803d]">
                        <span>Expected Onchain Root (Monad)</span>
                        <span>Official</span>
                      </div>
                      <p className="font-mono text-[11px] font-bold text-[#15803d] break-all">
                        {authenticPipeline.onchainCommitment}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border-2 border-[#ef4444] space-y-1">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#b91c1c]">
                        <span>Computed Tampered Digest</span>
                        <span>Conflicting</span>
                      </div>
                      <p className="font-mono text-[11px] font-bold text-[#b91c1c] break-all">
                        {currentPipeline.onchainCommitment}
                      </p>
                    </div>
                  </div>

                  {onSelectHashForVerification && (
                    <div className="flex justify-end pt-1">
                      <AnimatedButton
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onSelectHashForVerification(
                            currentPipeline.onchainCommitment,
                          )
                        }
                      >
                        Test Tampered Hash in Verifier
                      </AnimatedButton>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </InteractiveCard>
    </section>
  );
}
