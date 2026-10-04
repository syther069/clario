"use client";

import React from "react";
import { X } from "lucide-react";
import { AuthCard } from "./auth-card";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function SignInModal({
  isOpen,
  onClose,
  title,
  description,
}: SignInModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#121212] bg-white text-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-slate-100 transition active:translate-x-[1px] active:translate-y-[1px]"
          aria-label="Close sign in modal"
        >
          <X className="h-4 w-4" />
        </button>

        <AuthCard
          onSuccess={onClose}
          title={title}
          description={description}
          className="border-2 border-[#121212] shadow-[6px_6px_0_0_#121212]"
        />
      </div>
    </div>
  );
}
