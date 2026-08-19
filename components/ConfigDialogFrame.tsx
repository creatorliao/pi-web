"use client";

import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * 配置弹层外壳：独立打开时是遮罩居中窗；嵌入设置页时铺满内容区，避免双层模态。
 */
export function ConfigDialogFrame({
  embedded = false,
  onClose,
  children,
}: {
  embedded?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (embedded) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: isMobile ? "calc(100vw - 16px)" : 860,
          maxWidth: "calc(100vw - 16px)",
          height: isMobile ? "calc(100dvh - 16px)" : "78vh",
          maxHeight: "calc(100dvh - 16px)",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
