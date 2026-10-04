"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import {
  type MotionValue,
  motion,
  useSpring,
  useTransform,
  motionValue,
} from "motion/react";

const TRANSITION = {
  type: "spring" as const,
  stiffness: 280,
  damping: 20,
  mass: 0.3,
};

function Digit({ value, place }: { value: number; place: number }) {
  const valueRoundedToPlace = Math.floor(value / place) % 10;
  const initial = motionValue(valueRoundedToPlace);
  const animatedValue = useSpring(initial, TRANSITION);

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <div className="relative inline-block w-[1ch] overflow-x-visible overflow-y-clip leading-none tabular-nums select-none">
      <div className="invisible">0</div>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} />
      ))}
    </div>
  );
}

function Number({ mv, number }: { mv: MotionValue<number>; number: number }) {
  const uniqueId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (ref.current) {
      const updateHeight = () => {
        if (ref.current) {
          const h = ref.current.getBoundingClientRect().height;
          if (h > 0) setHeight(h);
        }
      };
      updateHeight();
      const ro = new ResizeObserver(updateHeight);
      ro.observe(ref.current);
      return () => ro.disconnect();
    }
  }, []);

  const y = useTransform(mv, (latest) => {
    if (!height) return 0;
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;

    if (offset > 5) {
      memo -= 10 * height;
    }

    return memo;
  });

  return (
    <motion.span
      ref={ref}
      style={{ y: height ? y : 0 }}
      layoutId={`${uniqueId}-${number}`}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      transition={TRANSITION}
    >
      {number}
    </motion.span>
  );
}

export type SlidingNumberProps = {
  value: number;
  padStart?: boolean;
  decimalSeparator?: string;
  className?: string;
};

export function SlidingNumber({
  value,
  padStart = false,
  decimalSeparator = ".",
  className,
}: SlidingNumberProps) {
  const absValue = Math.abs(value);
  const parts = absValue.toString().split(".");
  const integerPart = parts[0] ?? "0";
  const decimalPart = parts[1];
  const integerValue = parseInt(integerPart, 10) || 0;
  const paddedInteger =
    padStart && integerValue < 10 ? `0${integerPart}` : integerPart;
  const integerDigits = paddedInteger.split("");
  const integerPlaces = integerDigits.map((_, i) =>
    Math.pow(10, integerDigits.length - i - 1),
  );

  return (
    <span className={`inline-flex items-center font-mono ${className || ""}`}>
      {value < 0 && "-"}
      {integerDigits.map((_, index) => (
        <Digit
          key={`pos-${integerPlaces[index] ?? index}`}
          value={integerValue}
          place={integerPlaces[index] ?? 1}
        />
      ))}
      {decimalPart && (
        <>
          <span>{decimalSeparator}</span>
          {decimalPart.split("").map((_, index) => (
            <Digit
              key={`decimal-${index}`}
              value={parseInt(decimalPart, 10) || 0}
              place={Math.pow(10, decimalPart.length - index - 1) || 1}
            />
          ))}
        </>
      )}
    </span>
  );
}
