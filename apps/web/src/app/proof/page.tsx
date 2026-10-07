"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProofRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/landing");
  }, [router]);

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center p-4">
      <div className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] bg-white border-2 border-[#121212] p-4 rounded-xl shadow-[3px_3px_0_0_#121212]">
        Redirecting to Clario Verification...
      </div>
    </div>
  );
}
