"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  TOAST_DEDUP_MS,
  TOAST_MAX_VISIBLE,
  resolveToastDuration,
  type ShowToastOptions,
  type ToastItem,
  type ToastTone,
} from "@/lib/toast";

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

/**
 * 提供全应用统一的短暂提示队列。Host 须挂在同一 Provider 内。
 * @param props React 子节点
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastShownRef = useRef<{ message: string; at: number } | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((options: ShowToastOptions) => {
    const message = options.message.trim();
    if (!message) return "";

    const now = Date.now();
    const last = lastShownRef.current;
    if (last && last.message === message && now - last.at < TOAST_DEDUP_MS) {
      return "";
    }
    lastShownRef.current = { message, at: now };

    const tone: ToastTone = options.tone ?? "info";
    const item: ToastItem = {
      id: `toast-${++toastSeq}-${now}`,
      message,
      tone,
      durationMs: resolveToastDuration(tone, options.durationMs),
    };

    setToasts((current) => [...current, item].slice(-TOAST_MAX_VISIBLE));
    return item.id;
  }, []);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * 取出统一 Toast 入口。
 * @throws 当组件不在 ToastProvider 内时抛出异常
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
