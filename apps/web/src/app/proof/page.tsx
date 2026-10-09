"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModeHeader } from "@/components/layout/mode-header";
import {
  ShieldCheck,
  CheckCircle2,
  Check,
  Copy,
  ExternalLink,
  Hash,
  Lock,
  Search,
  AlertTriangle,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import type { PlatformMode } from "@/lib/supabase/types";
import {
  TextEffect,
  InteractiveCard,
  AnimatedButton,
  ScrollProgress,
  AnimatedBackground,
  BorderTrail,
  ContextualIconSwap,
} from "@/components/ui/motion";
import { InteractiveProofVisualizer } from "@/components/proof/interactive-proof-visualizer";
import { motion, AnimatePresence } from "motion/react";

interface VerificationResult {
  verified: boolean;
  hash: string;
  chain: string;
  chainId: number;
  timestamp?: string;
  monadBlock?: number;
  txHash?: string;
  explorerUrl?: string;
  contractAddress?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export default function ProofCenterPage() {
  const router = useRouter();
  const verifierSectionRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<PlatformMode>("personal");
  const [inputHash, setInputHash] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  const [copied, setCopied] = useState(false);

  function handleSelectHashForVerification(hash: string) {
    setInputHash(hash);
    if (verifierSectionRef.current) {
      verifierSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const queryHash = inputHash.trim();
    if (!queryHash) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const res = await fetch("/api/proof/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: queryHash }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerificationResult({
          verified: Boolean(data.verified),
          hash: data.hash || queryHash,
          chain: data.chain || "Monad Testnet",
          chainId: data.chainId || 10143,
          timestamp: data.timestamp || new Date().toISOString(),
          monadBlock: data.blockNumber,
          txHash: data.txHash,
          explorerUrl: data.explorerUrl,
          contractAddress: data.contractAddress,
          error: data.error,
          metadata: data.metadata,
        });
      } else {
        setVerificationResult({
          verified: false,
          hash: queryHash,
          chain: "Monad Testnet",
          chainId: 10143,
          error:
            data.error ||
            "The hash could not be verified on Monad Testnet (Chain ID 10143).",
        });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to verify onchain";
      setVerificationResult({
        verified: false,
        hash: queryHash,
        chain: "Monad Testnet",
        chainId: 10143,
        error: `Network error connecting to Monad verification service: ${errorMsg}`,
      });
    } finally {
      setIsVerifying(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans relative">
      <ScrollProgress />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page-Level Header: Mode Selector */}
        <ModeHeader
          currentMode={activeMode}
          onModeChange={(m) => {
            setActiveMode(m);
            router.push(`/?mode=${m}`);
          }}
        />

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="neo-badge neo-badge-purple">
              <ShieldCheck className="h-4 w-4" />
              <span>Monad Cryptographic Verification Spine</span>
            </span>
          </div>
          <TextEffect
            preset="fade-in-blur"
            per="word"
            as="h1"
            className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-[#121212]"
          >
            Proof Center
          </TextEffect>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed text-pretty">
            Verify the cryptographic integrity of any financial record, receipt,
            or expense reimbursement without revealing private underlying
            contents.
          </p>
        </div>

        {/* Primary Mode Navigation Bar with AnimatedBackground */}
        <nav
          aria-label="Proof Primary Navigation"
          className="p-1.5 bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl flex items-center gap-1.5 overflow-x-auto"
        >
          <AnimatedBackground
            defaultValue="proof"
            className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {[
              {
                id: "overview",
                label: "Overview",
                href: "/?mode=crypto&view=overview",
              },
              {
                id: "receipts",
                label: "Receipts (OCR)",
                href: "/receipts",
              },
              {
                id: "subscriptions",
                label: "Subscriptions",
                href: "/subscriptions",
              },
              {
                id: "budgets",
                label: "Budgets & Goals",
                href: "/budgets",
              },
              {
                id: "proof",
                label: "Proof Center",
                href: "/proof",
              },
            ].map((tab) => {
              const isActive = tab.id === "proof";
              return (
                <Link
                  key={tab.id}
                  data-id={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-[#121212] hover:text-[#836EF9]"
                  }`}
                >
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </AnimatedBackground>
        </nav>

        {/* Invariant Cards with InteractiveCard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <InteractiveCard
            enableTilt={true}
            enableSpotlight={true}
            rotationFactor={3}
            className="neo-card p-5 space-y-3 shadow-[3px_3px_0_0_#121212] flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-[#121212] text-balance">
                Private Offchain Evidence
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium text-pretty">
                Receipts, item descriptions, and vendor details remain private
                in encrypted Supabase storage. Zero private data enters public
                calldata.
              </p>
            </div>
          </InteractiveCard>

          <InteractiveCard
            enableTilt={true}
            enableSpotlight={true}
            rotationFactor={3}
            className="neo-card p-5 space-y-3 shadow-[3px_3px_0_0_#121212] flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fef9c3] text-[#a16207] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                <Hash className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-[#121212] text-balance">
                RFC 8785 Canonical Hashes
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium text-pretty">
                Every expense state is serialized canonically and hashed via
                SHA-256 / Keccak-256. Any material edit produces a new immutable
                record version.
              </p>
            </div>
          </InteractiveCard>

          <InteractiveCard
            enableTilt={true}
            enableSpotlight={true}
            rotationFactor={3}
            className="neo-card p-5 space-y-3 shadow-[3px_3px_0_0_#121212] flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f0ff] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] p-1.5">
                <MonadLogo className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wide text-[#121212] text-balance">
                Monad 10,000 TPS Trust
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium text-pretty">
                Proof roots are anchored on Monad Testnet (Chain ID 10143) with
                sub-second finality, providing non-repudiable audit trails.
              </p>
            </div>
          </InteractiveCard>
        </div>

        {/* Feature 3: Interactive Cryptographic Proof Visualizer & Tamper Simulator */}
        <InteractiveProofVisualizer
          onSelectHashForVerification={handleSelectHashForVerification}
        />

        {/* Interactive Hash Verifier */}
        <div ref={verifierSectionRef}>
          <InteractiveCard
            enableTilt={false}
            enableSpotlight={true}
            className="neo-card p-6 space-y-6 shadow-[4px_4px_0_0_#121212] relative overflow-hidden bg-white"
          >
            {isVerifying && (
              <BorderTrail
                size={100}
                className="bg-[#836EF9]"
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
            )}
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-wider text-[#121212] text-balance">
                Onchain Hash Verifier
              </h2>
              <p className="text-xs text-slate-500 text-pretty">
                Enter any SHA-256 receipt fingerprint or commitment hash to
                inspect its onchain status.
              </p>
            </div>

            <form
              onSubmit={handleVerify}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={inputHash}
                  onChange={(e) => setInputHash(e.target.value)}
                  placeholder="Paste SHA-256 hash (e.g. 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069)..."
                  className="w-full neo-input pl-10 font-mono"
                />
              </div>

              <AnimatedButton
                type="submit"
                variant="primary"
                size="md"
                isLoading={isVerifying}
                loadingText="Verifying on Monad..."
                disabled={isVerifying}
              >
                Verify Onchain
              </AnimatedButton>
            </form>

            {/* Verification Result Card */}
            <AnimatePresence>
              {verificationResult && verificationResult.verified && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="rounded-xl border-2 border-[#121212] bg-[#f8f9fa] p-5 space-y-4 shadow-[3px_3px_0_0_#121212]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#15803d] font-black uppercase tracking-wide text-sm">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Cryptographic Proof Valid & Anchored</span>
                    </div>
                    <span className="neo-badge neo-badge-purple flex items-center gap-1.5">
                      <MonadLogo className="h-3.5 w-3.5" />
                      {verificationResult.chain}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-lg bg-white p-3 border-2 border-[#121212] space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold uppercase">
                        <span>Verified Fingerprint</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(verificationResult.hash)}
                          className="relative flex items-center gap-1 text-[#836EF9] hover:text-[#121212] transition-colors duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                          title="Copy verified fingerprint"
                          aria-label="Copy verified fingerprint"
                        >
                          <ContextualIconSwap
                            isActive={copied}
                            initialIcon={<Copy className="h-3 w-3" />}
                            activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                          />
                          <span>{copied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-slate-700 truncate font-semibold">
                        {verificationResult.hash}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 border-2 border-[#121212] space-y-1">
                      <span className="text-[11px] text-slate-600 font-bold uppercase">
                        Monad Testnet Block
                      </span>
                      <p className="font-mono text-xs text-[#836EF9] font-black tabular-nums">
                        {verificationResult.monadBlock
                          ? `#${verificationResult.monadBlock}`
                          : "Confirmed Onchain"}
                      </p>
                    </div>
                  </div>

                  {verificationResult.metadata &&
                    Object.keys(verificationResult.metadata).length > 0 && (
                      <div className="rounded-lg bg-white p-3 border-2 border-[#121212] text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Associated Offchain Record
                        </span>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {Boolean(verificationResult.metadata.receiptNumber) && (
                            <span className="neo-badge text-[10px]">
                              {String(verificationResult.metadata.receiptNumber)}
                            </span>
                          )}
                          {Boolean(verificationResult.metadata.receiptName) && (
                            <span className="font-semibold text-slate-800">
                              {String(verificationResult.metadata.receiptName)}
                            </span>
                          )}
                          {Boolean(verificationResult.metadata.totalAmount) && (
                            <span className="font-mono font-bold text-[#836EF9] tabular-nums">
                              $
                              {Number(
                                verificationResult.metadata.totalAmount,
                              ).toFixed(2)}{" "}
                              {String(
                                verificationResult.metadata.currency || "USD",
                              )}
                            </span>
                          )}
                          {Boolean(verificationResult.metadata.merchant) && (
                            <span className="font-semibold text-slate-800">
                              Merchant:{" "}
                              {String(verificationResult.metadata.merchant)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 text-xs gap-2">
                    <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                      Confirmed:{" "}
                      {verificationResult.timestamp
                        ? new Date(verificationResult.timestamp).toLocaleString()
                        : "Verified"}
                    </span>

                    {verificationResult.explorerUrl && (
                      <a
                        href={verificationResult.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[#836EF9] hover:underline transition-colors duration-150 ease-out font-bold"
                      >
                        <MonadLogo className="h-3.5 w-3.5" />
                        <span>View Monad Testnet Explorer</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Unverified / Not Found Result Card */}
              {verificationResult && !verificationResult.verified && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="rounded-xl border-2 border-[#ef4444] bg-[#fef2f2] p-5 space-y-3 shadow-[3px_3px_0_0_#121212]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#b91c1c] font-black uppercase tracking-wide text-sm">
                      <AlertTriangle className="h-5 w-5" />
                      <span>Unconfirmed / Fingerprint Not Found</span>
                    </div>
                    <span className="neo-badge bg-white text-slate-700 border-2 border-[#121212]">
                      {verificationResult.chain} (Chain{" "}
                      {verificationResult.chainId})
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium text-pretty">
                    {verificationResult.error ||
                      "The provided cryptographic hash or transaction could not be verified on Monad Testnet."}
                  </p>

                  <div className="rounded-lg bg-white p-3 border border-[#ef4444] space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                      Queried Hash
                    </span>
                    <p className="font-mono text-[11px] text-slate-800 break-all">
                      {verificationResult.hash}
                    </p>
                  </div>

                  <div className="pt-1 text-[11px] text-slate-600 flex items-center gap-1">
                    <span>
                      Tip: Anchor a receipt bundle or transaction from the
                    </span>
                    <Link
                      href="/receipts"
                      className="text-[#836EF9] font-bold underline"
                    >
                      Receipts Page
                    </Link>
                    <span>to generate an immutable Monad proof.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </InteractiveCard>
        </div>
      </main>
    </div>
  );
}
