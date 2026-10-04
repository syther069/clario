"use client";

import React from "react";
import {
  AnimatePresence,
  type Transition,
  type Variant,
  motion,
  type MotionProps,
} from "motion/react";
import { cn } from "@/lib/utils";

export type TransitionPanelProps = {
  children: React.ReactNode[];
  className?: string;
  transition?: Transition;
  activeIndex: number;
  variants?: { enter: Variant; center: Variant; exit: Variant };
} & MotionProps;

export function TransitionPanel({
  children,
  className,
  transition = {
    type: "spring",
    stiffness: 300,
    damping: 28,
  },
  variants = {
    enter: { opacity: 0, y: 12 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  },
  activeIndex,
  ...motionProps
}: TransitionPanelProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <AnimatePresence
        initial={false}
        mode="popLayout"
        custom={motionProps.custom}
      >
        <motion.div
          key={activeIndex}
          variants={variants}
          transition={transition}
          initial="enter"
          animate="center"
          exit="exit"
          {...motionProps}
        >
          {children[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
