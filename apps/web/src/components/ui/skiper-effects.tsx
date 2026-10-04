"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ==========================================
// 1. Skiper 64: Gooey Morphing AI Core
// ==========================================

const LOGO_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const INITIAL_STATE = {
  y: 0,
  width: 50,
  height: 50,
  borderRadius: 40,
};

const ANIMATED_STATE = {
  y: -50,
  width: 160,
  height: 80,
  borderRadius: 16,
  transition: {
    ...LOGO_SPRING,
    delay: 0.15,
    y: {
      ...LOGO_SPRING,
      delay: 0,
    },
  },
};

export const SkiperGooeyFilterProvider = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-0 left-0 h-0 w-0 pointer-events-none"
      version="1.1"
      aria-hidden="true"
    >
      <defs>
        <filter id="SkiperGooeyFilter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.4" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7"
            result="SkiperGooeyFilter"
          />
          <feBlend in="SourceGraphic" in2="SkiperGooeyFilter" />
        </filter>
      </defs>
    </svg>
  );
};

export interface Skiper64Props {
  className?: string;
  badgeText?: string;
  activeColor?: string;
}

export const Skiper64 = ({
  className = "",
  badgeText = "Drag nodes · Clario AI Core",
  activeColor = "bg-[#836EF9]",
}: Skiper64Props) => {
  return (
    <div
      className={cn(
        "relative flex h-48 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-[#121212] bg-[#fbf9fe] p-4 shadow-[4px_4px_0_0_#121212]",
        className,
      )}
    >
      <SkiperGooeyFilterProvider />

      <div className="absolute top-3 grid content-start justify-items-center gap-1 text-center pointer-events-none z-10">
        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded border border-[#121212] shadow-[1px_1px_0_0_#121212]">
          {badgeText}
        </span>
      </div>

      <ul
        className="relative flex flex-col items-center justify-end rounded-2xl mt-6"
        style={{
          filter: "url(#SkiperGooeyFilter)",
        }}
      >
        <motion.li
          drag
          dragConstraints={{ left: -100, right: 100, top: -80, bottom: 40 }}
          initial={INITIAL_STATE}
          animate={ANIMATED_STATE}
          className={cn(
            activeColor,
            "absolute cursor-grab active:cursor-grabbing border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] flex items-center justify-center text-white font-mono text-[10px] font-black uppercase tracking-wider",
          )}
        >
          <span>Copilot Core</span>
        </motion.li>
        <motion.li
          drag
          dragConstraints={{ left: -80, right: 80, top: -60, bottom: 30 }}
          className={cn(
            activeColor,
            "size-12 rounded-full cursor-grab active:cursor-grabbing border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]",
          )}
        />
      </ul>
    </div>
  );
};

// ==========================================
// 2. Skiper 99: Micro-interaction Icons
// ==========================================

export const ArrowIcon = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "group flex size-full cursor-pointer items-center justify-center",
        className,
      )}
    >
      <div className="relative grid cursor-pointer items-center justify-center">
        <ChevronRight className="transition-all duration-300 ease-out group-hover:translate-x-0.5 text-[#121212]" />
        <div className="absolute right-[9px] h-[2px] w-3 origin-right scale-x-0 rounded-[1px] bg-current transition-all duration-300 ease-out group-hover:right-[7px] group-hover:scale-x-100" />
      </div>
    </div>
  );
};

export const MenuIcon = ({ className }: { className?: string }) => {
  const [toggle, setToggle] = useState(false);

  return (
    <div
      onClick={() => setToggle((x) => !x)}
      className={cn(
        "group flex size-full cursor-pointer items-center justify-center",
        className,
      )}
    >
      <div className="relative grid size-4 cursor-pointer items-center justify-center">
        <motion.div
          animate={{ y: toggle ? 0 : "-5px", rotate: toggle ? 45 : 0 }}
          className="absolute h-0.5 w-full rounded-full bg-current"
        />
        <motion.div
          animate={{ opacity: toggle ? 0 : 1 }}
          transition={{ duration: 0.1 }}
          className="absolute h-0.5 w-full rounded-full bg-current"
        />
        <motion.div
          animate={{ y: toggle ? 0 : "5px", rotate: toggle ? -45 : 0 }}
          className="absolute h-0.5 w-full rounded-full bg-current"
        />
      </div>
    </div>
  );
};

export const VolumeIcon = ({ className }: { className?: string }) => {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div
      onClick={() => setIsMuted((x) => !x)}
      className={cn(
        "group flex size-full cursor-pointer items-center justify-center",
        className,
      )}
    >
      <motion.div
        initial={false}
        className="relative flex size-5 items-center justify-center"
        animate={{
          rotate: isMuted ? [0, -15, 5, -2, 0] : "none",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={cn("", className)}
        >
          <path
            fill="currentColor"
            stroke="none"
            d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
          />

          <motion.g>
            <path
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              d="M16 9a5 5 0 0 1 0 6"
            />
            <path
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              d="M19.364 18.364a9 9 0 0 0 0-12.728"
            />
          </motion.g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rotate-[-40deg] overflow-hidden">
            <motion.div
              animate={{ scaleY: isMuted ? 1 : 0 }}
              transition={{
                ease: "easeInOut",
                duration: isMuted ? 0.125 : 0.05,
                delay: isMuted ? 0.15 : 0,
              }}
              style={{
                transformOrigin: "top",
              }}
              className="h-[18px] w-fit rounded-full"
            >
              <div className="bg-white flex h-full w-[3.5px] items-center justify-center rounded-full">
                <div className="bg-[#121212] h-full w-[1.5px] rounded-full" />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const Skiper99 = () => {
  return (
    <div className="flex w-full items-center justify-center gap-3 p-2">
      <div className="size-10 bg-white rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] flex items-center justify-center">
        <ArrowIcon />
      </div>
      <div className="size-10 bg-white rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] flex items-center justify-center">
        <MenuIcon />
      </div>
      <div className="size-10 bg-white rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] flex items-center justify-center">
        <VolumeIcon />
      </div>
    </div>
  );
};

// ==========================================
// 3. Skiper 58: TextRoll
// ==========================================

const STAGGER = 0.035;

export const TextRoll: React.FC<{
  children: string;
  className?: string;
  center?: boolean;
}> = ({ children, className, center = false }) => {
  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn("relative block overflow-hidden cursor-pointer", className)}
      style={{
        lineHeight: 0.8,
      }}
    >
      <div>
        {children.split("").map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (children.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              variants={{
                initial: {
                  y: 0,
                },
                hovered: {
                  y: "-100%",
                },
              }}
              transition={{
                ease: "easeInOut",
                delay,
              }}
              className="inline-block"
              key={i}
            >
              {l === " " ? "\u00A0" : l}
            </motion.span>
          );
        })}
      </div>
      <div className="absolute inset-0">
        {children.split("").map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (children.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              variants={{
                initial: {
                  y: "100%",
                },
                hovered: {
                  y: 0,
                },
              }}
              transition={{
                ease: "easeInOut",
                delay,
              }}
              className="inline-block"
              key={i}
            >
              {l === " " ? "\u00A0" : l}
            </motion.span>
          );
        })}
      </div>
    </motion.span>
  );
};

// ==========================================
// 4. Skiper 40: Animated Cursor Links
// ==========================================

export const Link000 = ({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) => {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center font-bold text-xs",
        className,
        "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:before:origin-left hover:before:scale-x-100",
      )}
    >
      {children}
    </Link>
  );
};

export const Link001 = ({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group relative flex items-center font-bold text-xs",
        "before:pointer-events-none before:absolute before:left-0 before:top-[1.4em] before:h-[2px] before:w-full before:bg-current before:content-['']",
        "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:before:origin-left hover:before:scale-x-100",
        className,
      )}
    >
      {children}
      <svg
        className="ml-[0.3em] mt-[0em] size-[0.6em] translate-y-0.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
};
