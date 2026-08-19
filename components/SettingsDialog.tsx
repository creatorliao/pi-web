"use client";

import { useCallback, useEffect, useState } from "react";
import { ModelsConfig } from "./ModelsConfig";
import { SkillsConfig } from "./SkillsConfig";
import { PluginsConfig } from "./PluginsConfig";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useExplorerVisibility } from "@/hooks/useExplorerVisibility";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { WorkspaceLayoutMode } from "@/lib/layout-mode";

export type SettingsSection = "appearance" | "models" | "skills" | "plugins";

const SETTINGS_SECTION_KEY = "pi-settings-section";

/**
 * 读上次打开的设置分栏；非法值回落到外观。
 */
function readStoredSection(): SettingsSection {
  try {
    const value = sessionStorage.getItem(SETTINGS_SECTION_KEY);
    if (value === "appearance" || value === "models" || value === "skills" || value === "plugins") {
      return value;
    }
  } catch {
    // 隐私模式忽略
  }
  return "appearance";
}

function persistSection(section: SettingsSection): void {
  try {
    sessionStorage.setItem(SETTINGS_SECTION_KEY, section);
  } catch {
    // 隐私模式忽略
  }
}

/**
 * 统一设置页：外观 + 复用既有模型 / 技能 / 插件配置，只渲染当前分栏。
 */
export function SettingsDialog({
  cwd,
  sessionId,
  soundEnabled,
  onSoundToggle,
  onClose,
  onModelsClosed,
  onPluginsReloaded,
}: {
  cwd: string | null;
  sessionId: string | null;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
  onClose: () => void;
  onModelsClosed: () => void;
  onPluginsReloaded: () => void;
}) {
  const isMobile = useIsMobile();
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { preference, setThemePreference } = useTheme();
  const { layoutMode, setLayoutMode } = useLayoutMode();
  const { showHiddenFiles, setShowHiddenFiles } = useExplorerVisibility();
  const hasProject = Boolean(cwd);
  const [section, setSection] = useState<SettingsSection>(() => {
    const stored = readStoredSection();
    // 无项目时不能停在技能 / 插件，否则一打开就是空禁用页。
    if (!cwd && (stored === "skills" || stored === "plugins")) return "appearance";
    return stored;
  });

  const selectSection = useCallback((next: SettingsSection) => {
    if ((next === "skills" || next === "plugins") && !cwd) return;
    setSection(next);
    persistSection(next);
  }, [cwd]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (section === "models") onModelsClosed();
    onClose();
  }, [onClose, onModelsClosed, section]);

  const themeOptions: Array<{ id: ThemePreference; labelKey: string }> = [
    { id: "light", labelKey: "theme.lightName" },
    { id: "dark", labelKey: "theme.darkName" },
    { id: "auto", labelKey: "theme.autoName" },
  ];

  const navItems: Array<{ id: SettingsSection; label: string; disabled: boolean }> = [
    { id: "appearance", label: t("settings.appearance"), disabled: false },
    { id: "models", label: t("common.models"), disabled: false },
    { id: "skills", label: t("common.skills"), disabled: !hasProject },
    { id: "plugins", label: t("common.plugins"), disabled: !hasProject },
  ];

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
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        style={{
          width: isMobile ? "calc(100vw - 16px)" : 920,
          maxWidth: "calc(100vw - 16px)",
          height: isMobile ? "calc(100dvh - 16px)" : "80vh",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {t("settings.title")}
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t("i18n.close")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <nav
            aria-label={t("settings.title")}
            style={{
              width: isMobile ? "100%" : 168,
              flexShrink: 0,
              borderRight: isMobile ? "none" : "1px solid var(--border)",
              borderBottom: isMobile ? "1px solid var(--border)" : "none",
              background: "var(--bg-panel)",
              padding: 8,
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              gap: 4,
              overflowX: isMobile ? "auto" : "visible",
            }}
          >
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  title={item.disabled ? t("settings.needProject") : item.label}
                  onClick={() => selectSection(item.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 7,
                    background: active ? "var(--bg-selected)" : "none",
                    color: item.disabled ? "var(--text-dim)" : active ? "var(--text)" : "var(--text-muted)",
                    cursor: item.disabled ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    opacity: item.disabled ? 0.55 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {section === "appearance" && (
              <div style={{ padding: 24, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                  {t("settings.theme")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {themeOptions.map((option) => {
                    const selected = preference === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setThemePreference(option.id, {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                          });
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          background: selected ? "var(--bg-selected)" : "var(--bg-hover)",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: selected ? 600 : 500,
                        }}
                      >
                        {t(option.labelKey)}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                  {t("settings.layout")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, maxWidth: 480 }}>
                  {([
                    { id: "editor" as WorkspaceLayoutMode, label: t("settings.layoutEditor"), hint: t("settings.layoutEditorHint") },
                    { id: "assistant" as WorkspaceLayoutMode, label: t("settings.layoutAssistant"), hint: t("settings.layoutAssistantHint") },
                  ]).map((option) => {
                    const selected = layoutMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLayoutMode(option.id)}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          background: selected ? "var(--bg-selected)" : "var(--bg-hover)",
                          color: "var(--text)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: selected ? 600 : 500 }}>{option.label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{option.hint}</div>
                      </button>
                    );
                  })}
                </div>

                {onSoundToggle && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 28, cursor: "pointer", maxWidth: 480 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(soundEnabled)}
                      onChange={() => onSoundToggle()}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{t("settings.completionSound")}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{t("settings.completionSoundHint")}</span>
                    </span>
                  </label>
                )}

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 28, cursor: "pointer", maxWidth: 480 }}>
                  <input
                    type="checkbox"
                    checked={showHiddenFiles}
                    onChange={(event) => setShowHiddenFiles(event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{t("settings.showHiddenFiles")}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{t("settings.showHiddenFilesHint")}</span>
                  </span>
                </label>

                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                  {t("common.language")}
                </div>
                <div role="radiogroup" aria-label={t("common.language")} style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 320 }}>
                  {supportedLocales.map((plugin) => {
                    const selected = locale === plugin.id;
                    return (
                      <button
                        key={plugin.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          if (plugin.id === "en" || plugin.id === "zh-CN") setLocale(plugin.id);
                        }}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          border: "none",
                          borderRadius: 7,
                          background: selected ? "var(--bg-selected)" : "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        {plugin.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {section === "models" && (
              <ModelsConfig embedded onClose={handleClose} />
            )}

            {section === "skills" && cwd && (
              <SkillsConfig embedded cwd={cwd} onClose={handleClose} />
            )}

            {section === "plugins" && cwd && (
              <PluginsConfig
                embedded
                cwd={cwd}
                sessionId={sessionId}
                onClose={handleClose}
                onReloaded={onPluginsReloaded}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
