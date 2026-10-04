"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, type Transition, motion } from "motion/react";
import React, {
  Children,
  cloneElement,
  type ReactElement,
  useEffect,
  useState,
  useId,
} from "react";

export type AnimatedBackgroundProps = {
  children:
    | ReactElement<{
        "data-id": string;
        className?: string;
        children?: React.ReactNode;
        onClick?: (e: React.MouseEvent) => void;
      }>[]
    | ReactElement<{
        "data-id": string;
        className?: string;
        children?: React.ReactNode;
        onClick?: (e: React.MouseEvent) => void;
      }>;
  defaultValue?: string;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition = {
    type: "spring",
    stiffness: 350,
    damping: 30,
  },
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);
  const uniqueId = useId();

  const handleSetActiveId = (id: string | null) => {
    setActiveId(id);
    if (onValueChange) {
      onValueChange(id);
    }
  };

  useEffect(() => {
    if (defaultValue !== undefined) {
      setActiveId(defaultValue);
    }
  }, [defaultValue]);

  return Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return null;

    const id = child.props["data-id"];

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : {
          onClick: (e: React.MouseEvent) => {
            (child.props as any).onClick?.(e);
            handleSetActiveId(id);
          },
        };

    const childClass = (child.props as any).className ?? "";
    const gapMatch = childClass.match(/\b(gap(?:-[xy])?-(?:\[[^\]]+\]|\S+))/);
    const gapClass = gapMatch ? gapMatch[1] : undefined;

    return cloneElement(
      child,
      {
        key: index,
        className: cn("relative inline-flex", child.props.className),
        "data-checked": activeId === id ? "true" : "false",
        ...interactionProps,
      } as any,
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={`background-${uniqueId}`}
              className={cn("absolute inset-0", className)}
              transition={transition}
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            />
          )}
        </AnimatePresence>
        <span
          className={cn(
            "relative z-10 w-full h-full inline-flex items-center justify-center",
            gapClass || "gap-2",
          )}
        >
          {child.props.children}
        </span>
      </>,
    );
  });
}
