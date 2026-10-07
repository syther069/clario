"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Tilt } from "./tilt";
import { Spotlight } from "./spotlight";

export interface InteractiveCardProps {
  children: React.ReactNode;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  id?: string | undefined;
  onClick?: (() => void) | undefined;
  enableTilt?: boolean | undefined;
  enableSpotlight?: boolean | undefined;
  rotationFactor?: number | undefined;
  spotlightSize?: number | undefined;
}

export function InteractiveCard({
  children,
  className,
  style,
  id,
  onClick,
  enableTilt = true,
  enableSpotlight = false,
  rotationFactor = 3,
  spotlightSize = 240,
}: InteractiveCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const motionProps: Record<string, unknown> = {
    className: cn(
      "relative rounded-xl border-2 border-[#121212] bg-white p-5 shadow-[4px_4px_0_0_#121212] transition-all hover:shadow-[6px_6px_0_0_#121212]",
      className,
    ),
  };

  if (id) motionProps.id = id;
  if (style) motionProps.style = style;
  if (onClick) motionProps.onClick = onClick;

  if (!shouldReduceMotion) {
    motionProps.whileHover = {
      y: -4,
      transition: { type: "spring", stiffness: 200, damping: 15 },
    };
  }

  const baseCard = (
    <motion.div {...motionProps}>
      {enableSpotlight && !shouldReduceMotion && (
        <Spotlight size={spotlightSize} />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );

  if (enableTilt && !shouldReduceMotion) {
    return <Tilt rotationFactor={rotationFactor}>{baseCard}</Tilt>;
  }

  return baseCard;
}

