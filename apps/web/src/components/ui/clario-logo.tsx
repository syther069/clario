import React from "react";
import Image from "next/image";

export interface ClarioLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

/**
 * Clario Official Brand Logo
 * High-definition glossy Monad purple squircle with bold geometric white 'C' monogram.
 */
export function ClarioLogo({
  size = "md",
  className = "",
  alt = "Clario Logo",
  priority = false,
  ...props
}: ClarioLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 32;

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-visible ${className}`}
      {...props}
    >
      <Image
        src="/clario-logo.png"
        alt={alt}
        width={pixelSize * 2}
        height={pixelSize * 2}
        priority={priority}
        className="w-full h-full object-contain pointer-events-none"
      />
    </div>
  );
}

/**
 * Clario Logo with Wordmark Brand Lockup
 */
export function ClarioBrandLockup({
  size = "md",
  showBadge = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <ClarioLogo size={size} />
      <div className="flex items-center gap-1.5">
        <span className="font-black tracking-wider text-[#121212] uppercase font-sans text-base sm:text-lg">
          Clario
        </span>
        {showBadge && (
          <span className="inline-flex items-center gap-1 rounded bg-[#836EF9]/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-[#836EF9] border border-[#836EF9]/30">
            Monad
          </span>
        )}
      </div>
    </div>
  );
}
