"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Magnetic } from "./magnetic";

export interface AnimatedButtonProps {
  children?: React.ReactNode;
  className?: string | undefined;
  variant?:
    | "primary"
    | "black"
    | "secondary"
    | "outline"
    | "danger"
    | "success"
    | "ghost"
    | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  isLoading?: boolean | undefined;
  isSuccess?: boolean | undefined;
  loadingText?: string | undefined;
  magnetic?: boolean | undefined;
  magneticIntensity?: number | undefined;
  icon?: React.ReactNode | undefined;
  rightIcon?: React.ReactNode | undefined;
  disabled?: boolean | undefined;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  type?: "button" | "submit" | "reset" | undefined;
  style?: React.CSSProperties | undefined;
  id?: string | undefined;
  title?: string | undefined;
}

export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      isSuccess = false,
      loadingText,
      magnetic = false,
      magneticIntensity = 0.2,
      disabled = false,
      icon,
      rightIcon,
      onClick,
      type = "button",
      style,
      id,
      title,
    },
    ref,
  ) => {
    const shouldReduceMotion = useReducedMotion();

    const baseStyles =
      "inline-flex items-center justify-center font-mono font-black uppercase tracking-wider rounded-xl transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9] disabled:opacity-50 disabled:cursor-not-allowed";

    const variantStyles: Record<string, string> = {
      primary:
        "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#7257f8]",
      black:
        "bg-[#121212] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#222222]",
      secondary:
        "bg-white text-[#121212] border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#f8f9fa]",
      outline:
        "bg-transparent text-[#121212] border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] hover:bg-black/5",
      danger:
        "bg-[#fee2e2] text-[#b91c1c] border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#fecaca]",
      success:
        "bg-[#dcfce7] text-[#15803d] border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#bbf7d0]",
      ghost:
        "bg-transparent text-slate-700 hover:text-black hover:bg-black/5 rounded-lg border border-transparent hover:border-[#121212]",
    };

    const sizeStyles = {
      sm: "text-[11px] px-3 py-1.5 gap-1.5",
      md: "text-xs px-4 py-2.5 gap-2",
      lg: "text-sm px-6 py-3.5 gap-2.5",
    };

    const motionProps: Record<string, unknown> = {
      ref,
      type,
      disabled: disabled || isLoading,
      className: cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className,
      ),
    };

    if (id) motionProps.id = id;
    if (title) motionProps.title = title;
    if (style) motionProps.style = style;
    if (onClick) motionProps.onClick = onClick;

    if (!shouldReduceMotion && !disabled && !isLoading) {
      motionProps.whileHover = {
        y: -1.5,
        transition: { type: "spring", stiffness: 400, damping: 20 },
      };
      motionProps.whileTap = {
        x: 2,
        y: 2,
        boxShadow: "1px 1px 0px 0px #121212",
        transition: { type: "spring", stiffness: 500, damping: 15 },
      };
    }

    const buttonContent = (
      <motion.button {...motionProps}>
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{loadingText || children}</span>
          </>
        ) : isSuccess ? (
          <>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
            <span>{children}</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );

    if (magnetic && !disabled && !shouldReduceMotion) {
      return (
        <Magnetic intensity={magneticIntensity} springOptions={{ bounce: 0.1 }}>
          {buttonContent}
        </Magnetic>
      );
    }

    return buttonContent;
  },
);

AnimatedButton.displayName = "AnimatedButton";
