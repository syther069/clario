"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, type Transition } from "motion/react";

export type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const defaultTransition: Transition = {
    repeat: Infinity,
    duration: 4,
    ease: "linear",
  };

  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] overflow-hidden">
      <motion.div
        className={cn("absolute aspect-square bg-[#836EF9]", className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            ...style,
          } as any
        }
        animate={{
          offsetDistance: ["0%", "100%"],
        }}
        transition={transition || defaultTransition}
        {...(onAnimationComplete ? { onAnimationComplete } : {})}
      />
    </div>
  );
}
