"use client";

import React, { type ReactNode } from "react";
import { motion, type Variants } from "motion/react";

export type PresetType =
  "fade" | "slide" | "scale" | "blur" | "blur-slide" | "zoom" | "bounce";

export type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  preset?: PresetType;
  as?: React.ElementType;
};

const defaultContainerVariants: Variants = {
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const presetVariants: Record<PresetType, Variants> = {
  fade: {},
  slide: {
    hidden: { y: 16, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 350, damping: 25 },
    },
  },
  scale: {
    hidden: { scale: 0.95, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 20 },
    },
  },
  blur: {
    hidden: { filter: "blur(6px)", opacity: 0 },
    visible: { filter: "blur(0px)", opacity: 1 },
  },
  "blur-slide": {
    hidden: { filter: "blur(4px)", y: 16, opacity: 0 },
    visible: { filter: "blur(0px)", y: 0, opacity: 1 },
  },
  zoom: {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 20 },
    },
  },
  bounce: {
    hidden: { y: -20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 400, damping: 12 },
    },
  },
};

const addDefaultVariants = (variants: Variants) => ({
  hidden: { ...defaultItemVariants.hidden, ...variants.hidden },
  visible: { ...defaultItemVariants.visible, ...variants.visible },
});

export function AnimatedGroup({
  children,
  className,
  variants,
  preset = "slide",
  as: Component = "div",
}: AnimatedGroupProps) {
  const selectedVariants = {
    item: addDefaultVariants(presetVariants[preset] || {}),
    container: addDefaultVariants(defaultContainerVariants),
  };
  const containerVariants = variants?.container || selectedVariants.container;
  const itemVariants = variants?.item || selectedVariants.item;

  const MotionComponent = motion.create(Component as any);

  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </MotionComponent>
  );
}
