"use client";

import {
  type ReactNode,
  useRef,
  useState,
  type ElementType,
  useEffect,
} from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variant,
  type Transition,
  type UseInViewOptions,
} from "motion/react";

export type InViewProps = {
  children: ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: ElementType;
  once?: boolean;
  className?: string;
};

const defaultVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function InView({
  children,
  variants = defaultVariants,
  transition = { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  viewOptions = { margin: "-20px" },
  as = "div",
  once = true,
  className,
}: InViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);

  useEffect(() => {
    if (isInView && once) {
      setIsViewed(true);
    }
  }, [isInView, once]);

  if (shouldReduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionComponent = motion[as as keyof typeof motion] as typeof as;

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      animate={isInView || isViewed ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
      className={className}
    >
      {children}
    </MotionComponent>
  );
}
