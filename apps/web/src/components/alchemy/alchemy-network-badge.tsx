"use client";

import React, { useEffect, useState } from "react";
import { Activity, ShieldCheck, Zap } from "lucide-react";
import { getMonadPublicClient, getMonadRpcProviderInfo } from "@/lib/blockchain/registry";

export function AlchemyNetworkBadge() {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [providerInfo, setProviderInfo] = useState(() => getMonadRpcProviderInfo());

  useEffect(() => {
    let isMounted = true;
    setProviderInfo(getMonadRpcProviderInfo());

    async function probeMonadNode() {
      try {
        const client = getMonadPublicClient();
        const start = performance.now();
        const block = await client.getBlockNumber();
        const elapsed = Math.round(performance.now() - start);

        if (isMounted) {
          setBlockNumber(block);
          setLatencyMs(elapsed);
        }
      } catch {
        // Fallback gracefully without breaking UI
      }
    }

    probeMonadNode();
    const interval = setInterval(probeMonadNode, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="flex items-center gap-1.5 rounded-lg border-2 border-black bg-white px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider uppercase text-black shadow-[2px_2px_0px_#000] transition-transform hover:-translate-y-0.5 cursor-pointer select-none"
        title={`Connected to Monad Testnet via ${providerInfo.providerName}`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
              providerInfo.isAlchemy ? "bg-[#836EF9]" : "bg-emerald-500"
            } opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              providerInfo.isAlchemy ? "bg-[#836EF9]" : "bg-emerald-500"
            }`}
          />
        </span>
        <Zap
          className={`h-3 w-3 ${
            providerInfo.isAlchemy ? "text-[#836EF9]" : "text-emerald-600"
          } stroke-[2.5]`}
        />
        <span>Monad Testnet</span>
        <span
          className={
            providerInfo.isAlchemy
              ? "text-[#836EF9] font-black"
              : "text-slate-700 font-bold"
          }
        >
          • {providerInfo.isAlchemy ? "Alchemy" : "Public RPC"}
        </span>
        {latencyMs !== null && (
          <span className="text-gray-500 hidden md:inline">
            ({latencyMs}ms)
          </span>
        )}
      </div>

      {/* Expanded Diagnostics Tooltip */}
      {isHovered && (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 rounded-lg border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000] text-xs font-mono">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black/10">
            <span className="font-black text-[#121212] uppercase flex items-center gap-1">
              <ShieldCheck
                className={`h-3.5 w-3.5 ${
                  providerInfo.isAlchemy ? "text-[#836EF9]" : "text-emerald-600"
                }`}
              />
              {providerInfo.providerName}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                providerInfo.isAlchemy
                  ? "bg-[#836EF9]/10 text-[#836EF9]"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-300"
              }`}
            >
              {providerInfo.isAlchemy ? "Alchemy Active" : "Fallback Active"}
            </span>
          </div>

          <div className="space-y-1.5 text-gray-700 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Network:</span>
              <span className="font-bold text-black">Monad Testnet (10143)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Transport:</span>
              <span
                className={`font-bold ${
                  providerInfo.isAlchemy ? "text-[#836EF9]" : "text-slate-800"
                }`}
              >
                {providerInfo.endpointHost}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current Block:</span>
              <span className="font-bold text-black">
                {blockNumber ? `#${blockNumber.toString()}` : "Syncing..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Latency:</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {latencyMs ? `${latencyMs}ms (Measured)` : "Measuring..."}
              </span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t-2 border-black/10 text-[10px] text-gray-500">
            {providerInfo.isAlchemy
              ? "Features: Pre-Flight Simulation • WebSockets • Monad RPC"
              : "Features: Direct Monad RPC Transport • Explorer Fallback"}
          </div>
        </div>
      )}
    </div>
  );
}
