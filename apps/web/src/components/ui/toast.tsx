"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string | undefined;
  duration?: number | undefined;
}

interface ToastContextValue {
  toast: {
    success: (title: string, message?: string, duration?: number) => void;
    error: (title: string, message?: string, duration?: number) => void;
    warning: (title: string, message?: string, duration?: number) => void;
    info: (title: string, message?: string, duration?: number) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    [],
  );

  const toastMethods = {
    success: (title: string, message?: string, duration?: number) =>
      addToast("success", title, message, duration),
    error: (title: string, message?: string, duration?: number) =>
      addToast("error", title, message, duration),
    warning: (title: string, message?: string, duration?: number) =>
      addToast("warning", title, message, duration),
    info: (title: string, message?: string, duration?: number) =>
      addToast("info", title, message, duration),
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods, dismiss }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.duration || 4000);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  const config = {
    success: {
      bg: "bg-[#f0fdf4]",
      border: "border-[#121212]",
      text: "text-[#166534]",
      icon: <CheckCircle2 className="h-4 w-4 text-[#166534] shrink-0" />,
      accent: "bg-[#22c55e]",
    },
    error: {
      bg: "bg-[#fef2f2]",
      border: "border-[#121212]",
      text: "text-[#991b1b]",
      icon: <AlertCircle className="h-4 w-4 text-[#991b1b] shrink-0" />,
      accent: "bg-[#ef4444]",
    },
    warning: {
      bg: "bg-[#fffbeb]",
      border: "border-[#121212]",
      text: "text-[#92400e]",
      icon: <AlertTriangle className="h-4 w-4 text-[#92400e] shrink-0" />,
      accent: "bg-[#f59e0b]",
    },
    info: {
      bg: "bg-[#f3f0ff]",
      border: "border-[#121212]",
      text: "text-[#581c87]",
      icon: <Info className="h-4 w-4 text-[#836EF9] shrink-0" />,
      accent: "bg-[#836EF9]",
    },
  }[item.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border-2 ${config.border} ${config.bg} shadow-[4px_4px_0_0_#121212] animate-in slide-in-from-bottom-2 fade-in duration-150`}
    >
      <div className="mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <h4
          className={`text-xs font-black uppercase tracking-wider ${config.text}`}
        >
          {item.title}
        </h4>
        {item.message && (
          <p className="text-[11px] text-slate-600 mt-0.5 font-medium leading-tight">
            {item.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-[#121212] rounded transition"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      toast: {
        success: (title: string, message?: string) =>
          console.log("[Toast Success]", title, message),
        error: (title: string, message?: string) =>
          console.error("[Toast Error]", title, message),
        warning: (title: string, message?: string) =>
          console.warn("[Toast Warning]", title, message),
        info: (title: string, message?: string) =>
          console.info("[Toast Info]", title, message),
      },
      dismiss: () => {},
    };
  }
  return context;
}
