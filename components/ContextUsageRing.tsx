"use client";

import { useState } from "react";

/**
 * 上下文占用环：悬停出自绘卡片（不用原生 title，避免慢、丑、不能排版）。
 */
export function ContextUsageRing({
  percent,
  heading,
  unknownLabel,
  usedLabel,
}: {
  percent: number | null;
  tokens?: number | null;
  contextWindow?: number;
  heading: string;
  unknownLabel: string;
  usedLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const radius = 7;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (shown / 100);
  const percentText = percent === null ? unknownLabel : `${percent.toFixed(0)}%`;
  const aria = `${heading} ${percentText}. ${usedLabel}`;

  return (
    <span
      aria-label={aria}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      style={{
        width: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r={radius} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform="rotate(-90 9 9)"
        />
      </svg>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 8px)",
            minWidth: 168,
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            color: "var(--text)",
            zIndex: 80,
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
            {heading}
          </span>
          <span style={{ display: "block", fontSize: 18, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            {percentText}
          </span>
          <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {usedLabel}
          </span>
        </span>
      )}
    </span>
  );
}
