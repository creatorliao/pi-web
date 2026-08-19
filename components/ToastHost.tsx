"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/useToast";
import type { ToastItem, ToastTone } from "@/lib/toast";

const TONE_DOT: Record<ToastTone, string> = {
  info: "var(--text-muted)",
  success: "var(--accent)",
  error: "#dc2626",
};

/**
 * 文档区顶部居中的胶囊 Toast。挂载后再 portal，避免 hydration 对不上。
 */
export function ToastHost() {
  const { toasts, dismissToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const pick = () => {
      const anchor = document.querySelector("[data-toast-anchor]") as HTMLElement | null;
      const wideEnough = Boolean(anchor && anchor.getBoundingClientRect().width >= 80);
      setTarget(wideEnough && anchor ? anchor : document.body);
    };

    pick();
    window.addEventListener("resize", pick);
    const observer = new ResizeObserver(pick);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("resize", pick);
      observer.disconnect();
    };
  }, [mounted]);

  if (!mounted || !target) return null;

  const pinnedToBody = target === document.body;

  return createPortal(
    <div
      data-toast-host=""
      style={{
        position: pinnedToBody ? "fixed" : "absolute",
        left: 0,
        right: 0,
        // 文档列细栏约 24px；贴在正文顶、水平居中。无锚点时退回视口顶。
        top: pinnedToBody ? "max(12px, env(safe-area-inset-top))" : 32,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
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
    target,
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
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "min(420px, 100%)",
        padding: "6px 14px 6px 12px",
        background: "var(--bg-panel)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: TONE_DOT[toast.tone],
        }}
      />
      {toast.message}
    </div>
  );
}
