"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import React, { createContext, useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DialogContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  variants: Variants;
  transition: Transition;
  ids: {
    dialog: string;
    title: string;
    description: string;
  };
  onAnimationComplete: (definition: string) => void;
  handleTrigger: () => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

const defaultVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
};

const defaultTransition: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 25,
};

export type DialogProps = {
  children: React.ReactNode;
  variants?: Variants;
  transition?: Transition;
  className?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

export function Dialog({
  children,
  variants = defaultVariants,
  transition = defaultTransition,
  defaultOpen,
  onOpenChange,
  open,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen || false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = open !== undefined ? open : uncontrolledOpen;

  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (isOpen) {
        setIsOpen(false);
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      document.body.style.overflow = "";
    };
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      if (!dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    }
  }, [isOpen]);

  const handleTrigger = () => {
    setIsOpen(true);
  };

  const onAnimationComplete = (definition: string) => {
    if (definition === "exit" && !isOpen) {
      dialogRef.current?.close();
    }
  };

  const baseId = useId();
  const ids = {
    dialog: `motion-ui-dialog-${baseId}`,
    title: `motion-ui-dialog-title-${baseId}`,
    description: `motion-ui-dialog-description-${baseId}`,
  };

  return (
    <DialogContext.Provider
      value={{
        isOpen,
        setIsOpen,
        dialogRef,
        variants,
        transition,
        ids,
        onAnimationComplete,
        handleTrigger,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export type DialogTriggerProps = {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
};

export function DialogTrigger({ children, className }: DialogTriggerProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within Dialog");

  return (
    <button
      onClick={context.handleTrigger}
      type="button"
      className={cn(
        "inline-flex items-center justify-center cursor-pointer",
        className
      )}
    >
      {children}
    </button>
  );
}

export type DialogPortalProps = {
  children: React.ReactNode;
  container?: HTMLElement | null;
};

export function DialogPortal({
  children,
  container = typeof window !== "undefined" ? document.body : null,
}: DialogPortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalContainer(container || document.body);
    return () => setMounted(false);
  }, [container]);

  if (!mounted || !portalContainer) {
    return null;
  }

  return createPortal(children, portalContainer);
}

export type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
  container?: HTMLElement | null;
};

export function DialogContent({ children, className, container }: DialogContentProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogContent must be used within Dialog");
  const {
    isOpen,
    setIsOpen,
    dialogRef,
    variants,
    transition,
    ids,
    onAnimationComplete,
  } = context;

  const content = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.dialog
          key={ids.dialog}
          ref={dialogRef as React.RefObject<HTMLDialogElement>}
          id={ids.dialog}
          aria-labelledby={ids.title}
          aria-describedby={ids.description}
          aria-modal="true"
          role="dialog"
          onClick={(e) => {
            if (e.target === dialogRef.current) {
              setIsOpen(false);
            }
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          transition={transition}
          onAnimationComplete={onAnimationComplete}
          className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform p-0 shadow-[6px_6px_0_0_#121212] border-2 border-[#121212] bg-white rounded-2xl z-50",
            "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
            "open:flex open:flex-col",
            className
          )}
        >
          <div className="w-full relative">{children}</div>
        </motion.dialog>
      )}
    </AnimatePresence>
  );

  return <DialogPortal container={container ?? null}>{content}</DialogPortal>;
}

export type DialogHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6 border-b-2 border-[#121212]", className)}>
      {children}
    </div>
  );
}

export type DialogTitleProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogTitle({ children, className }: DialogTitleProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogTitle must be used within Dialog");

  return (
    <h2
      id={context.ids.title}
      className={cn("text-lg font-black uppercase tracking-tight text-[#121212]", className)}
    >
      {children}
    </h2>
  );
}

export type DialogDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogDescription must be used within Dialog");

  return (
    <p
      id={context.ids.description}
      className={cn("text-xs text-slate-600 font-medium", className)}
    >
      {children}
    </p>
  );
}

export type DialogCloseProps = {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
};

export function DialogClose({ className, children, disabled }: DialogCloseProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogClose must be used within Dialog");

  return (
    <button
      onClick={() => context.setIsOpen(false)}
      type="button"
      aria-label="Close dialog"
      className={cn(
        "absolute top-4 right-4 p-1 rounded-lg border-2 border-transparent hover:border-[#121212] hover:bg-[#f3f4f6] text-[#121212] transition-colors cursor-pointer",
        className
      )}
      disabled={disabled}
    >
      {children || <X className="h-4 w-4" />}
      <span className="sr-only">Close</span>
    </button>
  );
}
