"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { PathLabel } from "@/components/PathLabel";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { WorkspaceCard } from "@/lib/project-groups";
import { useI18n } from "@/hooks/useI18n";

export type WorkspacePickerHost = "welcome" | "modal";
export type ModelsReady = boolean | "unknown";

interface Props {
  host: WorkspacePickerHost;
  projects: WorkspaceCard[];
  loading: boolean;
  error: string | null;
  currentKey?: string | null;
  modelsReady: ModelsReady;
  onSelect: (project: WorkspaceCard) => void;
  onBrowse: () => void;
  onDefaultCwd: () => void;
  onRetry: () => void;
  onAddModels?: () => void;
  onClose?: () => void;
}

/**
 * 一套最近项目网格，欢迎页与切换模态共用。
 * host 只改标题/关闭；搜索仅在项目多于 8 个时出现。
 */
export function WorkspacePicker({
  host,
  projects,
  loading,
  error,
  currentKey = null,
  modelsReady,
  onSelect,
  onBrowse,
  onDefaultCwd,
  onRetry,
  onAddModels,
  onClose,
}: Props) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("");
  const showFilter = projects.length > 8;
  const query = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!query) return projects;
    return projects.filter((project) => (
      project.name.toLowerCase().includes(query)
      || project.shortPath.toLowerCase().includes(query)
      || project.root.toLowerCase().includes(query)
    ));
  }, [projects, query]);

  const title = host === "modal" ? t("workspace.switcherTitle") : t("workspace.pickerTitle");
  const showAddModel = modelsReady === false && Boolean(onAddModels);

  const handleCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>, project: WorkspaceCard) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelect(project);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 880,
        margin: "0 auto",
        padding: host === "welcome" ? "48px 24px 32px" : "28px 24px 20px",
        boxSizing: "border-box",
      }}
    >
      {host === "welcome" && (
        <div style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-dim)",
          letterSpacing: "0.02em",
          marginBottom: 20,
        }}
        >
          {t("workspace.productName")}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontSize: host === "welcome" ? 22 : 20,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
          >
            {title}
          </h1>
          {host === "welcome" && (
            <p style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--text-muted)",
            }}
            >
              {t("workspace.pickerSubtitle")}
            </p>
          )}
        </div>
        {host === "modal" && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("workspace.closeSwitcher")}
            title={t("workspace.closeSwitcher")}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--bg)",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {showFilter && !loading && !error && (
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("workspace.filter")}
          style={{
            width: "100%",
            marginTop: 16,
            height: 36,
            padding: "0 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            outline: "none",
            background: "var(--bg)",
            color: "var(--text)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      )}

      <div style={{ marginTop: 20, minHeight: 120 }}>
        {error ? (
          <div role="alert" style={{ color: "var(--text)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
            <div>{t("workspace.loadFailed")}</div>
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: 12,
                padding: 0,
                border: "none",
                background: "none",
                color: "var(--accent)",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
              }}
            >
              {t("workspace.retry")}
            </button>
          </div>
        ) : loading ? (
          <div
            role="status"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  height: 96,
                  borderRadius: 10,
                  background: "var(--bg-hover)",
                }}
              />
            ))}
          </div>
        ) : visible.length === 0 && query ? (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--text-muted)" }}>
            {t("workspace.noMatches")}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {visible.map((project) => {
              const isCurrent = host === "modal" && currentKey === project.key;
              const footer = project.sessionCount === 0
                ? t("workspace.noSessions")
                : t("workspace.sessionCount", { n: project.sessionCount });
              const relative = project.lastModified
                ? formatRelativeTime(project.lastModified, locale)
                : "";
              return (
                <button
                  key={project.key}
                  type="button"
                  onClick={() => onSelect(project)}
                  onKeyDown={(event) => handleCardKeyDown(event, project)}
                  title={project.root}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 6,
                    minHeight: 96,
                    padding: 14,
                    border: isCurrent ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg)",
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-ui)",
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                    >
                      {project.name}
                    </span>
                    {isCurrent && (
                      <span style={{
                        flexShrink: 0,
                        fontFamily: "var(--font-ui)",
                        fontSize: 11,
                        color: "var(--accent)",
                      }}
                      >
                        {t("workspace.current")}
                      </span>
                    )}
                  </div>
                  <PathLabel
                    text={project.shortPath}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  />
                  <div style={{
                    marginTop: "auto",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: "var(--text-dim)",
                  }}
                  >
                    {relative ? `${relative} · ${footer}` : footer}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        marginTop: 24,
      }}
      >
        <button
          type="button"
          onClick={onBrowse}
          style={secondaryButtonStyle}
        >
          {t("workspace.openFolder")}
        </button>
        <button
          type="button"
          onClick={onDefaultCwd}
          style={secondaryButtonStyle}
        >
          {t("workspace.useTodayDir")}
        </button>
      </div>

      {showAddModel && (
        <button
          type="button"
          onClick={onAddModels}
          style={{
            display: "block",
            marginTop: 20,
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
          }}
        >
          {t("workspace.addModel")}
        </button>
      )}
    </div>
  );
}

const secondaryButtonStyle = {
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
} as const;
