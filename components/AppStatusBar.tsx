"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import type { ToolPreset } from "@/lib/tool-presets";

const TOOL_PRESETS = ["off", "read-only", "default", "full"] as const;
type ToolPresetLabel = typeof TOOL_PRESETS[number];
const TOOL_PRESET_MAP: Record<ToolPresetLabel, ToolPreset> = {
  off: "none",
  "read-only": "read-only",
  default: "default",
  full: "full",
};

/**
 * 窗口级地面右簇：压缩（当前会话动作）+ 工具预设 + 完成提示音。
 * 模型 / 思考仍不进本栏。
 */
export function AppStatusBar({
  soundEnabled,
  onSoundToggle,
  toolPreset,
  onToolPresetChange,
  toolPresetDisabled,
  onCompact,
  onAbortCompaction,
  isCompacting,
  compactDisabled,
}: {
  soundEnabled: boolean;
  onSoundToggle: () => void;
  toolPreset?: ToolPreset;
  onToolPresetChange?: (preset: ToolPreset) => void;
  toolPresetDisabled?: boolean;
  onCompact?: () => void;
  onAbortCompaction?: () => void;
  isCompacting?: boolean;
  compactDisabled?: boolean;
}) {
  const { t } = useI18n();
  const [toolOpen, setToolOpen] = useState(false);
  const toolRef = useRef<HTMLDivElement>(null);
  const toolPresetLabel = Object.entries(TOOL_PRESET_MAP).find(([, v]) => v === (toolPreset ?? "default"))?.[0] ?? "default";

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (toolRef.current && !toolRef.current.contains(event.target as Node)) {
        setToolOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <footer
      className="app-statusbar"
      role="contentinfo"
      aria-label={t("statusbar.label")}
    >
      <div className="app-statusbar-left" />
      <div className="app-statusbar-right">
        {onCompact && (
          <button
            type="button"
            className="app-statusbar-item"
            disabled={compactDisabled && !isCompacting}
            title={isCompacting ? t("chat.stopCompaction") : t("chat.compactContext")}
            aria-label={isCompacting ? t("chat.stopCompaction") : t("chat.compactContext")}
            onClick={() => {
              if (compactDisabled && !isCompacting) return;
              if (isCompacting) onAbortCompaction?.();
              else onCompact();
            }}
            style={isCompacting ? { color: "#ef4444" } : undefined}
          >
            {isCompacting ? (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" rx="2.5" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            )}
            <span>{isCompacting ? t("chat.compacting") : t("chat.compact")}</span>
          </button>
        )}
        {onToolPresetChange && (
          <div ref={toolRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="app-statusbar-item"
              disabled={toolPresetDisabled}
              title={`${t("chat.changeToolPreset")}: ${toolPresetLabel}`}
              aria-label={t("chat.changeToolPreset")}
              aria-expanded={toolOpen}
              onClick={() => {
                if (toolPresetDisabled) return;
                setToolOpen((open) => !open);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span>{toolPresetLabel}</span>
            </button>
            {toolOpen && !toolPresetDisabled && (
              <div className="app-statusbar-menu" role="menu">
                {TOOL_PRESETS.map((lvl) => {
                  const preset = TOOL_PRESET_MAP[lvl];
                  const isActive = (toolPreset ?? "default") === preset;
                  let desc: string;
                  if (lvl === "off") desc = t("chat.noTools");
                  else if (lvl === "read-only") desc = t("chat.readOnlyTools", { count: 4 });
                  else if (lvl === "default") desc = t("chat.builtInTools", { count: 4 });
                  else desc = t("chat.allBuiltInTools");
                  return (
                    <button
                      key={lvl}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setToolOpen(false);
                        if (!isActive) onToolPresetChange(preset);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "7px 12px",
                        background: isActive ? "var(--bg-selected)" : "none",
                        border: "none",
                        color: isActive ? "var(--text)" : "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 12,
                        textAlign: "left",
                        fontWeight: isActive ? 600 : 400,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isActive
                        ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="1.5 5 4 7.5 8.5 2.5" /></svg>
                        : <span style={{ width: 10, flexShrink: 0 }} />}
                      <span style={{ flex: 1 }}>{lvl}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{desc}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="app-statusbar-item"
          onClick={onSoundToggle}
          title={soundEnabled ? t("chat.disableSound") : t("chat.enableSound")}
          aria-label={soundEnabled ? t("chat.disableSound") : t("chat.enableSound")}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}
