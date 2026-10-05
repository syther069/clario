import React from "react";

interface ClarioLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  withShadow?: boolean;
}

const SIZE_MAP = {
  sm: 24,
  md: 36,
  lg: 40,
  xl: 48,
};

/**
 * Clario Official Brand Logo
 * Neo-Brutalist Monad Purple (#836EF9) squircle badge with crisp #121212 border,
 * hard 2D offset box shadow, and geometric white 'C' monogram.
 */
export function ClarioLogo({
  size = "md",
  className = "",
  withShadow = true,
  ...props
}: ClarioLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 36;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Clario Logo"
      role="img"
      {...props}
    >
      {/* Neo-Brutalist Hard 2D Offset Shadow */}
      {withShadow && (
        <rect
          x="12"
          y="12"
          width="80"
          height="80"
          rx="24"
          fill="#121212"
        />
      )}

      {/* Main Squircle Container */}
      <rect
        x="8"
        y="8"
        width="80"
        height="80"
        rx="24"
        fill="#836EF9"
        stroke="#121212"
        strokeWidth="5"
      />

      {/* Geometric 'C' Monogram with Flat Terminals and Uniform Stroke */}
      <path
        d="M 68 38 L 52 38 A 14 14 0 1 0 52 62 L 68 62 A 28 28 0 1 1 68 38 Z"
        fill="#FFFFFF"
      />
    </svg>
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
