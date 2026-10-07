"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  type SpringOptions,
} from "motion/react";

const DEFAULT_SPRING: SpringOptions = {
  stiffness: 200,
  damping: 15,
};

export type MagneticProps = {
  children: React.ReactNode;
  intensity?: number;
  range?: number;
  maxTranslation?: number;
  actionArea?: "self" | "parent" | "global";
  springOptions?: SpringOptions;
  className?: string;
  disabled?: boolean;
};

export function Magnetic({
  children,
  intensity = 0.5,
  range = 80,
  maxTranslation = 8,
  actionArea = "self",
  springOptions = DEFAULT_SPRING,
  className,
  disabled = false,
}: MagneticProps) {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, springOptions);
  const springY = useSpring(y, springOptions);

  useEffect(() => {
    // Disable on touch / coarse pointer devices
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(pointer: fine)").matches ||
      disabled ||
      shouldReduceMotion
    ) {
      return;
    }

    const calculateDistance = (e: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        const absoluteDistance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        if (isHovered && absoluteDistance <= range) {
          const scale = 1 - absoluteDistance / range;
          const targetX = distanceX * intensity * scale;
          const targetY = distanceY * intensity * scale;
          x.set(Math.max(-maxTranslation, Math.min(maxTranslation, targetX)));
          y.set(Math.max(-maxTranslation, Math.min(maxTranslation, targetY)));
        } else {
          x.set(0);
          y.set(0);
        }
      }
    };

    document.addEventListener("mousemove", calculateDistance);

    return () => {
      document.removeEventListener("mousemove", calculateDistance);
    };
  }, [ref, isHovered, intensity, range, maxTranslation, x, y, disabled, shouldReduceMotion]);

  useEffect(() => {
    if (disabled || shouldReduceMotion) return;

    if (actionArea === "parent" && ref.current?.parentElement) {
      const parent = ref.current.parentElement;

      const handleParentEnter = () => setIsHovered(true);
      const handleParentLeave = () => {
        setIsHovered(false);
        x.set(0);
        y.set(0);
      };

      parent.addEventListener("mouseenter", handleParentEnter);
      parent.addEventListener("mouseleave", handleParentLeave);

      return () => {
        parent.removeEventListener("mouseenter", handleParentEnter);
        parent.removeEventListener("mouseleave", handleParentLeave);
      };
    } else if (actionArea === "global") {
      setIsHovered(true);
    }
  }, [actionArea, disabled, shouldReduceMotion, x, y]);

  if (shouldReduceMotion || disabled) {
    return <div className={className}>{children}</div>;
  }

  const handleMouseEnter = () => {
    if (actionArea === "self") {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (actionArea === "self") {
      setIsHovered(false);
      x.set(0);
      y.set(0);
    }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseEnter={actionArea === "self" ? handleMouseEnter : undefined}
      onMouseLeave={actionArea === "self" ? handleMouseLeave : undefined}
      style={{
        x: springX,
        y: springY,
      }}
    >
      {children}
    </motion.div>
  );
}

