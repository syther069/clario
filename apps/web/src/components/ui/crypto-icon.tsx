"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";

export type SupportedChain =
  | "monad"
  | "ethereum"
  | "base"
  | "hyperliquid"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "sepolia"
  | "base-sepolia"
  | number;

export type SupportedToken =
  | "MON"
  | "ETH"
  | "USDC"
  | "USDT"
  | "HYPE"
  | "ARB"
  | "OP"
  | "POL"
  | "MATIC"
  | "BTC"
  | "WBTC"
  | "LTC"
  | "DAI"
  | string;

interface CryptoIconProps {
  className?: string | undefined;
  size?: number | string | undefined;
}

// 1. Monad Logo (Official Token & Chain Image)
export function MonadLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <img
      src="/icons/tokens/monad.png"
      alt="Monad"
      className={`inline-block object-contain rounded-full shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
    />
  );
}

// 2. Ethereum Logo (Official Token & Chain Image)
export function EthereumLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <img
      src="/icons/tokens/ethereum-diamond.png"
      alt="Ethereum"
      className={`inline-block object-contain rounded-full shrink-0 bg-white ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
    />
  );
}

// 3. Base Circle Logo
export function BaseLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 115 115"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Base"
    >
      <circle cx="57.5" cy="57.5" r="57.5" fill="#0052FF" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M57.5 90C75.4493 90 90 75.4493 90 57.5C90 39.5507 75.4493 25 57.5 25C39.5507 25 25 39.5507 25 57.5C25 75.4493 39.5507 90 57.5 90ZM57.5 73C66.0604 73 73 66.0604 73 57.5C73 48.9396 66.0604 42 57.5 42H43V73H57.5Z"
        fill="white"
      />
    </svg>
  );
}

// 4. Hyperliquid (HYPE) Logo (Official Token & Chain Image)
export function HyperliquidLogo({
  className = "h-5 w-5",
  size,
}: CryptoIconProps) {
  return (
    <img
      src="/icons/tokens/hyperliquid.png"
      alt="Hyperliquid"
      className={`inline-block object-contain rounded-full shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
    />
  );
}

// 5. USD Coin (USDC) Logo (Official Token Image)
export function UsdcLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <img
      src="/icons/tokens/usdc.png"
      alt="USDC"
      className={`inline-block object-contain rounded-full shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
    />
  );
}

// 6. Tether (USDT) Logo (Official Token Image)
export function UsdtLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <img
      src="/icons/tokens/usdt.png"
      alt="Tether USDT"
      className={`inline-block object-contain rounded-full shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
    />
  );
}

// 7. Arbitrum Logo (Official Blue Vector)
export function ArbitrumLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Arbitrum"
    >
      <circle cx="50" cy="50" r="50" fill="#28A0F0" />
      <path d="M50 20L76 65H63L50 42L37 65H24L50 20Z" fill="white" />
      <path d="M50 52L60 70H40L50 52Z" fill="#121B44" />
    </svg>
  );
}

// 8. Optimism Logo (Official Red Emblem)
export function OptimismLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Optimism"
    >
      <circle cx="50" cy="50" r="50" fill="#FF0420" />
      <path
        d="M34 33C24.6 33 17 40.6 17 50C17 59.4 24.6 67 34 67C43.4 67 51 59.4 51 50C51 40.6 43.4 33 34 33ZM34 58C29.6 58 26 54.4 26 50C26 45.6 29.6 42 34 42C38.4 42 42 45.6 42 50C42 54.4 38.4 58 34 58ZM56 34H68C76.3 34 83 40.7 83 49C83 57.3 76.3 64 68 64H65V67H56V34ZM65 43V55H68C71.3 55 74 52.3 74 49C74 45.7 71.3 43 68 43H65Z"
        fill="white"
      />
    </svg>
  );
}

// 9. Polygon (POL) Logo (Official Purple Vector)
export function PolygonLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Polygon"
    >
      <circle cx="50" cy="50" r="50" fill="#8247E5" />
      <path
        d="M72 40L57 31.3C55.8 30.6 54.2 30.6 53 31.3L38 40C36.8 40.7 36 42.1 36 43.5V60.9C36 62.3 36.8 63.7 38 64.4L53 73.1C54.2 73.8 55.8 73.8 57 73.1L72 64.4C73.2 63.7 74 62.3 74 60.9V43.5C74 42.1 73.2 40.7 72 40Z"
        stroke="white"
        strokeWidth="6"
        fill="none"
      />
      <circle cx="55" cy="52" r="7" fill="white" />
    </svg>
  );
}

// 10. Bitcoin Logo (Official Vector)
export function BitcoinLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="#F7931A"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Bitcoin"
    >
      <title>Bitcoin</title>
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
    </svg>
  );
}

// 11. Litecoin Logo (Official Vector)
export function LitecoinLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="#345D9D"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Litecoin"
    >
      <title>Litecoin</title>
      <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm-.2617 3.6777h2.584a.3425.3425 0 01.33.4356l-2.0312 6.918 1.9062-.582-.4082 1.3847-1.9238.5605-1.248 4.213h6.6757a.3425.3425 0 01.3282.4374l-.582 2a.4586.4586 0 01-.4395.3301H6.7324l1.7227-5.8223-1.9063.5801.42-1.3613 1.9101-.58 2.4219-8.1798a.4557.4557 0 01.4375-.334Z" />
    </svg>
  );
}

// 12. DAI Logo
export function DaiLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="DAI"
    >
      <circle cx="50" cy="50" r="48" fill="#F5AC37" />
      <path
        d="M36 28H52C63 28 72 37 72 48C72 59 63 68 52 68H36V28ZM44 36V45H60V49H44V55H60V59H44V61H52C59 61 64 55 64 48C64 41 59 36 52 36H44Z"
        fill="white"
      />
    </svg>
  );
}

// 13. Alchemy Official Brand Logo (Hackathon Bounty Target)
export function AlchemyLogo({ className = "h-5 w-5", size }: CryptoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Alchemy"
    >
      <rect width="100" height="100" rx="20" fill="#0052FF" />
      <path d="M50 20L75 65H25L50 20Z" fill="white" fillOpacity="0.9" />
      <path d="M50 42L65 72H35L50 42Z" fill="#0052FF" />
      <circle cx="50" cy="72" r="6" fill="white" />
    </svg>
  );
}

/**
 * Universal Chain Icon Component (Real logos for all supported chains)
 */
export function CryptoChainIcon({
  chain,
  className = "h-4 w-4 shrink-0",
  size,
}: {
  chain: SupportedChain | string;
  className?: string | undefined;
  size?: number | string | undefined;
}) {
  const norm = String(chain).toLowerCase();

  if (
    norm === "143" ||
    norm === "10143" ||
    norm === "1337" ||
    norm.includes("monad")
  ) {
    return <MonadLogo className={className} size={size} />;
  }

  if (
    norm === "1" ||
    norm === "11155111" ||
    norm.includes("ethereum") ||
    norm.includes("sepolia") ||
    norm === "eth"
  ) {
    return <EthereumLogo className={className} size={size} />;
  }

  if (norm === "8453" || norm === "84532" || norm.includes("base")) {
    return <BaseLogo className={className} size={size} />;
  }

  if (norm === "999" || norm.includes("hyperliquid") || norm.includes("hype")) {
    return <HyperliquidLogo className={className} size={size} />;
  }

  if (norm === "42161" || norm.includes("arbitrum") || norm.includes("arb")) {
    return <ArbitrumLogo className={className} size={size} />;
  }

  if (norm === "10" || norm.includes("optimism") || norm.includes("opt")) {
    return <OptimismLogo className={className} size={size} />;
  }

  if (
    norm === "137" ||
    norm.includes("polygon") ||
    norm.includes("matic") ||
    norm.includes("pol")
  ) {
    return <PolygonLogo className={className} size={size} />;
  }

  // Fallback generic crypto chain emblem
  return <EthereumLogo className={className} size={size} />;
}

/**
 * Universal Coin / Asset Token Component (Real logos for all tokens)
 */
export function CryptoCoinIcon({
  symbol,
  className = "h-4 w-4 shrink-0",
  size,
}: {
  symbol: SupportedToken;
  className?: string | undefined;
  size?: number | string | undefined;
}) {
  const norm = symbol?.toUpperCase().trim() || "";

  switch (norm) {
    case "MON":
      return <MonadLogo className={className} size={size} />;
    case "ETH":
    case "WETH":
      return <EthereumLogo className={className} size={size} />;
    case "USDC":
      return <UsdcLogo className={className} size={size} />;
    case "USDT":
      return <UsdtLogo className={className} size={size} />;
    case "HYPE":
      return <HyperliquidLogo className={className} size={size} />;
    case "ARB":
      return <ArbitrumLogo className={className} size={size} />;
    case "OP":
      return <OptimismLogo className={className} size={size} />;
    case "POL":
    case "MATIC":
      return <PolygonLogo className={className} size={size} />;
    case "BTC":
    case "WBTC":
      return <BitcoinLogo className={className} size={size} />;
    case "LTC":
      return <LitecoinLogo className={className} size={size} />;
    case "DAI":
      return <DaiLogo className={className} size={size} />;
    default:
      return (
        <div
          className={`rounded-full bg-[#836EF9] text-white flex items-center justify-center font-mono font-black text-[9px] ${className}`}
          style={size ? { width: size, height: size } : undefined}
        >
          {norm.slice(0, 3)}
        </div>
      );
  }
}

/**
 * Automatically inspects any text (e.g. payment_method, merchant, description)
 * to detect matching crypto chains or coin symbols.
 */
export function detectCryptoIdentity(text?: string | null): {
  kind: "chain" | "token";
  identifier: string;
} | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Explicit Stablecoins & Tokens first (e.g. USDC, USDT, DAI, WBTC)
  if (lower.includes("usdc")) return { kind: "token", identifier: "USDC" };
  if (lower.includes("usdt") || lower.includes("tether"))
    return { kind: "token", identifier: "USDT" };
  if (
    lower.includes("wbtc") ||
    lower.includes("btc") ||
    lower.includes("bitcoin")
  ) {
    return { kind: "token", identifier: "BTC" };
  }
  if (lower.includes("ltc") || lower.includes("litecoin")) {
    return { kind: "token", identifier: "LTC" };
  }
  if (lower.includes("dai")) return { kind: "token", identifier: "DAI" };

  // 2. Specific Chains
  if (
    lower.includes("monad") ||
    lower.includes("143") ||
    lower.includes("10143")
  ) {
    return { kind: "chain", identifier: "143" };
  }
  if (
    lower.includes("hyperliquid") ||
    lower.includes("999") ||
    lower.includes("hype")
  ) {
    return { kind: "chain", identifier: "999" };
  }
  if (
    lower.includes("base") ||
    lower.includes("8453") ||
    lower.includes("coinbase")
  ) {
    return { kind: "chain", identifier: "8453" };
  }
  if (lower.includes("arbitrum") || lower.includes("42161")) {
    return { kind: "chain", identifier: "42161" };
  }
  if (lower.includes("optimism") || lower.includes("10")) {
    return { kind: "chain", identifier: "10" };
  }
  if (
    lower.includes("polygon") ||
    lower.includes("137") ||
    lower.includes("matic")
  ) {
    return { kind: "chain", identifier: "137" };
  }
  if (
    lower.includes("ethereum") ||
    lower.includes("mainnet") ||
    lower.includes("sepolia")
  ) {
    return { kind: "chain", identifier: "1" };
  }

  // 3. Native Tokens
  if (lower.includes("eth") || lower.includes("ether")) {
    return { kind: "token", identifier: "ETH" };
  }
  if (lower.includes("mon")) return { kind: "token", identifier: "MON" };

  // 4. Generic "onchain" fallback defaults to Monad
  if (lower.includes("onchain") && !lower.includes("card")) {
    return { kind: "chain", identifier: "143" };
  }

  return null;
}

/**
 * Neo-Brutalist badge with real crypto icon
 */
export function CryptoBadge({
  text,
  className = "",
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) return null;
  const match = detectCryptoIdentity(text);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-800 ${className}`}
    >
      {match?.kind === "chain" && (
        <CryptoChainIcon
          chain={match.identifier}
          className="h-3.5 w-3.5 shrink-0"
        />
      )}
      {match?.kind === "token" && (
        <CryptoCoinIcon
          symbol={match.identifier}
          className="h-3.5 w-3.5 shrink-0"
        />
      )}
      <span>{text}</span>
    </span>
  );
}

/**
 * Prominent Hackathon Attribution Badge (Rule 8)
 */
export function AlchemyAttributionBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#f0f4ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0052FF] shadow-[2px_2px_0_0_#121212] ${className}`}
    >
      <AlchemyLogo className="h-3.5 w-3.5 shrink-0" />
      <span>Fetched via Alchemy</span>
    </span>
  );
}
