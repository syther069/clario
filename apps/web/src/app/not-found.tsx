import Link from "next/link";
import { ShieldCheck, Home, FileSearch } from "lucide-react";
import { ClarioLogo } from "@/components/ui/clario-logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans">
      {/* Mini top bar */}
      <header className="border-b-2 border-[#121212] bg-white px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ClarioLogo size={32} />
          <span className="text-sm font-black uppercase tracking-wider text-[#121212]">
            Clario <span className="text-[#836EF9]">Monad</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase text-[#15803d] bg-[#dcfce7] border-1.5 border-[#121212] px-2.5 py-1 rounded-full shadow-[1px_1px_0_0_#121212]">
          <ShieldCheck className="h-3 w-3" />
          <span>Vault Active & Protected</span>
        </div>
      </header>

      {/* Main 404 Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white border-2 border-[#121212] rounded-2xl shadow-[8px_8px_0_0_#121212] p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#f3f0ff] border-2 border-[#121212] flex items-center justify-center text-[#836EF9] shadow-[3px_3px_0_0_#121212] mb-5">
            <span className="text-2xl font-black font-mono">404</span>
          </div>

          <div className="inline-block text-[11px] font-mono font-black uppercase tracking-wider bg-[#fef08a] border-1.5 border-[#121212] text-[#854d0e] px-3 py-0.5 rounded-full shadow-[1px_1px_0_0_#121212] mb-3">
            Ledger Record Not Found
          </div>

          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-[#121212] mb-3">
            Requested Page Does Not Exist
          </h1>

          <div className="bg-[#f0fdf4] border-2 border-[#121212] rounded-xl p-4 text-xs text-[#166534] font-medium leading-relaxed mb-6 shadow-[2px_2px_0_0_#121212] text-left">
            <div className="flex items-center gap-2 font-black uppercase font-mono text-[11px] text-[#15803d] mb-1">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#16a34a]" />
              <span>Your Financial Records Are 100% Safe</span>
            </div>
            This navigation anomaly has zero effect on your connected wallet,
            offchain encrypted receipts, or Monad cryptographic proofs. Your
            financial data is securely preserved.
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              href="/"
              className="flex-1 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <Home className="h-4 w-4" />
              <span>Return to Overview</span>
            </Link>

            <Link
              href="/proof"
              className="flex-1 border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <FileSearch className="h-4 w-4 text-[#836EF9]" />
              <span>Proof Center</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer reassurance */}
      <footer className="border-t-2 border-[#121212] bg-white py-3 px-4 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
        Non-Custodial • AES-256 Offchain Encrypted • Monad Consensus Verified
      </footer>
    </div>
  );
}
