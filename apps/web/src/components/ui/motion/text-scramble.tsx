"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, type MotionProps } from "motion/react";

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
  scrambleOnHover?: boolean;
} & MotionProps;

const DEFAULT_CHARS = "0123456789ABCDEFabcdef!@#$%^&*()_+<>{}[]";

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = DEFAULT_CHARS,
  className,
  as: Component = "span",
  trigger = true,
  scrambleOnHover = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const MotionComponent = motion.create(Component as any);
  const [displayText, setDisplayText] = useState(children);
  const [isAnimating, setIsAnimating] = useState(false);
  const text = children;

  const scramble = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    const steps = Math.max(Math.floor(duration / speed), 1);
    let step = 0;

    const interval = setInterval(() => {
      let scrambled = "";
      const progress = step / steps;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          scrambled += " ";
          continue;
        }

        if (progress * text.length > i) {
          scrambled += text[i];
        } else {
          scrambled +=
            characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setDisplayText(scrambled);
      step++;

      if (step > steps) {
        clearInterval(interval);
        setDisplayText(text);
        setIsAnimating(false);
        onScrambleComplete?.();
      }
    }, speed * 1000);
  }, [characterSet, duration, isAnimating, onScrambleComplete, speed, text]);

  useEffect(() => {
    if (trigger) {
      scramble();
    }
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MotionComponent
      className={className}
      onMouseEnter={scrambleOnHover ? scramble : undefined}
      {...props}
    >
      {displayText}
    </MotionComponent>
  );
}
