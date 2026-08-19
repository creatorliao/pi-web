"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/useToast";
import type { ToastItem, ToastTone } from "@/lib/toast";

const TONE_ACCENT: Record<ToastTone, string> = {
  info: "var(--text-muted)",
  success: "var(--accent)",
  error: "#dc2626",
};

/**
 * 视口底部居中的 Toast 层。由 ToastProvider 挂载，业务组件不要再插一份。
 */
export function ToastHost() {
  const { toasts, dismissToast } = useToast();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-toast-host=""
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "max(20px, env(safe-area-inset-bottom))",
        zIndex: 1200,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        padding: "0 16px",
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      data-toast-tone={toast.tone}
      style={{
        pointerEvents: "auto",
        maxWidth: 420,
        width: "min(420px, 100%)",
        padding: "10px 14px",
        background: "var(--bg-panel)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${TONE_ACCENT[toast.tone]}`,
        boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {toast.message}
    </div>
  );
}
