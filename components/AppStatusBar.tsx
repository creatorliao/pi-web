"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
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

/** 底栏可切换的 worktree，字段与 /api/worktrees 一致。 */
export type StatusWorktree = {
  path: string;
  branch: string | null;
  isMain: boolean;
};

export type AppStatusBarProps = {
  soundEnabled: boolean;
  onSoundToggle: () => void;
  toolPreset?: ToolPreset;
  onToolPresetChange?: (preset: ToolPreset) => void;
  toolPresetDisabled?: boolean;
  onCompact?: () => void;
  onAbortCompaction?: () => void;
  isCompacting?: boolean;
  compactDisabled?: boolean;
  /** 当前 Git 分支名；非仓库为 null，整项隐藏。 */
  gitBranch?: string | null;
  gitDirty?: boolean;
  worktrees?: StatusWorktree[];
  currentWorktreePath?: string | null;
  onSelectWorktree?: (path: string) => void;
  projectName?: string | null;
  /** 对话树短标签，如 2/4；无会话则不传。 */
  conversationBranchLabel?: string | null;
  conversationBranchesOpen?: boolean;
  onConversationBranchesClick?: () => void;
  tokenLabel?: string | null;
  tokenTitle?: string;
  tokenOpen?: boolean;
  onTokenClick?: () => void;
};

/**
 * 窗口级地面。左簇：Git / 项目 / 对话分支。右簇：用量、压缩、工具、喇叭。
 * 不画模型与思考（Composer 冻结）。
 */
export const AppStatusBar = forwardRef<HTMLElement, AppStatusBarProps>(function AppStatusBar({
  soundEnabled,
  onSoundToggle,
  toolPreset,
  onToolPresetChange,
  toolPresetDisabled,
  onCompact,
  onAbortCompaction,
  isCompacting,
  compactDisabled,
  gitBranch,
  gitDirty,
  worktrees,
  currentWorktreePath,
  onSelectWorktree,
  projectName,
  conversationBranchLabel,
  conversationBranchesOpen,
  onConversationBranchesClick,
  tokenLabel,
  tokenTitle,
  tokenOpen,
  onTokenClick,
}, ref) {
  const { t } = useI18n();
  const [toolOpen, setToolOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const toolRef = useRef<HTMLDivElement>(null);
  const gitRef = useRef<HTMLDivElement>(null);
  const toolPresetLabel = Object.entries(TOOL_PRESET_MAP).find(([, v]) => v === (toolPreset ?? "default"))?.[0] ?? "default";
  const switchableWorktrees = (worktrees ?? []).filter((item) => item.branch || item.isMain);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (toolRef.current && !toolRef.current.contains(event.target as Node)) setToolOpen(false);
      if (gitRef.current && !gitRef.current.contains(event.target as Node)) setGitOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <footer
      ref={ref}
      className="app-statusbar"
      role="contentinfo"
      aria-label={t("statusbar.label")}
    >
      <div className="app-statusbar-left">
        {gitBranch && (
          <div ref={gitRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="app-statusbar-item"
              title={t("statusbar.gitBranch", { branch: gitDirty ? `${gitBranch}*` : gitBranch })}
              aria-label={t("statusbar.gitBranch", { branch: gitDirty ? `${gitBranch}*` : gitBranch })}
              aria-expanded={gitOpen}
              onClick={() => {
                if (!onSelectWorktree || switchableWorktrees.length === 0) return;
                setGitOpen((open) => !open);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span className="app-statusbar-item-text">{gitBranch}{gitDirty ? "*" : ""}</span>
            </button>
            {gitOpen && onSelectWorktree && switchableWorktrees.length > 0 && (
              <div className="app-statusbar-menu app-statusbar-menu-left" role="menu">
                {switchableWorktrees.map((item) => {
                  const active = item.path === currentWorktreePath;
                  const name = item.branch ?? (item.isMain ? t("sidebar.main") : item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      role="menuitem"
                      title={item.path}
                      onClick={() => {
                        setGitOpen(false);
                        if (!active) onSelectWorktree(item.path);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "7px 12px",
                        background: active ? "var(--bg-selected)" : "none",
                        border: "none",
                        color: active ? "var(--text)" : "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 12,
                        textAlign: "left",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      {item.isMain && <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{t("sidebar.main")}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {projectName && (
          <span className="app-statusbar-item app-statusbar-item-static" title={projectName}>
            <span className="app-statusbar-item-text">{projectName}</span>
          </span>
        )}
        {conversationBranchLabel && onConversationBranchesClick && (
          <button
            type="button"
            className="app-statusbar-item"
            title={t("statusbar.conversationBranches")}
            aria-label={t("statusbar.conversationBranches")}
            aria-pressed={conversationBranchesOpen}
            onClick={onConversationBranchesClick}
          >
            {/* 与 Git 分叉图标区分：对话树用分叉点阵 */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="6" cy="19" r="2.2" />
              <circle cx="18" cy="19" r="2.2" />
              <path d="M12 7.2v4.2L7.4 16.6" />
              <path d="M12 11.4l4.6 5.2" />
            </svg>
            <span className="app-statusbar-item-text">{conversationBranchLabel}</span>
          </button>
        )}
      </div>
      <div className="app-statusbar-right">
        {tokenLabel && onTokenClick && (
          <button
            type="button"
            className="app-statusbar-item"
            title={tokenTitle || t("session.title")}
            aria-label={t("session.title")}
            aria-pressed={tokenOpen}
            onClick={onTokenClick}
          >
            <span className="app-statusbar-item-text">{tokenLabel}</span>
          </button>
        )}
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
            <span className="app-statusbar-item-text">{isCompacting ? t("chat.compacting") : t("chat.compact")}</span>
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
              <span className="app-statusbar-item-text">{toolPresetLabel}</span>
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
});
