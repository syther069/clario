"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { TextMorph } from "@/components/ui/motion/text-morph";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface WatermelonButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  morphText?: string;
  textMorph?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  iconRight?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#836EF9] hover:bg-[#7257f8] text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] active:shadow-[1px_1px_0_0_#121212] active:translate-x-[2px] active:translate-y-[2px]",
  secondary:
    "bg-white hover:bg-[#f3f4f6] text-[#121212] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] active:shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]",
  outline:
    "bg-transparent hover:bg-[#faf5ff] text-[#121212] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] active:shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]",
  ghost:
    "bg-transparent hover:bg-black/5 text-[#121212] border-2 border-transparent hover:border-[#121212]",
  danger:
    "bg-[#ef4444] hover:bg-[#dc2626] text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] active:shadow-[1px_1px_0_0_#121212] active:translate-x-[2px] active:translate-y-[2px]",
  success:
    "bg-[#22c55e] hover:bg-[#16a34a] text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] active:shadow-[1px_1px_0_0_#121212] active:translate-x-[2px] active:translate-y-[2px]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-xs font-mono font-black uppercase tracking-wider rounded-lg gap-2",
  lg: "px-5 py-3 text-sm font-mono font-black uppercase tracking-wider rounded-xl gap-2.5",
  icon: "h-9 w-9 p-0 flex items-center justify-center rounded-lg",
};

export function WatermelonButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText,
  morphText,
  textMorph = false,
  icon,
  leftIcon,
  iconRight,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}: WatermelonButtonProps) {
  const leadingIcon = leftIcon || icon;
  const trailingIcon = rightIcon || iconRight;
  const isTextOnly = typeof children === "string" || typeof morphText === "string";
  const displayMorphText = morphText || (typeof children === "string" ? children : undefined);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-mono font-black uppercase transition-all select-none cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          {loadingText ? (
            <TextMorph className="font-mono font-black uppercase tracking-wider">
              {loadingText}
            </TextMorph>
          ) : (
            <span>Loading...</span>
          )}
        </>
      ) : (
        <>
          {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
          {displayMorphText ? (
            <TextMorph className="font-mono font-black uppercase tracking-wider">
              {displayMorphText}
            </TextMorph>
          ) : (
            children
          )}
          {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
        </>
      )}
    </motion.button>
  );
}
