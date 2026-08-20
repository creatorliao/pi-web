"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { PathLabel } from "@/components/PathLabel";
import { formatRelativeTime } from "@/lib/i18n/format";
import type { WorkspaceCard } from "@/lib/project-groups";
import { useI18n } from "@/hooks/useI18n";

export type WorkspacePickerHost = "welcome" | "modal";
export type ModelsReady = boolean | "unknown";

interface Props {
  host: WorkspacePickerHost;
  projects: WorkspaceCard[];
  starredKeys: readonly string[];
  hiddenCount: number;
  loading: boolean;
  error: string | null;
  currentKey?: string | null;
  modelsReady: ModelsReady;
  onSelect: (project: WorkspaceCard) => void;
  onStar: (project: WorkspaceCard) => void;
  onHide: (project: WorkspaceCard) => void;
  onResetHidden: () => void;
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
  starredKeys,
  hiddenCount,
  loading,
  error,
  currentKey = null,
  modelsReady,
  onSelect,
  onStar,
  onHide,
  onResetHidden,
  onBrowse,
  onDefaultCwd,
  onRetry,
  onAddModels,
  onClose,
}: Props) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("");
  const starred = useMemo(() => new Set(starredKeys), [starredKeys]);
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

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, project: WorkspaceCard) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(project);
    }
  };

  const stopCard = (event: MouseEvent, run: () => void) => {
    event.stopPropagation();
    event.preventDefault();
    run();
  };

  const openActions = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, flexShrink: 0 }}>
      {hiddenCount > 0 && (
        <button type="button" className="workspace-text-btn" onClick={onResetHidden}>
          {t("workspace.resetHidden")}
        </button>
      )}
      <button type="button" className="workspace-text-btn" onClick={onBrowse}>
        {t("workspace.openFolder")}
      </button>
      <button type="button" className="workspace-text-btn" onClick={onDefaultCwd}>
        {t("workspace.useTodayDir")}
      </button>
      {host === "modal" && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("workspace.closeSwitcher")}
          title={t("workspace.closeSwitcher")}
          style={{
            width: 28,
            height: 28,
            border: "1px solid var(--border)",
            borderRadius: 4,
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
  );

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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
        >
          <div style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-dim)",
            letterSpacing: "0.02em",
          }}
          >
            {t("workspace.productName")}
          </div>
          {openActions}
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
        {host === "modal" && openActions}
      </div>

      {showFilter && !loading && !error && (
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("workspace.filter")}
          style={{
            width: "100%",
            marginTop: 16,
            height: 32,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: 4,
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
            <button type="button" onClick={onRetry} className="workspace-text-btn" style={{ marginTop: 12, color: "var(--accent)" }}>
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
                  borderRadius: 4,
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
              const isStarred = starred.has(project.key);
              const footer = project.sessionCount === 0
                ? t("workspace.noSessions")
                : t("workspace.sessionCount", { n: project.sessionCount });
              const relative = project.lastModified
                ? formatRelativeTime(project.lastModified, locale)
                : "";
              return (
                <div
                  key={project.key}
                  className="workspace-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(project)}
                  onKeyDown={(event) => handleCardKeyDown(event, project)}
                  title={project.root}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 6,
                    minHeight: 96,
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    borderLeft: isCurrent ? "2px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 4,
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
                        color: "var(--text-dim)",
                      }}
                      >
                        {t("workspace.current")}
                      </span>
                    )}
                    <div className="workspace-card-actions">
                      <button
                        type="button"
                        className={`workspace-card-icon-btn workspace-card-star${isStarred ? " is-on" : ""}`}
                        title={isStarred ? t("workspace.unstar") : t("workspace.star")}
                        aria-label={isStarred ? t("workspace.unstar") : t("workspace.star")}
                        onClick={(event) => stopCard(event, () => onStar(project))}
                      >
                        {isStarred ? "★" : "☆"}
                      </button>
                      <button
                        type="button"
                        className="workspace-card-icon-btn workspace-card-hide"
                        title={t("workspace.hide")}
                        aria-label={t("workspace.hide")}
                        onClick={(event) => stopCard(event, () => onHide(project))}
                      >
                        ×
                      </button>
                    </div>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModel && (
        <button
          type="button"
          onClick={onAddModels}
          className="workspace-text-btn"
          style={{ display: "block", marginTop: 20 }}
        >
          {t("workspace.addModel")}
        </button>
      )}
    </div>
  );
}
