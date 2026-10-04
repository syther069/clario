"use client";

import {
  motion,
  type SpringOptions,
  useScroll,
  useSpring,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";

export type ScrollProgressProps = {
  className?: string;
  springOptions?: SpringOptions;
  containerRef?: RefObject<HTMLDivElement>;
};

const DEFAULT_SPRING_OPTIONS: SpringOptions = {
  stiffness: 280,
  damping: 36,
  restDelta: 0.001,
};

export function ScrollProgress({
  className,
  springOptions,
  containerRef,
}: ScrollProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll(
    containerRef ? { container: containerRef } : {},
  );

  const scaleX = useSpring(scrollYProgress, {
    ...DEFAULT_SPRING_OPTIONS,
    ...(springOptions ?? {}),
  });

  if (shouldReduceMotion) return null;

  return (
    <motion.div
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-1 origin-left bg-[#836EF9]",
        className,
      )}
      style={{
        scaleX,
      }}
    />
  );
}
