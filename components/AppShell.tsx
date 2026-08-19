"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useGlobalKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SessionSidebar } from "./SessionSidebar";
import { ChatWindow } from "./ChatWindow";
import { FileViewer } from "./FileViewer";
import { TabBar, type Tab } from "./TabBar";
import { openFileTab, saveFileViewerState } from "./file-tab-state";
import { SettingsDialog } from "./SettingsDialog";
import { AppStatusBar } from "./AppStatusBar";
import type { ToolPreset } from "@/lib/tool-presets";
import { ProjectTrustDialog } from "./ProjectTrustDialog";
import { BranchNavigator, sessionHasBranches } from "./BranchNavigator";
import { useI18n } from "@/hooks/useI18n";
import { useToast } from "@/hooks/useToast";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useExplorerVisibility } from "@/hooks/useExplorerVisibility";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useAudio } from "@/hooks/useAudio";
import { copyText } from "@/lib/clipboard";
import { getFileName } from "@/lib/file-paths";
import { skillExpansionsToSidebarTitle } from "@/lib/slash-display";
import { buildAtMentionText, buildFileAtMentionsText, buildFileLineMentionText } from "@/lib/file-fuzzy";
import {
  claimExtensionAttentionNotification,
  shouldShowBrowserNotification,
  showBrowserNotification,
} from "@/lib/browser-notifications";
import { getInitialNavigation } from "@/lib/initial-navigation";
import {
  clearLastOpen,
  getLastOpenSession,
  setLastOpenSession,
  workspaceKeyOf,
} from "@/lib/workspace-memory";
import { applyHistoryDrag, applyRightPanelDrag } from "@/lib/panel-cascade";
import {
  getDefaultRightPanelWidth,
  getRightPanelMaxWidth,
  getSidebarMaxWidth,
  HISTORY_DEFAULT_WIDTH,
  HISTORY_MAX_WIDTH,
  HISTORY_MIN_WIDTH,
  RIGHT_PANEL_FALLBACK_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_SNAP_COLLAPSE,
} from "@/lib/panel-layout";
import type { AgentMessage, BlockingExtensionUiRequest, SessionInfo, SessionTreeNode } from "@/lib/types";
import type { ProjectTrustStatus } from "@/lib/api-types";
import type { ChatInputHandle } from "./ChatInput";
import type { SessionStatsInfo } from "@/lib/pi-types";
import type { FileViewerState } from "@/lib/file-viewer-state";
import { formatSessionHistoryMarkdown } from "@/lib/session-virtual-docs";
import { formatSystemPromptView } from "@/lib/system-prompt-view";
import { isVirtualFilePath, virtualDocPath } from "@/lib/virtual-files";
import { shouldAttemptAutoSessionTitle } from "@/lib/session-auto-title";

type SessionCopyField = "file" | "id";
type AutoNameStatus = { kind: "idle" } | { kind: "naming" };

const TOP_BAR_ICON_BUTTON_SIZE = 36;
/** 侧栏窄于此时「设置」只显示齿轮，避免挤掉标签。 */
const SETTINGS_LABEL_MIN_WIDTH = 220;

export function AppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialNavigation] = useState(() => getInitialNavigation(searchParams));
  const { locale, t: translate } = useI18n();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const { layoutMode } = useLayoutMode();
  const { showHiddenFiles } = useExplorerVisibility();
  // 手机保持「中间对话」；桌面才按设置换槽。
  const isEditorLayout = !isMobile && layoutMode === "editor";
  const [sessionListHost, setSessionListHost] = useState<HTMLDivElement | null>(null);
  // 默认收起：对齐 Cursor，先看当前对话，点侧栏图标再抽出列表。
  const [agentHistoryOpen, setAgentHistoryOpen] = useState(false);
  useViewportHeight();
  // Audio ownership lives here (not in ChatWindow) so the completion tone can
  // also fire for tasks finishing in a non-active workspace whose ChatWindow
  // is not mounted. ChatWindow receives the audio callbacks as props.
  const { soundEnabled, onSoundToggle, playDoneSound, unlockAudio, soundEnabledRef } = useAudio();
  const notifiedAttentionRequestIdsRef = useRef(new Set<string>());
  const handleBackgroundTaskDone = useCallback(() => {
    if (soundEnabledRef.current) playDoneSound();
  }, [playDoneSound, soundEnabledRef]);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [runningSessionIds, setRunningSessionIds] = useState<Set<string>>(() => new Set());
  const handleRunningSessionIdsChange = useCallback((ids: Set<string>) => {
    setRunningSessionIds((previous) => {
      if (previous.size === ids.size && [...ids].every((id) => previous.has(id))) return previous;
      return ids;
    });
  }, []);
  // The temporary id distinguishes consecutive fresh composers in one cwd.
  const [newSessionCwd, setNewSessionCwd] = useState<string | null>(null);
  const [newSessionDraftId, setNewSessionDraftId] = useState("initial");
  const activeNewSessionDraftKeyRef = useRef<string | null>(null);
  const [initialCwdStatus, setInitialCwdStatus] = useState<"idle" | "validating" | "ready" | "error">(
    () => initialNavigation.requestedCwd ? "validating" : "idle",
  );
  const [initialCwdError, setInitialCwdError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelsRefreshKey, setModelsRefreshKey] = useState(0);
  const [projectTrust, setProjectTrust] = useState<ProjectTrustStatus | null>(null);
  const [projectTrustDialogOpen, setProjectTrustDialogOpen] = useState(false);
  const [projectTrustBusy, setProjectTrustBusy] = useState(false);
  const [projectTrustError, setProjectTrustError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileToolbarMoreOpen, setMobileToolbarMoreOpen] = useState(false);
  const [mobileSidebarReady, setMobileSidebarReady] = useState(false);
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const rightPanelWidthRef = useRef(RIGHT_PANEL_FALLBACK_WIDTH);
  const historyWidthRef = useRef(HISTORY_DEFAULT_WIDTH);
  const agentHistoryOpenRef = useRef(agentHistoryOpen);
  const isEditorLayoutRef = useRef(isEditorLayout);
  const historyDrawerRef = useRef<HTMLDivElement | null>(null);
  const commitChatWidthRef = useRef<(width: number) => void>(() => undefined);
  const persistHistoryWidthRef = useRef<(width: number) => void>(() => undefined);
  const rightDragStartRef = useRef({
    chatWidth: RIGHT_PANEL_FALLBACK_WIDTH,
    historyOpen: false,
    historyWidth: HISTORY_DEFAULT_WIDTH,
  });
  const historyDragStartRef = useRef({
    chatWidth: RIGHT_PANEL_FALLBACK_WIDTH,
    historyWidth: HISTORY_DEFAULT_WIDTH,
  });
  const liveRightDragRef = useRef<{
    chatWidth: number;
    historyOpen: boolean;
    historyWidth: number;
  } | null>(null);
  agentHistoryOpenRef.current = agentHistoryOpen;
  isEditorLayoutRef.current = isEditorLayout;
  const getResponsiveRightPanelWidth = useCallback(
    () => typeof window === "undefined"
      ? RIGHT_PANEL_FALLBACK_WIDTH
      : getDefaultRightPanelWidth(window.innerWidth),
    [],
  );
  const getVisibleHistoryWidth = useCallback(() => (
    !isMobile && isEditorLayout && rightPanelOpen && agentHistoryOpen
      ? historyWidthRef.current
      : 0
  ), [agentHistoryOpen, isEditorLayout, isMobile, rightPanelOpen]);
  const getResponsiveSidebarMaxWidth = useCallback(
    () => typeof window === "undefined"
      ? SIDEBAR_MAX_WIDTH
      : getSidebarMaxWidth({
        viewportWidth: window.innerWidth,
        rightPanelOpen,
        rightPanelWidth: rightPanelWidthRef.current + getVisibleHistoryWidth(),
      }),
    [getVisibleHistoryWidth, rightPanelOpen],
  );
  const getResponsiveRightPanelMaxWidth = useCallback(
    () => typeof window === "undefined"
      ? RIGHT_PANEL_MAX_WIDTH
      : getRightPanelMaxWidth({
        viewportWidth: window.innerWidth,
        sidebarOpen,
        sidebarWidth: sidebarWidthRef.current,
      }),
    [sidebarOpen],
  );
  const applyHistoryDrawerLive = useCallback((open: boolean, width: number) => {
    const drawer = historyDrawerRef.current;
    if (!drawer) return;
    // 只改变量和开合属性，不写 style.width，避免松手后残留内联宽度盖住 CSS。
    drawer.style.setProperty("--agent-history-width", `${width}px`);
    if (open) {
      drawer.setAttribute("data-agent-history-open", "");
      drawer.style.borderLeft = "1px solid var(--border)";
    } else {
      drawer.removeAttribute("data-agent-history-open");
      drawer.style.borderLeft = "none";
    }
  }, []);
  const sidebarResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeSidebar"),
    cssVariable: "--sidebar-width",
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    getMaxWidth: getResponsiveSidebarMaxWidth,
    growthDirection: "right",
    maxWidth: SIDEBAR_MAX_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    storageKey: "pi-sidebar-width",
    widthRef: sidebarWidthRef,
    onFinishDrag: (rawWidth) => {
      if (rawWidth < SIDEBAR_SNAP_COLLAPSE) {
        setSidebarOpen(false);
        return "collapse";
      }
      return "persist";
    },
  });
  const historyResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeHistory"),
    cssVariable: "--agent-history-width",
    defaultWidth: HISTORY_DEFAULT_WIDTH,
    getMaxWidth: () => HISTORY_MAX_WIDTH,
    growthDirection: "left",
    maxWidth: HISTORY_MAX_WIDTH,
    minWidth: HISTORY_MIN_WIDTH,
    storageKey: "pi-agent-history-width",
    widthRef: historyWidthRef,
    onDragStart: () => {
      historyDragStartRef.current = {
        chatWidth: rightPanelWidthRef.current,
        historyWidth: historyWidthRef.current,
      };
    },
    mapLiveWidth: (rawWidth) => {
      if (!isEditorLayoutRef.current) {
        return rawWidth;
      }
      const next = applyHistoryDrag(historyDragStartRef.current, rawWidth);
      document.getElementById("file-panel")?.style.setProperty(
        "--right-panel-width",
        `${next.chatWidth + next.historyWidth}px`,
      );
      return next.historyWidth;
    },
    onFinishDrag: (_rawWidth, visibleWidth) => {
      if (isEditorLayoutRef.current) {
        const next = applyHistoryDrag(historyDragStartRef.current, visibleWidth);
        commitChatWidthRef.current(next.chatWidth);
      }
      return "persist";
    },
  });
  const rightPanelResizer = useResizablePanel({
    ariaLabel: translate("layout.resizeFilePanel"),
    cssVariable: "--right-panel-width",
    defaultWidth: RIGHT_PANEL_FALLBACK_WIDTH,
    getDefaultWidth: getResponsiveRightPanelWidth,
    getMaxWidth: getResponsiveRightPanelMaxWidth,
    growthDirection: "left",
    maxWidth: RIGHT_PANEL_MAX_WIDTH,
    minWidth: RIGHT_PANEL_MIN_WIDTH,
    storageKey: "pi-right-panel-width",
    widthRef: rightPanelWidthRef,
    toCssWidth: (chatWidth) => {
      const live = liveRightDragRef.current;
      if (live) {
        return chatWidth + (
          !isMobile && isEditorLayoutRef.current && live.historyOpen ? live.historyWidth : 0
        );
      }
      return chatWidth + getVisibleHistoryWidth();
    },
    onDragStart: () => {
      rightDragStartRef.current = {
        chatWidth: rightPanelWidthRef.current,
        historyOpen: agentHistoryOpenRef.current,
        historyWidth: historyWidthRef.current,
      };
      liveRightDragRef.current = rightDragStartRef.current;
    },
    mapLiveWidth: (rawWidth) => {
      const next = applyRightPanelDrag(rightDragStartRef.current, rawWidth, {
        chatMax: getResponsiveRightPanelMaxWidth(),
      });
      liveRightDragRef.current = next;
      applyHistoryDrawerLive(next.historyOpen, next.historyWidth);
      // 越过关历史阈值时立刻同步 React，避免重绘把抽屉又撑开。
      if (next.historyOpen !== agentHistoryOpenRef.current) {
        setAgentHistoryOpen(next.historyOpen);
      }
      return next.chatWidth;
    },
    onFinishDrag: (rawWidth, visibleWidth) => {
      const next = applyRightPanelDrag(rightDragStartRef.current, rawWidth, {
        chatMax: getResponsiveRightPanelMaxWidth(),
      });
      // 松手后 hook 还会 commitWidth；先留下 live 结果给 toCssWidth，避免仍按旧的「历史开着」加宽。
      liveRightDragRef.current = next;
      agentHistoryOpenRef.current = next.historyOpen;
      setAgentHistoryOpen(next.historyOpen);
      if (next.historyOpen) {
        persistHistoryWidthRef.current(next.historyWidth);
      }
      applyHistoryDrawerLive(next.historyOpen, next.historyWidth);
      if (next.collapsePanel) {
        setRightPanelOpen(false);
        return "collapse";
      }
      void visibleWidth;
      return "persist";
    },
  });
  commitChatWidthRef.current = rightPanelResizer.commitWidth;
  persistHistoryWidthRef.current = historyResizer.commitWidth;
  const setHistoryDrawerRef = useCallback((node: HTMLDivElement | null) => {
    historyDrawerRef.current = node;
    historyResizer.panelRef.current = node;
    setSessionListHost(node);
  }, [historyResizer.panelRef]);
  const reclampSidebarWidth = sidebarResizer.reclampWidth;
  const reclampRightPanelWidth = rightPanelResizer.reclampWidth;
  // On mobile the sidebar is an overlay drawer; hide it by default so the chat
  // is visible on load. Runs once the breakpoint resolves after hydration.
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setRightPanelOpen(false);
    }
  }, [isMobile]);
  useEffect(() => {
    setMobileSidebarReady(true);
  }, []);
  useEffect(() => {
    if (!rightPanelOpen || rightPanelResizer.isResizing || historyResizer.isResizing) return;
    reclampSidebarWidth();
    reclampRightPanelWidth();
  }, [agentHistoryOpen, historyResizer.isResizing, reclampRightPanelWidth, reclampSidebarWidth, rightPanelOpen, rightPanelResizer.isResizing]);
  useEffect(() => {
    if (rightPanelResizer.isResizing) return;
    liveRightDragRef.current = null;
  }, [rightPanelResizer.isResizing]);
  const chatInputRef = useRef<ChatInputHandle | null>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const mobileToolbarRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const sessionMenuPanelRef = useRef<HTMLDivElement>(null);
  const [sessionToolsMenuOpen, setSessionToolsMenuOpen] = useState(false);

  // Branch navigator state — populated by ChatWindow via onBranchDataChange
  const [branchTree, setBranchTree] = useState<SessionTreeNode[]>([]);
  const [branchActiveLeafId, setBranchActiveLeafId] = useState<string | null>(null);
  const branchLeafChangeFnRef = useRef<((leafId: string | null) => void) | null>(null);

  const handleBranchDataChange = useCallback((tree: SessionTreeNode[], activeLeafId: string | null, onLeafChange: (leafId: string | null) => void) => {
    setBranchTree(tree);
    setBranchActiveLeafId(activeLeafId);
    branchLeafChangeFnRef.current = onLeafChange;
  }, []);

  const handleBranchLeafChange = useCallback((leafId: string | null) => {
    branchLeafChangeFnRef.current?.(leafId);
  }, []);

  const [statusToolPreset, setStatusToolPreset] = useState<ToolPreset>("default");
  const [statusToolDisabled, setStatusToolDisabled] = useState(true);
  const [statusHasTool, setStatusHasTool] = useState(false);
  const [statusHasCompact, setStatusHasCompact] = useState(false);
  const [statusCompacting, setStatusCompacting] = useState(false);
  const [statusCompactDisabled, setStatusCompactDisabled] = useState(true);
  const statusToolChangeRef = useRef<((preset: ToolPreset) => void) | null>(null);
  const statusCompactRef = useRef<(() => void) | null>(null);
  const statusAbortCompactRef = useRef<(() => void) | null>(null);
  const handleComposerStatusChange = useCallback((
    status: {
      toolPreset: ToolPreset;
      onToolPresetChange?: (preset: ToolPreset) => void;
      isStreaming: boolean;
      onCompact?: () => void;
      onAbortCompaction?: () => void;
      isCompacting?: boolean;
    } | null,
  ) => {
    if (!status) {
      statusToolChangeRef.current = null;
      statusCompactRef.current = null;
      statusAbortCompactRef.current = null;
      setStatusHasTool(false);
      setStatusHasCompact(false);
      setStatusToolDisabled(true);
      setStatusCompacting(false);
      setStatusCompactDisabled(true);
      return;
    }
    if (status.onToolPresetChange) {
      setStatusHasTool(true);
      setStatusToolPreset(status.toolPreset);
      setStatusToolDisabled(status.isStreaming);
      statusToolChangeRef.current = status.onToolPresetChange;
    } else {
      statusToolChangeRef.current = null;
      setStatusHasTool(false);
      setStatusToolDisabled(true);
    }
    if (status.onCompact) {
      setStatusHasCompact(true);
      setStatusCompacting(Boolean(status.isCompacting));
      setStatusCompactDisabled(status.isStreaming && !status.isCompacting);
      statusCompactRef.current = status.onCompact;
      statusAbortCompactRef.current = status.onAbortCompaction ?? null;
    } else {
      statusCompactRef.current = null;
      statusAbortCompactRef.current = null;
      setStatusHasCompact(false);
      setStatusCompacting(false);
      setStatusCompactDisabled(true);
    }
  }, []);
  const handleStatusToolPresetChange = useCallback((preset: ToolPreset) => {
    statusToolChangeRef.current?.(preset);
    setStatusToolPreset(preset);
  }, []);
  const handleStatusCompact = useCallback(() => {
    statusCompactRef.current?.();
  }, []);
  const handleStatusAbortCompaction = useCallback(() => {
    statusAbortCompactRef.current?.();
  }, []);

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [systemPromptLoading, setSystemPromptLoading] = useState(false);
  const systemPromptLoaderRef = useRef<(() => Promise<string>) | null>(null);
  const systemPromptLoadIdRef = useRef(0);

  const handleSystemPromptChange = useCallback((prompt: string | null) => {
    setSystemPrompt(prompt);
    setSystemPromptLoading(false);
  }, []);

  const handleSystemPromptLoaderChange = useCallback((loader: (() => Promise<string>) | null) => {
    systemPromptLoadIdRef.current += 1;
    systemPromptLoaderRef.current = loader;
    setSystemPromptLoading(false);
  }, []);

  // Session stats (tokens + cost) — populated by ChatWindow, displayed in top bar
  const [sessionStats, setSessionStats] = useState<SessionStatsInfo | null>(null);
  const [autoNameStatus, setAutoNameStatus] = useState<AutoNameStatus>({ kind: "idle" });
  const autoNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNameSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNamedSuccessIdsRef = useRef(new Set<string>());
  const autoNameInFlightRef = useRef<string | null>(null);
  const selectedSessionRef = useRef<SessionInfo | null>(selectedSession);
  selectedSessionRef.current = selectedSession;
  const sessionStatsRef = useRef<SessionStatsInfo | null>(null);
  const activeSessionIdRef = useRef<string | null>(selectedSession?.id ?? null);
  activeSessionIdRef.current = selectedSession?.id ?? null;
  const handleSessionStatsChange = useCallback((stats: SessionStatsInfo | null) => {
    sessionStatsRef.current = stats;
    setSessionStats(stats);
  }, []);
  const [copiedSessionField, setCopiedSessionField] = useState<SessionCopyField | null>(null);
  const sessionCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCopySessionField = useCallback((field: SessionCopyField, value: string) => {
    void copyText(value).then(() => {
      if (sessionCopyTimerRef.current) clearTimeout(sessionCopyTimerRef.current);
      setCopiedSessionField(field);
      sessionCopyTimerRef.current = setTimeout(() => setCopiedSessionField(null), 1400);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (sessionCopyTimerRef.current) clearTimeout(sessionCopyTimerRef.current);
      if (autoNameTimerRef.current) clearTimeout(autoNameTimerRef.current);
      if (autoNameSettleTimerRef.current) clearTimeout(autoNameSettleTimerRef.current);
    };
  }, []);

  // Context usage — populated by ChatWindow, displayed in top bar
  const [contextUsage, setContextUsage] = useState<{ percent: number | null; contextWindow: number; tokens: number | null } | null>(null);
  const handleContextUsageChange = useCallback((usage: { percent: number | null; contextWindow: number; tokens: number | null } | null) => {
    setContextUsage(usage);
  }, []);

  // Single active panel — only one dropdown open at a time
  const [activeTopPanel, setActiveTopPanel] = useState<"branches" | "session" | null>(null);
  const [topPanelPos, setTopPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const toggleTopPanel = useCallback((
    panel: "branches" | "session",
    keepMobileToolbarOpen = false,
  ) => {
    if (isMobile) setSidebarOpen(false);
    setSessionToolsMenuOpen(false);
    setActiveTopPanel((cur) => cur === panel ? null : panel);
    if (isMobile && keepMobileToolbarOpen) setMobileToolbarMoreOpen(true);
  }, [isMobile]);

  const openSessionStatsPanel = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
    setMobileToolbarMoreOpen(false);
    setActiveTopPanel("session");
  }, [isMobile]);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setActiveTopPanel(null);
      setMobileToolbarMoreOpen(false);
    }
    setSidebarOpen((open) => !open);
  }, [isMobile]);

  const handleMobileToolbarMoreToggle = useCallback(() => {
    setSidebarOpen(false);
    setActiveTopPanel(null);
    setMobileToolbarMoreOpen((open) => !open);
  }, []);

  const handleRightPanelToggle = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setActiveTopPanel(null);
      setMobileToolbarMoreOpen(false);
    }
    setRightPanelOpen((open) => !open);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileToolbarMoreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const toolbar = mobileToolbarRef.current;
      if (toolbar && event.composedPath().includes(toolbar)) return;
      setMobileToolbarMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMobileToolbarMoreOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [mobileToolbarMoreOpen]);

  useEffect(() => {
    setMobileToolbarMoreOpen(false);
  }, [isMobile, selectedSession?.id, newSessionDraftId]);

  useEffect(() => {
    if (!sessionToolsMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      const menu = sessionMenuRef.current;
      const panel = sessionMenuPanelRef.current;
      if (menu && path.includes(menu)) return;
      if (panel && path.includes(panel)) return;
      setSessionToolsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSessionToolsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [sessionToolsMenuOpen]);

  useEffect(() => {
    if (!activeTopPanel || !topBarRef.current) return;
    const update = () => {
      const topBarRect = topBarRef.current!.getBoundingClientRect();
      setTopPanelPos({ top: topBarRect.bottom, left: topBarRect.left, width: topBarRect.width });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(topBarRef.current);
    return () => ro.disconnect();
  }, [activeTopPanel, isMobile]);

  // Right panel — file tabs only
  const [fileTabs, setFileTabs] = useState<Tab[]>([]);
  const [activeFileTabId, setActiveFileTabId] = useState<string | null>(null);

  /**
   * 在右侧文件区打开虚拟 Markdown：复用标签栏与 FileViewer，不写磁盘。
   */
  const openVirtualMarkdown = useCallback((
    filePath: string,
    fileName: string,
    content: string,
  ) => {
    const tabId = `file:${filePath}`;
    setFileTabs((prev) => {
      const existing = prev.find((tab) => tab.id === tabId);
      if (!existing) {
        return [...prev, {
          id: tabId,
          label: fileName,
          filePath,
          virtualContent: content,
          viewerRevision: 0,
        }];
      }
      return prev.map((tab) => (
        tab.id === tabId
          ? { ...tab, virtualContent: content, viewerRevision: (tab.viewerRevision ?? 0) + 1 }
          : tab
      ));
    });
    setActiveFileTabId(tabId);
    // 编辑器布局下右侧是对话栏，打开文件不应依赖「打开文件面板」。
    if (!isEditorLayout) setRightPanelOpen(true);
    setActiveTopPanel(null);
    setSessionToolsMenuOpen(false);
    if (isMobile) {
      setSidebarOpen(false);
      setMobileToolbarMoreOpen(false);
    }
  }, [isEditorLayout, isMobile]);

  const handleOpenSystemPrompt = useCallback(async () => {
    const sessionId = selectedSession?.id;
    if (!sessionId) return;
    const loadId = ++systemPromptLoadIdRef.current;
    setSystemPromptLoading(true);
    try {
      const load = systemPromptLoaderRef.current;
      const prompt = load ? await load() : (systemPrompt ?? "");
      if (systemPromptLoadIdRef.current !== loadId) return;
      openVirtualMarkdown(
        virtualDocPath("system", sessionId),
        translate("files.systemTab"),
        formatSystemPromptView(prompt, sessionId),
      );
    } catch (error) {
      if (systemPromptLoadIdRef.current !== loadId) return;
      openVirtualMarkdown(
        virtualDocPath("system", sessionId),
        translate("files.systemTab"),
        formatSystemPromptView(
          translate("files.systemLoadFailed", { error: error instanceof Error ? error.message : String(error) }),
          sessionId,
        ),
      );
    } finally {
      if (systemPromptLoadIdRef.current === loadId) setSystemPromptLoading(false);
    }
  }, [openVirtualMarkdown, selectedSession?.id, systemPrompt, translate]);

  const handleFileViewerStateChange = useCallback((
    tabId: string,
    viewerRevision: number,
    viewerState: FileViewerState,
  ) => {
    setFileTabs((prev) => saveFileViewerState(prev, tabId, viewerRevision, viewerState));
  }, []);

  // Same @mention format as the chat input's @ autocomplete, so the agent's
  // read tool resolves it the same way (it strips the @ prefix).
  const handleAtMention = useCallback((relativePath: string, isDir: boolean) => {
    chatInputRef.current?.insertText(buildAtMentionText(relativePath, isDir));
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  const handleAtMentions = useCallback((relativePaths: string[]) => {
    const mentions = buildFileAtMentionsText(relativePaths);
    if (mentions) chatInputRef.current?.insertText(mentions);
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  const handleFileLineMention = useCallback((relativePath: string, startLine: number, endLine: number) => {
    chatInputRef.current?.insertText(buildFileLineMentionText(relativePath, startLine, endLine));
    if (isMobile) { setRightPanelOpen(false); setSidebarOpen(false); }
  }, [isMobile]);

  const initialSessionId = initialNavigation.sessionId;
  const [activeCwd, setActiveCwd] = useState<string | null>(null);
  const activeProjectKeyRef = useRef<string | null>(null);
  // True once the initial ?session= URL param has been resolved (or confirmed absent)
  const [initialSessionRestored, setInitialSessionRestored] = useState<boolean>(() => !initialSessionId);
  // Suppresses sessionKey bump in handleCwdChange during the initial URL restore
  const suppressCwdBumpRef = useRef(false);
  // Guards the async workspace restore so a slow response from an earlier
  // switch cannot resurrect a session into a project the user already left.
  const workspaceRestoreTokenRef = useRef(0);

  const invalidateWorkspaceRestore = useCallback(() => {
    workspaceRestoreTokenRef.current += 1;
  }, []);

  // Persist every active-session transition, including new and forked sessions
  // that bypass the sidebar selection handler. Transient sessions do not yet
  // carry projectKey, so use the active project identity until hydration.
  useEffect(() => {
    if (!selectedSession) return;
    const projectKey = selectedSession.projectKey
      ?? activeProjectKeyRef.current
      ?? workspaceKeyOf(selectedSession);
    setLastOpenSession(projectKey, selectedSession.id);
  }, [selectedSession]);

  useEffect(() => {
    const requestedCwd = initialNavigation.requestedCwd;
    if (!requestedCwd) return;

    const controller = new AbortController();
    setInitialCwdStatus("validating");
    setInitialCwdError(null);

    void fetch("/api/cwd/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: requestedCwd }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { cwd?: string; error?: string };
        if (!response.ok || !data.cwd) {
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }

        // The sidebar will notify us when it adopts this cwd. Avoid remounting
        // the just-created empty chat during that initial synchronization.
        suppressCwdBumpRef.current = true;
        const draftId = `initial:${requestedCwd}`;
        setNewSessionDraftId(draftId);
        activeNewSessionDraftKeyRef.current = `new:${draftId}:${data.cwd}`;
        setNewSessionCwd(data.cwd);
        setInitialCwdStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setInitialCwdError(error instanceof Error ? error.message : String(error));
        setInitialCwdStatus("error");
      });

    return () => controller.abort();
  }, [initialNavigation]);

  // Restore the workspace's last open session after switching to it. Called
  // from handleCwdChange once the outgoing context has been reset. The session
  // is looked up against the live list so a deleted or drifted session falls
  // back to the default welcome page instead of erroring.
  const restoreWorkspaceContext = useCallback((projectKey: string) => {
    const token = ++workspaceRestoreTokenRef.current;
    const lastOpenSessionId = getLastOpenSession(projectKey);
    if (!lastOpenSessionId) return;
    void fetch("/api/sessions")
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: SessionInfo[] }>) : null))
      .then((d) => {
        if (token !== workspaceRestoreTokenRef.current) return; // stale switch
        const s = d?.sessions.find((x) => x.id === lastOpenSessionId);
        if (!s) {
          // The list loaded but the remembered session is gone — forget it.
          // When the list itself failed (d === null) keep the memory so a
          // later switch retries the restore.
          if (d) clearLastOpen(projectKey);
          return;
        }
        if (workspaceKeyOf(s) !== projectKey) {
          // Defensive: the remembered session drifted out of this workspace.
          clearLastOpen(projectKey);
          return;
        }
        // Selecting the session must remount the chat with the session
        // present: useAgentSession loads content in a mount-only effect, so
        // the null-session welcome mount from the switch would never load
        // the restored session's messages.
        setSelectedSession(s);
        setSessionKey((k) => k + 1);
        if (new URLSearchParams(window.location.search).get("session") !== s.id) {
          router.replace(`?session=${encodeURIComponent(s.id)}`, { scroll: false });
        }
      })
      .catch(() => {
        // Network hiccup: keep the remembered session for a later retry.
      });
  }, [router]);

  const handleCwdChange = useCallback((
    cwd: string | null,
    projectRoot?: string | null,
    projectKey?: string | null,
  ) => {
    invalidateWorkspaceRestore();
    const currentFreshCwd = newSessionCwd ?? activeCwd;
    setActiveCwd(cwd);
    // Skip if cwd is null (initial mount).
    if (!cwd) return;
    const newProject = projectKey ?? projectRoot ?? cwd;
    const currentProject = activeProjectKeyRef.current
      ?? (selectedSession ? workspaceKeyOf(selectedSession) : null);
    activeProjectKeyRef.current = newProject;

    // Keep the project identity in sync during the initial URL restore without
    // remounting the just-created or restored chat.
    if (suppressCwdBumpRef.current) {
      suppressCwdBumpRef.current = false;
      return;
    }
    // The server may hydrate a normalized key after a custom cwd is already
    // active. Updating identity for the exact same cwd is not a user switch.
    if (currentFreshCwd === cwd && currentProject !== newProject) return;
    // Existing sessions stay open when the worktree selector moves within the
    // same project. A fresh composer must remount when its effective cwd moves,
    // otherwise its already-created runtime would keep sending to the old cwd.
    if (
      currentProject === newProject
      && (selectedSession !== null || currentFreshCwd === cwd)
    ) {
      return;
    }
    // Close any session that belongs to a different project — it no longer
    // matches the selected project directory.
    const draftId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    setNewSessionDraftId(draftId);
    activeNewSessionDraftKeyRef.current = `new:${draftId}:${cwd}`;
    setSelectedSession(null);
    setNewSessionCwd((prev) => {
      if (prev && prev !== cwd) return null;
      return prev;
    });
    setSessionKey((k) => k + 1);
    setBranchTree([]);
    setBranchActiveLeafId(null);
    setSystemPrompt(null);
    setSystemPromptLoading(false);
    setActiveTopPanel(null);
    if (currentProject !== newProject) {
      // File tabs are keyed by absolute path, so tabs opened in the previous
      // project must not linger. Same-project worktree switches keep them.
      setFileTabs([]);
      setActiveFileTabId(null);
      setRightPanelOpen(false);
      // Restore the workspace we switched to: its last open session, or keep
      // the default welcome page when none is remembered.
      restoreWorkspaceContext(newProject);
    }
    router.replace("/", { scroll: false });
  }, [activeCwd, invalidateWorkspaceRestore, newSessionCwd, router, selectedSession, restoreWorkspaceContext]);

  const handleSelectSession = useCallback((session: SessionInfo, isRestore = false) => {
    invalidateWorkspaceRestore();
    activeNewSessionDraftKeyRef.current = null;
    // D4：点列表某条后抽屉保持打开，方便连续切换。
    // Re-clicking the already-open session must not remount the chat and
    // re-run the full load/positioning cycle. Only skip when the effective
    // cwd context already matches — otherwise a pending cwd move still needs
    // the full re-select flow.
    if (!isRestore && selectedSession) {
      const sameProject =
        workspaceKeyOf(selectedSession) === workspaceKeyOf(session);
      if (selectedSession.id === session.id && sameProject) {
        if (isMobile) setSidebarOpen(false);
        return;
      }
    }
    setNewSessionCwd(null);
    setSelectedSession(session);
    setSessionKey((k) => k + 1);
    setSystemPrompt(null);
    setSystemPromptLoading(false);
    setInitialSessionRestored(true);
    // On mobile, collapse the overlay drawer so the chat is revealed after pick.
    if (isMobile && !isRestore) setSidebarOpen(false);
    if (isRestore) {
      // Suppress the redundant sessionKey bump that would come from the
      // onCwdChange effect firing after setSelectedCwd in the sidebar
      suppressCwdBumpRef.current = true;
    }
    // Skip router.replace when restoring from URL — the param is already correct
    // and calling replace in production Next.js triggers a Suspense remount loop
    if (!isRestore) {
      router.replace(`?session=${encodeURIComponent(session.id)}`, { scroll: false });
    }
  }, [invalidateWorkspaceRestore, router, isMobile, selectedSession]);

  const handleNewSession = useCallback((sessionId: string, cwd: string) => {
    invalidateWorkspaceRestore();
    const draftKey = `new:${sessionId}:${cwd}`;
    activeNewSessionDraftKeyRef.current = draftKey;
    setNewSessionDraftId(sessionId);
    setSelectedSession(null);
    setNewSessionCwd(cwd);
    setSessionKey((k) => k + 1);
    setBranchTree([]);
    setBranchActiveLeafId(null);
    setSystemPrompt(null);
    setSystemPromptLoading(false);
    setActiveTopPanel(null);
    if (isMobile) setSidebarOpen(false);
    router.replace("/", { scroll: false });
  }, [invalidateWorkspaceRestore, router, isMobile]);

  /**
   * 三处新建共用：对话顶栏 +、历史「新对话」、栏收起时主顶栏 +。
   * 编辑器下若整栏关着，先打开再进入空会话，避免入口消失。
   */
  const startNewConversation = useCallback(() => {
    const cwd = activeCwd ?? selectedSession?.cwd;
    if (!cwd) return;
    if (isEditorLayout) setRightPanelOpen(true);
    const tempId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    handleNewSession(tempId, cwd);
  }, [activeCwd, handleNewSession, isEditorLayout, selectedSession?.cwd]);

  const toggleHistory = useCallback(() => {
    if (isEditorLayout) setRightPanelOpen(true);
    setAgentHistoryOpen((open) => !open);
  }, [isEditorLayout]);

  // Global keyboard shortcuts (handles Esc, Ctrl+Alt+N etc.)
  useGlobalKeyboardShortcuts({
    onNewSession: (cwd: string) => handleNewSession(`kb-${Date.now()}`, cwd),
    activeCwd,
  });

  // Client-built transient SessionInfo (new session / fork) lacks the
  // server-computed projectKey, which the same-project check in
  // handleCwdChange relies on. Hydrate it from the session list so switching
  // worktrees right after creating a session doesn't close the chat.
  const hydrateSelectedSession = useCallback((sessionId: string) => {
    return fetch("/api/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ sessions: SessionInfo[] }>) : null))
      .then((d) => {
        const full = d?.sessions.find((s) => s.id === sessionId);
        if (!full) return null;
        setSelectedSession((prev) => (
          prev?.id === sessionId
            ? { ...prev, ...full, transient: full.transient ?? false }
            : prev
        ));
        return full;
      })
      .catch(() => null);
  }, []);

  // Called by ChatWindow when a new session gets its real id from pi
  const handleSessionCreated = useCallback((session: SessionInfo, sourceDraftKey: string) => {
    setRefreshKey((k) => k + 1);
    if (activeNewSessionDraftKeyRef.current !== sourceDraftKey) return;
    invalidateWorkspaceRestore();
    activeNewSessionDraftKeyRef.current = null;
    setNewSessionCwd(null);
    setSelectedSession(session);
    hydrateSelectedSession(session.id);
    router.replace(`?session=${encodeURIComponent(session.id)}`, { scroll: false });
  }, [invalidateWorkspaceRestore, router, hydrateSelectedSession]);

  const deliverSessionNotification = useCallback(({
    targetSession,
    title,
    body,
    tag,
  }: {
    targetSession: SessionInfo | null;
    title: string;
    body: string;
    tag?: string;
  }) => {
    if (!("Notification" in window)) return;

    const fire = () => {
      const sessionUrl = targetSession ? `/?session=${encodeURIComponent(targetSession.id)}` : "/";
      void showBrowserNotification({
        title,
        body,
        sessionUrl,
        tag,
        onClick: () => {
          window.focus();
          if (targetSession) handleSelectSession(targetSession);
        },
      });
    };

    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
    }
  }, [handleSelectSession]);

  const requestSessionTitle = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
    const force = options.force === true;
    const silent = options.silent === true;
    const sessionId = activeSessionIdRef.current;
    const selected = selectedSessionRef.current;
    if (!sessionId || !selected) return;
    if (autoNameInFlightRef.current) return;

    if (!force) {
      let persistedName = selected.name;
      let transient = Boolean(selected.transient);
      const stats = sessionStatsRef.current;
      let hasMessages = Boolean(
        (stats?.sessionId === sessionId && (stats.userMessages ?? 0) > 0)
        || selected.messageCount > 0,
      );
      try {
        const live = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (live.ok) {
          const data = await live.json() as { info?: { name?: string; transient?: boolean; messageCount?: number } };
          persistedName = data.info?.name;
          transient = Boolean(data.info?.transient);
          hasMessages = (data.info?.messageCount ?? 0) > 0 || hasMessages;
        }
      } catch {
        // 实时读取失败时退回壳层快照，门控仍会挡住 transient / 空消息。
      }
      if (!shouldAttemptAutoSessionTitle({
        transient,
        persistedName,
        hasMessages,
        alreadyAutoSucceeded: autoNamedSuccessIdsRef.current.has(sessionId),
        isBusy: autoNameInFlightRef.current !== null || autoNameStatus.kind === "naming",
      })) {
        return;
      }
    } else if (selected.transient || autoNameStatus.kind === "naming") {
      return;
    }

    autoNameInFlightRef.current = sessionId;
    if (autoNameTimerRef.current) clearTimeout(autoNameTimerRef.current);
    if (!silent) {
      setActiveTopPanel(null);
      showToast({ message: translate("title.generating"), tone: "info" });
    }
    setAutoNameStatus({ kind: "naming" });

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/auto-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const body = (await response.json().catch(() => ({}))) as { title?: string; error?: string };
      if (!response.ok || !body.title) {
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const title = body.title.trim();
      setRefreshKey((key) => key + 1);
      if (activeSessionIdRef.current !== sessionId) return;
      setSelectedSession((current) => current?.id === sessionId ? { ...current, name: title } : current);
      setSessionStats((current) => current?.sessionId === sessionId ? { ...current, sessionName: title } : current);
      if (!force) autoNamedSuccessIdsRef.current.add(sessionId);
      setAutoNameStatus({ kind: "idle" });
      if (!silent) showToast({ message: translate("title.updated"), tone: "success" });
    } catch (error) {
      if (activeSessionIdRef.current !== sessionId) return;
      if (silent) {
        console.warn("Automatic session title failed:", error);
        setAutoNameStatus({ kind: "idle" });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setAutoNameStatus({ kind: "idle" });
      showToast({ message: message || translate("title.failed"), tone: "error" });
    } finally {
      if (autoNameInFlightRef.current === sessionId) autoNameInFlightRef.current = null;
    }
  }, [autoNameStatus.kind, showToast, translate]);

  const handleAgentEnd = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setExplorerRefreshKey((k) => k + 1);
    const sessionId = activeSessionIdRef.current;
    if (sessionId) {
      void hydrateSelectedSession(sessionId).finally(() => {
        if (autoNameSettleTimerRef.current) clearTimeout(autoNameSettleTimerRef.current);
        // prompt_done 与 agent_settled 可能连续触发，合并成一次自动命名。
        autoNameSettleTimerRef.current = setTimeout(() => {
          void requestSessionTitle({ silent: true });
        }, 400);
      });
    }

    if (!shouldShowBrowserNotification()) return;
    const targetSession = selectedSessionRef.current;
    deliverSessionNotification({
      targetSession,
      title: targetSession?.name ?? translate("i18n.sessionComplete"),
      body: translate("i18n.taskFinished"),
    });
  }, [deliverSessionNotification, hydrateSelectedSession, requestSessionTitle, translate]);

  const handleAttentionNeeded = useCallback((request: BlockingExtensionUiRequest) => {
    if (!shouldShowBrowserNotification()) return;
    if (!claimExtensionAttentionNotification(request, notifiedAttentionRequestIdsRef.current)) return;

    deliverSessionNotification({
      targetSession: selectedSession,
      title: translate("i18n.attentionNeeded"),
      body: request.method === "custom"
        ? translate("i18n.extensionInputNeeded")
        : request.title,
      tag: `pi-extension-ui:${request.id}`,
    });
  }, [deliverSessionNotification, selectedSession, translate]);

  const handleAutoName = useCallback(() => {
    const selected = selectedSessionRef.current;
    if (!selected || selected.transient) {
      showToast({ message: translate("title.unsaved"), tone: "info" });
      return;
    }
    const stats = sessionStatsRef.current;
    const hasMessages = Boolean(
      (stats?.sessionId === selected.id && (stats.userMessages ?? 0) > 0)
      || selected.messageCount > 0,
    );
    if (!hasMessages) {
      showToast({ message: translate("title.noMessages"), tone: "info" });
      return;
    }
    void requestSessionTitle({ force: true });
  }, [requestSessionTitle, showToast, translate]);

  useEffect(() => {
    if (autoNameTimerRef.current) clearTimeout(autoNameTimerRef.current);
    setAutoNameStatus({ kind: "idle" });
  }, [selectedSession?.id]);

  const handleExplorerRefresh = useCallback(() => {
    setExplorerRefreshKey((k) => k + 1);
  }, []);

  const handleSessionForked = useCallback((newSessionId: string) => {
    invalidateWorkspaceRestore();
    activeNewSessionDraftKeyRef.current = null;
    setRefreshKey((k) => k + 1);
    setSessionKey((k) => k + 1);
    setNewSessionCwd(null);
    setSelectedSession((prev) => ({
      ...(prev ?? { path: "", cwd: "", created: "", modified: "", messageCount: 0, firstMessage: "" }),
      id: newSessionId,
      transient: false,
    }));
    hydrateSelectedSession(newSessionId);
    router.replace(`?session=${encodeURIComponent(newSessionId)}`, { scroll: false });
  }, [invalidateWorkspaceRestore, router, hydrateSelectedSession]);

  const handleInitialRestoreDone = useCallback(() => {
    setInitialSessionRestored(true);
  }, []);

  const handleSessionDeleted = useCallback((sessionId: string) => {
    invalidateWorkspaceRestore();
    setRefreshKey((k) => k + 1);
    if (selectedSession?.id === sessionId) {
      const cwd = selectedSession.cwd;
      const draftId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      setNewSessionDraftId(draftId);
      activeNewSessionDraftKeyRef.current = cwd ? `new:${draftId}:${cwd}` : null;
      setSelectedSession(null);
      setNewSessionCwd(cwd ?? null);
      setSessionKey((k) => k + 1);
      setBranchTree([]);
      setBranchActiveLeafId(null);
      setSystemPrompt(null);
      setSystemPromptLoading(false);
      setActiveTopPanel(null);
      router.replace("/", { scroll: false });
    }
  }, [invalidateWorkspaceRestore, selectedSession, router]);

  const handleOpenFile = useCallback((
    filePath: string,
    fileName: string,
    options?: { sourceSessionId?: string | null; modeHint?: "diff" },
  ) => {
    const sourceSessionId = options?.sourceSessionId;
    const modeHint = options?.modeHint;
    const tabId = `file:${filePath}`;
    setFileTabs((prev) => openFileTab(prev, {
      fileName,
      filePath,
      modeHint,
      sourceSessionId,
      tabId,
    }));
    setActiveFileTabId(tabId);
    if (!isEditorLayout) setRightPanelOpen(true);
    // On mobile the file panel is full-screen; close the drawer so it shows.
    if (isMobile) setSidebarOpen(false);
  }, [isEditorLayout, isMobile]);

  const handleOpenLinkedFile = useCallback((filePath: string) => {
    handleOpenFile(filePath, getFileName(filePath), { sourceSessionId: selectedSession?.id ?? null });
  }, [handleOpenFile, selectedSession?.id]);

  const handleCloseFileTab = useCallback((tabId: string) => {
    setFileTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0 && !isEditorLayout) setRightPanelOpen(false);
      return next;
    });
    setActiveFileTabId((cur) => {
      if (cur !== tabId) return cur;
      const remaining = fileTabs.filter((t) => t.id !== tabId);
      return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    });
  }, [fileTabs, isEditorLayout]);

  useEffect(() => {
    if (isMobile) return;
    if (layoutMode === "editor") setRightPanelOpen(true);
    else setRightPanelOpen(fileTabs.length > 0);
  }, [isMobile, layoutMode]);

  const handleViewFullHistory = useCallback(async () => {
    if (!selectedSession) return;
    const sessionId = selectedSession.id;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
      const data = await response.json() as {
        error?: string;
        filePath?: string;
        info?: { name?: string | null };
        context?: { messages?: AgentMessage[] };
      };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      openVirtualMarkdown(
        virtualDocPath("history", sessionId),
        translate("files.historyTab"),
        formatSessionHistoryMarkdown({
          sessionId,
          name: data.info?.name ?? selectedSession.name,
          filePath: data.filePath,
          messages: data.context?.messages ?? [],
        }),
      );
    } catch (error) {
      openVirtualMarkdown(
        virtualDocPath("history", sessionId),
        translate("files.historyTab"),
        formatSessionHistoryMarkdown({
          sessionId,
          name: selectedSession.name,
          messages: [],
        }) + `\n\n${translate("files.historyLoadFailed", { error: error instanceof Error ? error.message : String(error) })}`,
      );
    }
  }, [openVirtualMarkdown, selectedSession, translate]);

  // Show chat area if a session is selected, or if we have a cwd to start a new session in
  const effectiveNewSessionCwd = newSessionCwd ?? (selectedSession === null && activeCwd ? activeCwd : null);
  const newSessionDraftKey = selectedSession === null && effectiveNewSessionCwd
    ? `new:${newSessionDraftId}:${effectiveNewSessionCwd}`
    : null;
  useLayoutEffect(() => {
    activeNewSessionDraftKeyRef.current = newSessionDraftKey;
  }, [newSessionDraftKey]);
  const showChat = selectedSession !== null || effectiveNewSessionCwd !== null;

  /**
   * 打开分支面板；无活动会话或无线分叉时只 Toast，不画空下拉。
   * 已打开时再点一次则关闭。
   */
  const handleBranchesAction = useCallback((keepMobileToolbarOpen = false) => {
    if (activeTopPanel === "branches") {
      toggleTopPanel("branches", keepMobileToolbarOpen);
      return;
    }
    if (!showChat) {
      showToast({ message: translate("i18n.noActiveSession"), tone: "info" });
      return;
    }
    if (!sessionHasBranches(branchTree)) {
      showToast({ message: translate("i18n.noBranches"), tone: "info" });
      return;
    }
    toggleTopPanel("branches", keepMobileToolbarOpen);
  }, [activeTopPanel, branchTree, showChat, showToast, toggleTopPanel, translate]);

  const projectTrustCwd = selectedSession?.cwd ?? effectiveNewSessionCwd;
  // While restoring initial session from URL, don't show the placeholder
  const showPlaceholder = initialSessionRestored && !showChat;

  useEffect(() => {
    setProjectTrust(null);
    setProjectTrustDialogOpen(false);
    setProjectTrustError(null);
    if (!projectTrustCwd) return;

    const controller = new AbortController();
    fetch(`/api/project-trust?cwd=${encodeURIComponent(projectTrustCwd)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as ProjectTrustStatus & { error?: string };
        if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
        setProjectTrust(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to load project trust:", error);
      });
    return () => controller.abort();
  }, [projectTrustCwd]);

  const handleTrustProject = useCallback(async () => {
    if (!projectTrustCwd || projectTrustBusy) return;
    setProjectTrustBusy(true);
    setProjectTrustError(null);
    try {
      const response = await fetch("/api/project-trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: projectTrustCwd }),
      });
      const data = await response.json() as ProjectTrustStatus & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
      setProjectTrust(data);
      setProjectTrustDialogOpen(false);
      setModelsRefreshKey((key) => key + 1);
      setSessionKey((key) => key + 1);
    } catch (error) {
      setProjectTrustError(error instanceof Error ? error.message : String(error));
    } finally {
      setProjectTrustBusy(false);
    }
  }, [projectTrustBusy, projectTrustCwd]);

  const activeFileTab = fileTabs.find((tab) => tab.id === activeFileTabId) ?? null;
  const activeCwdName = activeCwd ? getFileName(activeCwd) || activeCwd : null;
  const windowTitle = activeCwdName ? `${activeCwdName} - Pi Web` : "Pi Web";

  useEffect(() => {
    const syncWindowTitle = () => {
      if (document.title !== windowTitle) document.title = windowTitle;
    };

    syncWindowTitle();
    const observer = new MutationObserver(syncWindowTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [windowTitle]);

  const sidebarContent = (
    <>
      <SessionSidebar
        selectedSessionId={selectedSession?.id ?? null}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        initialSessionId={initialSessionId}
        skipInitialProjectSelection={initialNavigation.requestedCwd !== null}
        onInitialRestoreDone={handleInitialRestoreDone}
        refreshKey={refreshKey}
        onSessionDeleted={handleSessionDeleted}
        selectedCwd={selectedSession?.cwd ?? newSessionCwd ?? null}
        onCwdChange={handleCwdChange}
        onOpenFile={handleOpenFile}
        explorerRefreshKey={explorerRefreshKey}
        onExplorerRefresh={handleExplorerRefresh}
        onAtMention={handleAtMention}
        onAtMentions={handleAtMentions}
        onBackgroundTaskDone={handleBackgroundTaskDone}
        onRunningSessionIdsChange={handleRunningSessionIdsChange}
        sessionListPortalTarget={isMobile ? null : sessionListHost}
        onToggleHistory={!isMobile ? toggleHistory : undefined}
        showHiddenFiles={showHiddenFiles}
      />
      <div style={{ padding: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            setSessionToolsMenuOpen(false);
            setActiveTopPanel(null);
            setSettingsOpen(true);
          }}
          title={translate("settings.open")}
          aria-label={translate("settings.open")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 6,
            height: 32,
            padding: "0 10px",
            background: settingsOpen ? "var(--bg-hover)" : "none",
            border: "none",
            borderRadius: 9,
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            transition: "background 0.12s, color 0.12s",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "var(--bg-hover)";
            event.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = settingsOpen ? "var(--bg-hover)" : "none";
            event.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
          </svg>
          {sidebarResizer.width >= SETTINGS_LABEL_MIN_WIDTH ? translate("settings.open") : null}
        </button>
      </div>
    </>
  );

  const renderProjectTrustWarning = (mobileBanner: boolean) => {
    if (!showChat || !projectTrust?.requiresTrust || projectTrust.trusted) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setProjectTrustError(null);
          setProjectTrustDialogOpen(true);
        }}
        title={translate("trust.resourcesNotLoaded")}
        aria-label={translate("trust.resourcesNotLoaded")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: mobileBanner ? "flex-start" : "center",
          gap: 6,
          width: mobileBanner ? "100%" : undefined,
          minHeight: mobileBanner ? 32 : undefined,
          height: mobileBanner ? undefined : "100%",
          padding: mobileBanner ? "6px 12px" : "0 12px",
          background: mobileBanner ? "color-mix(in srgb, #d97706 8%, var(--bg-panel))" : "none",
          border: "none",
          borderRight: mobileBanner ? "none" : "1px solid var(--border)",
          borderBottom: mobileBanner ? "1px solid var(--border)" : "none",
          color: "#d97706",
          cursor: "pointer",
          flexShrink: 0,
          fontSize: 11,
          lineHeight: 1.35,
          textAlign: "left",
        }}
        data-mobile-trust-banner={mobileBanner ? "true" : undefined}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <span>{translate("trust.resourcesNotLoaded")}</span>
      </button>
    );
  };

  const renderChatToolbarActions = (mobile: boolean) => {
    if (!mobile && !showChat) return null;
    return (
      <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        <button
          type="button"
          onClick={() => {
            void handleViewFullHistory();
            if (mobile) setMobileToolbarMoreOpen(true);
          }}
          disabled={!selectedSession}
          title={selectedSession ? translate("history.full") : translate("history.unsaved")}
          aria-label={translate("history.full")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: mobile ? TOP_BAR_ICON_BUTTON_SIZE : undefined,
            height: "100%",
            padding: mobile ? 0 : "0 12px",
            background: "none",
            border: "none",
            borderTop: "2px solid transparent",
            borderRight: "1px solid var(--border)",
            color: selectedSession ? "var(--text-muted)" : "var(--text-dim)",
            cursor: selectedSession ? "pointer" : "not-allowed",
            opacity: selectedSession ? 1 : 0.45,
            flexShrink: 0,
            fontSize: 11,
            whiteSpace: "nowrap",
            transition: "color 0.1s, background 0.1s, opacity 0.1s",
          }}
          onMouseEnter={(event) => {
            if (!selectedSession) return;
            event.currentTarget.style.color = "var(--text)";
            event.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = selectedSession ? "var(--text-muted)" : "var(--text-dim)";
            event.currentTarget.style.background = "none";
          }}
          data-mobile-toolbar-action={mobile ? "history" : undefined}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: selectedSession ? "var(--text-muted)" : "var(--text-dim)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
          {!mobile && <span>{translate("history.label")}</span>}
        </button>
        {(() => {
          // 上下文压缩后当前消息可能不再包含 user 消息，需同时参考会话文件的消息总数。
          const hasMessages = Boolean(
            selectedSession
            && ((sessionStats?.userMessages ?? 0) > 0 || selectedSession.messageCount > 0),
          );
          const naming = autoNameStatus.kind === "naming";
          const disabled = !selectedSession || selectedSession.transient || !hasMessages || naming;
          const label = translate("title.generate");
          const title = !selectedSession || selectedSession.transient
            ? translate("title.unsaved")
            : !hasMessages
              ? translate("title.noMessages")
              : translate("title.generateSession");

          return (
            <button
              type="button"
              onClick={() => {
                void handleAutoName();
                if (mobile) setMobileToolbarMoreOpen(true);
              }}
              disabled={disabled}
              title={title}
              aria-label={label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: mobile ? TOP_BAR_ICON_BUTTON_SIZE : undefined,
                height: "100%", padding: mobile ? 0 : "0 12px",
                background: "none", border: "none",
                borderTop: "2px solid transparent",
                borderRight: "1px solid var(--border)",
                color: naming ? "var(--text-dim)" : "var(--text-muted)",
                cursor: naming ? "not-allowed" : "pointer",
                opacity: naming ? 0.7 : 1,
                flexShrink: 0, fontSize: 11, whiteSpace: "nowrap",
                transition: "color 0.1s, background 0.1s, opacity 0.1s",
              }}
              onMouseEnter={(event) => {
                if (naming) return;
                event.currentTarget.style.color = "var(--text)";
                event.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = naming ? "var(--text-dim)" : "var(--text-muted)";
                event.currentTarget.style.background = "none";
              }}
              data-mobile-toolbar-action={mobile ? "name" : undefined}
            >
              {naming ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 4 5 5L7 22l-5-5Z" />
                  <path d="m14 5 5 5" />
                  <path d="M6 4V2M5 3H3M19 19v3M17.5 20.5h3" />
                </svg>
              )}
              {!mobile && <span>{label}</span>}
            </button>
          );
        })()}
        {mobile ? (
          <button
            type="button"
            onClick={() => handleBranchesAction(true)}
            title={translate("i18n.branches")}
            aria-label={translate("i18n.branches")}
            aria-pressed={activeTopPanel === "branches"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: TOP_BAR_ICON_BUTTON_SIZE, height: "100%", padding: 0,
              background: activeTopPanel === "branches" ? "var(--bg-selected)" : "none",
              border: "none",
              borderTop: activeTopPanel === "branches" ? "2px solid var(--accent)" : "2px solid transparent",
              borderRight: "1px solid var(--border)",
              color: activeTopPanel === "branches" ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer", flexShrink: 0,
            }}
            data-mobile-toolbar-action="branches"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: branchTree.length > 0 ? "var(--accent)" : "var(--text-dim)" }} aria-hidden="true">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
          </button>
        ) : (
          <BranchNavigator
            tree={branchTree}
            activeLeafId={branchActiveLeafId}
            onLeafChange={handleBranchLeafChange}
            inline
            containerRef={topBarRef}
            open={activeTopPanel === "branches"}
            onToggle={() => handleBranchesAction()}
            hasSession
          />
        )}
        <button
          type="button"
          onClick={() => { void handleOpenSystemPrompt(); }}
          disabled={mobile && !showChat}
          title={translate("system.prompt")}
          aria-label={translate("system.prompt")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: mobile ? TOP_BAR_ICON_BUTTON_SIZE : undefined,
            height: "100%", padding: mobile ? 0 : "0 12px",
            background: "none",
            border: "none",
            borderTop: "2px solid transparent",
            borderRight: "1px solid var(--border)",
            cursor: mobile && !showChat ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            opacity: mobile && !showChat ? 0.45 : 1,
            fontSize: 11, whiteSpace: "nowrap", transition: "color 0.1s, background 0.1s",
          }}
          onMouseEnter={(event) => {
            if (mobile && !showChat) return;
            event.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = "var(--text-muted)";
          }}
          data-mobile-toolbar-action={mobile ? "system" : undefined}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: systemPrompt ? "var(--accent)" : "var(--text-dim)", flexShrink: 0 }} aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="13" y2="17" />
          </svg>
          {!mobile && <span>{translate("system.label")}</span>}
        </button>
      </div>
    );
  };

  /**
   * 当前对话溢出菜单：完整历史 / 生成标题 / 分支 / 系统。
   * 挂在对话顶栏 ⋯ 上，不再占用文件页签行。
   */
  const renderSessionToolsButton = (iconButtonStyle: (active: boolean, enabled: boolean) => CSSProperties) => {
    if (!showChat) return null;

    const nameDisabled = autoNameStatus.kind === "naming";
    const menuItems: Array<{
      key: string;
      label: string;
      disabled?: boolean;
      onSelect: () => void;
    }> = [
      {
        key: "history",
        label: translate("history.label"),
        disabled: !selectedSession,
        onSelect: () => { void handleViewFullHistory(); },
      },
      {
        key: "title",
        label: translate("title.generate"),
        disabled: nameDisabled,
        onSelect: () => { void handleAutoName(); },
      },
      {
        key: "branches",
        label: translate("i18n.branches"),
        onSelect: () => handleBranchesAction(),
      },
      {
        key: "system",
        label: translate("system.label"),
        disabled: !selectedSession,
        onSelect: () => { void handleOpenSystemPrompt(); },
      },
    ];

    return (
      <div ref={sessionMenuRef} style={{ position: "relative", height: "100%", display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          data-workspace-session-tools=""
          onClick={() => {
            setActiveTopPanel(null);
            setSessionToolsMenuOpen((open) => !open);
          }}
          title={translate("chat.sessionActions")}
          aria-label={translate("chat.sessionActions")}
          aria-haspopup="menu"
          aria-expanded={sessionToolsMenuOpen}
          style={iconButtonStyle(sessionToolsMenuOpen, true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
        {sessionToolsMenuOpen && typeof document !== "undefined" && createPortal(
          <div
            ref={sessionMenuPanelRef}
            role="menu"
            aria-label={translate("chat.sessionActions")}
            style={{
              // 对话栏 overflow:hidden 会裁切绝对定位菜单，改挂到 body。
              position: "fixed",
              top: sessionMenuRef.current?.getBoundingClientRect().bottom ?? 0,
              right: typeof window === "undefined"
                ? 0
                : window.innerWidth - (sessionMenuRef.current?.getBoundingClientRect().right ?? 0),
              zIndex: 800,
              minWidth: 168,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
              padding: 4,
            }}
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setSessionToolsMenuOpen(false);
                  item.onSelect();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 10px",
                  border: "none",
                  borderRadius: 6,
                  background: "transparent",
                  color: item.disabled ? "var(--text-dim)" : "var(--text)",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  fontSize: 12,
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    );
  };

  const renderSessionStatsButton = (mobile: boolean) => {
    if (!mobile && (!showChat || (!sessionStats && !contextUsage))) return null;

    const tokens = sessionStats?.tokens;
    const cost = sessionStats?.cost ?? 0;
    const formatCompact = (value: number) => value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1000
        ? `${(value / 1000).toFixed(0)}k`
        : String(value);
    const costText = cost > 0 ? (cost >= 0.01 ? `$${cost.toFixed(2)}` : `<$0.01`) : null;

    let contextColor = "var(--text-muted)";
    let desktopContextText: string | null = null;
    let mobileContextText: string | null = null;
    if (contextUsage?.contextWindow) {
      const percent = contextUsage.percent;
      if (percent !== null && percent > 90) contextColor = "#ef4444";
      else if (percent !== null && percent > 70) contextColor = "rgba(234,179,8,0.95)";
      desktopContextText = percent !== null
        ? `${percent.toFixed(0)}% / ${formatCompact(contextUsage.contextWindow)}`
        : `? / ${formatCompact(contextUsage.contextWindow)}`;
      mobileContextText = percent !== null ? `${percent.toFixed(0)}%` : null;
    }

    const tooltipParts: string[] = [];
    if (tokens) {
      tooltipParts.push(`in: ${tokens.input.toLocaleString(locale)}`);
      tooltipParts.push(`out: ${tokens.output.toLocaleString(locale)}`);
      tooltipParts.push(`cache read: ${tokens.cacheRead.toLocaleString(locale)}`);
      tooltipParts.push(`cache write: ${tokens.cacheWrite.toLocaleString(locale)}`);
      if (cost > 0) tooltipParts.push(`cost: $${cost.toFixed(4)}`);
    }
    if (contextUsage?.contextWindow) {
      const percent = contextUsage.percent;
      tooltipParts.push(`context: ${percent !== null ? percent.toFixed(1) + "%" : "unknown"} of ${contextUsage.contextWindow.toLocaleString()} tokens`);
    }
    const tooltip = tooltipParts.join("  |  ");
    const covered = mobile && mobileToolbarMoreOpen;
    const hasMobileValues = Boolean(
      (tokens && (tokens.input > 0 || tokens.output > 0))
      || costText
      || mobileContextText,
    );

    return (
      <button
        type="button"
        onClick={() => toggleTopPanel("session")}
        disabled={!showChat || covered}
        tabIndex={covered ? -1 : undefined}
        title={tooltip || translate("session.title")}
        aria-label={translate("session.title")}
        aria-pressed={activeTopPanel === "session"}
        aria-hidden={covered ? true : undefined}
        className={mobile ? "mobile-session-stats" : undefined}
        data-mobile-toolbar-stats={mobile ? "true" : undefined}
        style={{
          marginLeft: mobile ? 0 : "auto",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          flex: mobile ? 1 : undefined,
          minWidth: 0,
          gap: mobile ? 7 : 10,
          paddingLeft: mobile ? 6 : 12,
          paddingRight: mobile ? 6 : 12,
          height: "100%",
          overflow: "hidden",
          visibility: covered ? "hidden" : "visible",
          pointerEvents: covered ? "none" : "auto",
          background: activeTopPanel === "session" ? "var(--bg-selected)" : "none",
          border: "none",
          borderTop: activeTopPanel === "session" ? "2px solid var(--accent)" : "2px solid transparent",
          fontSize: 11, color: "var(--text-muted)",
          whiteSpace: "nowrap", cursor: showChat ? "pointer" : "default",
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.1s, background 0.1s",
        }}
        onMouseEnter={(event) => {
          if (showChat && !covered) event.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.color = activeTopPanel === "session" ? "var(--text)" : "var(--text-muted)";
        }}
      >
        {mobile ? (
          <>
            {tokens && tokens.input > 0 && (
              <span className="mobile-session-stat-io" style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="8.5" x2="5" y2="1.5" /><polyline points="2 4 5 1.5 8 4" />
                </svg>
                {formatCompact(tokens.input)}
              </span>
            )}
            {tokens && tokens.output > 0 && (
              <span className="mobile-session-stat-io" style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="1.5" x2="5" y2="8.5" /><polyline points="2 6 5 8.5 8 6" />
                </svg>
                {formatCompact(tokens.output)}
              </span>
            )}
            {costText && (
              <span className="mobile-session-stat-cost" style={{ color: "var(--text)", fontWeight: 500, flexShrink: 0 }}>
                {costText}
              </span>
            )}
            {mobileContextText && (
              <span style={{ color: contextColor, flexShrink: 0 }}>
                {mobileContextText}
              </span>
            )}
            {!hasMobileValues && showChat && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-dim)" }}>
                {translate("session.title")}
              </span>
            )}
          </>
        ) : (
          <>
            {tokens && tokens.input > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="8.5" x2="5" y2="1.5" /><polyline points="2 4 5 1.5 8 4" />
                </svg>
                {formatCompact(tokens.input)}
              </span>
            )}
            {tokens && tokens.output > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="1.5" x2="5" y2="8.5" /><polyline points="2 6 5 8.5 8 6" />
                </svg>
                {formatCompact(tokens.output)}
              </span>
            )}
            {tokens && tokens.cacheRead > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8.5 5a3.5 3.5 0 1 1-1-2.45" /><polyline points="6.5 1.5 8.5 2.5 7.5 4.5" />
                </svg>
                {formatCompact(tokens.cacheRead)}
              </span>
            )}
            {costText && (
              <span style={{ display: "flex", alignItems: "center", color: "var(--text)", fontWeight: 500 }}>
                {costText}
              </span>
            )}
            {desktopContextText && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: contextColor }}>
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 9 L1 5 Q1 1 5 1 Q9 1 9 5 L9 9" /><line x1="1" y1="9" x2="9" y2="9" />
                </svg>
                {desktopContextText}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  const chatHeaderFirstMessage = selectedSession?.firstMessage?.trim() ?? "";
  const chatHeaderTitleFull = selectedSession?.name?.trim()
    || skillExpansionsToSidebarTitle(chatHeaderFirstMessage)
    || chatHeaderFirstMessage
    || translate("sidebar.new");

  /**
   * 对话标题栏左侧：会话名，空会话写「新对话」。不写「会话」二字。
   */
  const renderChatTitle = () => (
    <div
      data-workspace-chat-title=""
      title={chatHeaderTitleFull}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "0 12px",
        fontSize: 12,
        color: "var(--text)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: "36px",
      }}
    >
      {chatHeaderTitleFull}
    </div>
  );

  /**
   * 对话列自己的顶栏：+ 新建、⋯ 当前窗溢出；历史关着时才带列表键。
   * 只画在对话列顶，不横跨历史列（D27）。
   */
  const renderWorkspaceChatActions = (opts?: { pullRight?: boolean; includeTitle?: boolean; showHistoryToggle?: boolean }) => {
    const canStart = Boolean(activeCwd || selectedSession?.cwd);
    const includeTitle = opts?.includeTitle ?? true;
    const showHistoryToggle = opts?.showHistoryToggle ?? !agentHistoryOpen;
    const iconButtonStyle = (active: boolean, enabled: boolean): CSSProperties => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: TOP_BAR_ICON_BUTTON_SIZE,
      height: TOP_BAR_ICON_BUTTON_SIZE,
      padding: 0,
      background: active ? "var(--bg-selected)" : "none",
      border: "none",
      borderLeft: "1px solid var(--border)",
      color: enabled ? (active ? "var(--text)" : "var(--text-muted)") : "var(--text-dim)",
      cursor: enabled ? "pointer" : "not-allowed",
      flexShrink: 0,
      transition: "color 0.12s, background 0.12s",
    });
    const newChatLabel = translate("chat.newChatShortcut", {
      shortcut: translate("chat.newChatShortcutHint"),
    });

    return (
      <div
        data-workspace-chat-actions=""
        style={{
          display: "flex",
          alignItems: "stretch",
          flex: includeTitle ? 1 : undefined,
          minWidth: includeTitle ? 0 : undefined,
          flexShrink: includeTitle ? 1 : 0,
          marginLeft: opts?.pullRight ? "auto" : 0,
        }}
      >
        {includeTitle && renderChatTitle()}
        <button
          type="button"
          data-workspace-new-chat=""
          onClick={startNewConversation}
          disabled={!canStart}
          title={canStart ? newChatLabel : translate("sidebar.selectProject")}
          aria-label={canStart ? newChatLabel : translate("sidebar.selectProject")}
          style={iconButtonStyle(false, canStart)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        {renderSessionToolsButton(iconButtonStyle)}
        {showHistoryToggle && (
          <button
            type="button"
            data-workspace-chat-history=""
            onClick={toggleHistory}
            aria-pressed={agentHistoryOpen}
            title={translate(agentHistoryOpen ? "chat.hideHistory" : "chat.historyList")}
            aria-label={translate(agentHistoryOpen ? "chat.hideHistory" : "chat.historyList")}
            style={iconButtonStyle(agentHistoryOpen, true)}
          >
            {/* D2：列表用侧栏面板图，不用时钟。 */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const renderMainFileToggle = (mobile: boolean) => {
    const covered = mobile && mobileToolbarMoreOpen;
    return (
      <button
        type="button"
        onClick={handleRightPanelToggle}
        disabled={covered}
        tabIndex={covered ? -1 : undefined}
        aria-controls="file-panel"
        aria-expanded={rightPanelOpen}
        aria-hidden={covered ? true : undefined}
        title={rightPanelOpen
          ? translate(isEditorLayout ? "files.hideAgentPanel" : "files.hidePanel")
          : translate(isEditorLayout ? "files.showAgentPanel" : "files.showPanel")}
        aria-label={rightPanelOpen
          ? translate(isEditorLayout ? "files.hideAgentPanel" : "files.hidePanel")
          : translate(isEditorLayout ? "files.showAgentPanel" : "files.showPanel")}
        data-mobile-toolbar-file={mobile ? "true" : undefined}
        style={{
          marginLeft: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          width: TOP_BAR_ICON_BUTTON_SIZE, height: TOP_BAR_ICON_BUTTON_SIZE, padding: 0,
          visibility: covered ? "hidden" : "visible",
          pointerEvents: covered ? "none" : "auto",
          background: rightPanelOpen ? "var(--bg-selected)" : "none",
          border: "none", borderLeft: "1px solid var(--border)",
          color: rightPanelOpen ? "var(--text)" : "var(--text-muted)",
          cursor: "pointer", flexShrink: 0, transition: "color 0.12s, background 0.12s",
        }}
        onMouseEnter={(event) => { if (!covered) event.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(event) => { event.currentTarget.style.color = rightPanelOpen ? "var(--text)" : "var(--text-muted)"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
    );
  };

  /**
   * 编辑器桌面把页签并入中间主顶栏（与「会话」同行），避免再画一行 36px 空标题。
   * 助手/手机仍由文件列自己画页签头。
   */
  const mergeFileTabsIntoMainTopBar = isEditorLayout && !isMobile;

  /**
   * 文件页签 +（可选）收紧右侧。审阅按钮不进这一行，避免和导航抢位。
   */
  const renderFileTabStrip = (includeCollapse: boolean) => (
    <>
      <div
        data-file-tab-strip=""
        data-main-file-tabs={includeCollapse ? "" : undefined}
        style={{ flex: 1, overflow: "hidden", minWidth: 0, height: "100%" }}
      >
        <TabBar
          tabs={fileTabs}
          activeTabId={activeFileTabId ?? ""}
          onSelectTab={setActiveFileTabId}
          onCloseTab={handleCloseFileTab}
        />
      </div>
      {/* 栏关着时主顶栏出现新建 +，避免入口跟着对话栏一起消失。 */}
      {includeCollapse && !rightPanelOpen && (
        <button
          type="button"
          data-workspace-new-chat-collapsed=""
          onClick={startNewConversation}
          disabled={!Boolean(activeCwd || selectedSession?.cwd)}
          title={
            activeCwd || selectedSession?.cwd
              ? translate("chat.newChatShortcut", { shortcut: translate("chat.newChatShortcutHint") })
              : translate("sidebar.selectProject")
          }
          aria-label={
            activeCwd || selectedSession?.cwd
              ? translate("chat.newChatShortcut", { shortcut: translate("chat.newChatShortcutHint") })
              : translate("sidebar.selectProject")
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: TOP_BAR_ICON_BUTTON_SIZE,
            height: TOP_BAR_ICON_BUTTON_SIZE,
            padding: 0,
            background: "none",
            border: "none",
            borderLeft: "1px solid var(--border)",
            color: (activeCwd || selectedSession?.cwd) ? "var(--text-muted)" : "var(--text-dim)",
            cursor: (activeCwd || selectedSession?.cwd) ? "pointer" : "not-allowed",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
      {/* 收紧整块右侧对话栏（右轨图标，区别于对话栏列表键）。 */}
      {includeCollapse && (
        <div data-collapse-right-panel="">
          {renderMainFileToggle(false)}
        </div>
      )}
    </>
  );

  const fileWorkspace = (
    <div
      data-workspace="files"
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: "var(--bg)" }}
    >
      {/* Right panel tab bar */}
      {!mergeFileTabsIntoMainTopBar && (
        <div style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          height: "calc(36px + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
          background: "var(--bg-panel)",
          borderBottom: "1px solid var(--border)",
        }}>
          {renderFileTabStrip(false)}
        </div>
      )}
      <div
        data-toast-anchor=""
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Only the active viewer is mounted; tab state is restored via initialState. */}
        {activeFileTab?.filePath ? (
          <FileViewer
            key={`${activeFileTab.id}:${activeFileTab.viewerRevision ?? 0}`}
            filePath={activeFileTab.filePath}
            virtualContent={activeFileTab.virtualContent}
            cwd={activeCwd ?? undefined}
            sourceSessionId={activeFileTab.sourceSessionId}
            gitRefreshKey={explorerRefreshKey}
            initialDisplayMode={activeFileTab.initialDisplayMode}
            initialState={activeFileTab.viewerState}
            watchEnabled={isEditorLayout || rightPanelOpen}
            onStateChange={(viewerState) => handleFileViewerStateChange(
              activeFileTab.id,
              activeFileTab.viewerRevision ?? 0,
              viewerState,
            )}
            onMentionLines={(isEditorLayout || rightPanelOpen) && !isVirtualFilePath(activeFileTab.filePath) ? handleFileLineMention : undefined}
            onAtMention={isVirtualFilePath(activeFileTab.filePath) ? undefined : handleAtMention}
            onOpenFile={(filePath) => handleOpenFile(
              filePath,
              getFileName(filePath),
              { sourceSessionId: activeFileTab.sourceSessionId },
            )}
          />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 13, padding: 24, textAlign: "center" }}>
            {translate(isEditorLayout ? "workspace.emptyEditor" : "files.noneOpen")}
          </div>
        )}
      </div>
    </div>
  );

  const agentWorkspace = (
    <div
      data-workspace="agent"
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", minHeight: 0 }}>
        <div
          data-agent-column=""
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
            minHeight: 0,
          }}
        >
        {/* 顶栏只属于对话列，历史开着时不再横跨搜索栏（D27）。 */}
        {!isMobile && (
          <div
            data-agent-chrome=""
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              height: 36,
              background: "var(--bg-panel)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {renderWorkspaceChatActions({ showHistoryToggle: !agentHistoryOpen })}
          </div>
        )}
        <div style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          minWidth: 0,
          minHeight: 0,
        }}>
        {showChat ? (
          <ChatWindow
            key={sessionKey}
            session={selectedSession}
            sessionRunning={Boolean(selectedSession && runningSessionIds.has(selectedSession.id))}
            newSessionCwd={effectiveNewSessionCwd}
            newSessionDraftKey={newSessionDraftKey}
            onAgentEnd={handleAgentEnd}
            onAttentionNeeded={handleAttentionNeeded}
            onSessionCreated={handleSessionCreated}
            onSessionForked={handleSessionForked}
            modelsRefreshKey={modelsRefreshKey}
            chatInputRef={chatInputRef}
            onBranchDataChange={handleBranchDataChange}
            onComposerStatusChange={handleComposerStatusChange}
            onSystemPromptChange={handleSystemPromptChange}
            onSystemPromptLoaderChange={handleSystemPromptLoaderChange}
            onSessionStatsChange={handleSessionStatsChange}
            onSessionStatsPanelOpen={openSessionStatsPanel}
            onContextUsageChange={handleContextUsageChange}
            onOpenFile={handleOpenLinkedFile}
            soundEnabled={soundEnabled}
            onSoundToggle={onSoundToggle}
            playDoneSound={playDoneSound}
            unlockAudio={unlockAudio}
          />
        ) : initialCwdStatus === "validating" ? (
          <div
            role="status"
            style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, color: "var(--text-muted)", textAlign: "center" }}
          >
            <div style={{ fontSize: 14, color: "var(--text)" }}>{translate("workspace.opening")}</div>
            <div style={{ maxWidth: "min(720px, 100%)", overflowWrap: "anywhere", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {initialNavigation.requestedCwd}
            </div>
          </div>
        ) : initialCwdStatus === "error" ? (
          <div
            role="alert"
            style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, color: "var(--text-muted)", textAlign: "center" }}
          >
            <div style={{ fontSize: 14, color: "#dc2626" }}>{translate("workspace.unable")}</div>
            <div style={{ maxWidth: "min(720px, 100%)", overflowWrap: "anywhere", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {initialNavigation.requestedCwd}
            </div>
            <div style={{ maxWidth: 720, fontSize: 12 }}>{initialCwdError}</div>
          </div>
        ) : showPlaceholder ? (
          activeCwd ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 15 }}>
              {translate("workspace.selectSession")}
            </div>
          ) : (
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "flex-start", gap: 8, userSelect: "none", pointerEvents: "none" }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
                <line x1="20" y1="12" x2="4" y2="12" /><polyline points="10 6 4 12 10 18" />
              </svg>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{translate("workspace.getStarted")}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <span style={{ color: "var(--text-dim)", marginRight: 6 }}>1.</span>{translate("workspace.selectProject")}<br />
                  <span style={{ color: "var(--text-dim)", marginRight: 6 }}>2.</span>{translate("workspace.addModels")}
                </div>
              </div>
            </div>
          )
        ) : null}
      </div>
        </div>
        {!isMobile && agentHistoryOpen && (
          <div
            {...historyResizer.separatorProps}
            className={`panel-resize-handle history-resize-handle${historyResizer.isResizing ? " is-resizing" : ""}`}
            data-resize-handle="history"
            title={`${translate("layout.resizeHistory")}: ${translate("layout.resizeHint")}`}
          />
        )}
        {!isMobile && (
          <div
            ref={setHistoryDrawerRef}
            data-agent-history-drawer=""
            className={historyResizer.isResizing || rightPanelResizer.isResizing ? "history-drawer-resizing" : ""}
            data-agent-history-open={agentHistoryOpen ? "" : undefined}
            style={{
              // 列表在对话右侧：打开时聊天左移；编辑器下右栏总宽加上历史宽，从中间借空间。
              height: "100%",
              flexShrink: 0,
              overflow: "hidden",
              minHeight: 0,
              background: "var(--bg-panel)",
              borderLeft: agentHistoryOpen ? "1px solid var(--border)" : "none",
              transition: historyResizer.isResizing || rightPanelResizer.isResizing ? "none" : "width 0.2s ease",
              "--agent-history-width": `${historyResizer.width}px`,
            } as CSSProperties}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
    <style>{`
      @keyframes session-info-pop {
        0% {
          opacity: 0;
          transform: translateY(-24px);
          filter: blur(6px);
          box-shadow: 0 2px 8px rgba(0,0,0,0);
        }
        55% {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
          background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
          box-shadow: 0 18px 44px rgba(37,99,235,0.16);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
          background: var(--bg-panel);
          box-shadow: 0 10px 28px rgba(0,0,0,0.10);
        }
      }
      @keyframes session-info-light-wash {
        0% {
          opacity: 0;
          transform: translateX(-110%) skewX(-16deg);
        }
        24% {
          opacity: 0.42;
        }
        100% {
          opacity: 0;
          transform: translateX(115%) skewX(-16deg);
        }
      }
      .session-info-popover {
        position: relative;
        overflow: hidden;
        transform-origin: top right;
        animation: session-info-pop 360ms ease-out both;
        will-change: transform, opacity, filter, background, box-shadow;
      }
      .session-info-popover::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 44%;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 24%, transparent), transparent);
        animation: session-info-light-wash 620ms ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .session-info-popover,
        .session-info-popover::after {
          animation: none;
        }
      }
      .mobile-session-stats {
        container-type: inline-size;
      }
      @container (max-width: 158px) {
        .mobile-session-stat-io {
          display: none !important;
        }
      }
      @container (max-width: 88px) {
        .mobile-session-stat-cost {
          display: none !important;
        }
      }
      @media (max-width: 640px) {
        .sidebar-overlay-backdrop.sidebar-mobile-pending {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .sidebar-container.sidebar-mobile-pending.sidebar-open {
          transform: translateX(calc(-100% - env(safe-area-inset-left)));
          box-shadow: none;
        }
      }
    `}</style>
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "var(--app-viewport-height, 100dvh)",
      overflow: "hidden",
      background: "var(--bg)",
    }}>
    <div style={{
      display: "flex",
      flex: 1,
      minHeight: 0,
      width: "100%",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
      overflow: "hidden",
      background: "var(--bg)",
    }}>
      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay-backdrop${mobileSidebarReady ? "" : " sidebar-mobile-pending"}`}
        onClick={() => setSidebarOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 199,
          background: "rgba(0,0,0,0.4)",
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Left sidebar */}
      <div
        ref={sidebarResizer.panelRef}
        id="session-sidebar"
        className={`sidebar-container${sidebarOpen ? " sidebar-open" : " sidebar-closed"}${mobileSidebarReady ? "" : " sidebar-mobile-pending"}${sidebarResizer.isResizing ? " sidebar-resizing" : ""}`}
        style={{
          "--sidebar-width": `${sidebarResizer.width}px`,
          background: "var(--bg-panel)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 200,
        } as React.CSSProperties}
      >
        {sidebarContent}
      </div>
      {sidebarOpen && (
        <div
          {...sidebarResizer.separatorProps}
          aria-controls="session-sidebar"
          className={`panel-resize-handle sidebar-resize-handle${sidebarResizer.isResizing ? " is-resizing" : ""}`}
          data-resize-handle="sidebar"
          title={`${translate("layout.resizeSidebar")}: ${translate("layout.resizeHint")}`}
        />
      )}

      {/* Center: chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar with sidebar toggle */}
        <div ref={topBarRef} style={{ flexShrink: 0, background: "var(--bg-panel)" }}>
        <div style={{ display: "flex", alignItems: "center", position: "relative", borderBottom: "1px solid var(--border)", height: "calc(36px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}>
          <button
            onClick={handleSidebarToggle}
             title={sidebarOpen ? translate("sidebar.hide") : translate("sidebar.show")}
             aria-label={sidebarOpen ? translate("sidebar.hide") : translate("sidebar.show")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: TOP_BAR_ICON_BUTTON_SIZE, height: TOP_BAR_ICON_BUTTON_SIZE, padding: 0,
              background: "none", border: "none", borderRight: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "color 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {sidebarOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
          {isMobile && (
            <div
              ref={mobileToolbarRef}
              data-mobile-toolbar="true"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                flex: 1,
                minWidth: 0,
                height: "100%",
              }}
            >
              <button
                type="button"
                onClick={handleMobileToolbarMoreToggle}
                title={mobileToolbarMoreOpen ? translate("chat.close") : translate("chat.moreControls")}
                aria-label={mobileToolbarMoreOpen ? translate("chat.close") : translate("chat.moreControls")}
                aria-controls="mobile-toolbar-actions"
                aria-expanded={mobileToolbarMoreOpen}
                data-mobile-toolbar-more="true"
                style={{
                  position: "relative",
                  zIndex: mobileToolbarMoreOpen ? 21 : undefined,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: TOP_BAR_ICON_BUTTON_SIZE, height: TOP_BAR_ICON_BUTTON_SIZE, padding: 0,
                  background: mobileToolbarMoreOpen ? "var(--bg-selected)" : "none",
                  border: "none", borderRight: "1px solid var(--border)",
                  color: mobileToolbarMoreOpen ? "var(--text)" : "var(--text-muted)",
                  cursor: "pointer", flexShrink: 0, transition: "color 0.12s, background 0.12s",
                }}
              >
                {mobileToolbarMoreOpen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                  </svg>
                )}
              </button>
              {renderSessionStatsButton(true)}
              {renderMainFileToggle(true)}
              {mobileToolbarMoreOpen && (
                <div
                  id="mobile-toolbar-actions"
                  role="toolbar"
                  aria-label={translate("chat.moreControls")}
                  data-mobile-toolbar-actions="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: TOP_BAR_ICON_BUTTON_SIZE,
                    zIndex: 20,
                    display: "flex",
                    alignItems: "stretch",
                    background: "color-mix(in srgb, var(--bg-panel) 94%, var(--bg))",
                    boxShadow: "4px 0 18px rgba(0,0,0,0.12)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {renderChatToolbarActions(true)}
                </div>
              )}
            </div>
          )}
          {!isMobile && renderProjectTrustWarning(false)}
          {/* 编辑器：页签与收紧右侧并入本行；审阅按钮在文档底栏。「会话」假页签已移走。 */}
          {mergeFileTabsIntoMainTopBar && renderFileTabStrip(true)}
          {/* 助手：对话顶栏已挂在对话列；主顶栏只留收起文件列。 */}
          {!isMobile && !isEditorLayout && (
            <div data-workspace-chrome-end="" style={{ display: "flex", alignItems: "stretch", marginLeft: "auto" }}>
              {renderMainFileToggle(false)}
            </div>
          )}
          <BranchNavigator
            tree={branchTree}
            activeLeafId={branchActiveLeafId}
            onLeafChange={handleBranchLeafChange}
            inline
            compact={isMobile}
            containerRef={topBarRef}
            open={activeTopPanel === "branches"}
            onToggle={() => handleBranchesAction()}
            hasSession={showChat}
            hideInlineButton
          />
          {/* Top panel dropdown — shared, only one active at a time */}
          {activeTopPanel && topPanelPos && (
            <div style={{
              position: "fixed",
              top: topPanelPos.top,
              left: topPanelPos.left,
              width: topPanelPos.width,
              maxHeight: `calc(100dvh - ${topPanelPos.top}px)`,
              overflowY: "auto",
              zIndex: 500,
            }}>
              {activeTopPanel === "session" && (
                <div className="session-info-popover" style={{
                  background: "var(--bg-panel)",
                  borderBottom: "1px solid var(--border)",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
                  padding: "12px 16px",
                }}>
                  {sessionStats ? (() => {
                    const formatDuration = (ms: number) => {
                      if (ms <= 0) return "0s";
                      const totalSec = Math.floor(ms / 1000);
                      const h = Math.floor(totalSec / 3600);
                      const m = Math.floor((totalSec % 3600) / 60);
                      const s = totalSec % 60;
                      if (h > 0) return `${h}h ${m}m`;
                      if (m > 0) return `${m}m ${s}s`;
                      return `${s}s`;
                    };
                    const totalActiveMs = sessionStats.totalActiveMs ?? 0;
                    const sessionRows = [
                       ...(sessionStats.sessionName ? [{ label: translate("session.name"), value: sessionStats.sessionName, copyField: null }] : []),
                       { label: translate("session.file"), value: sessionStats.sessionFile ?? translate("session.inMemory"), copyField: "file" as const },
                       { label: translate("session.id"), value: sessionStats.sessionId, copyField: "id" as const },
                       ...(totalActiveMs > 0 ? [{ label: translate("session.totalActive"), value: formatDuration(totalActiveMs), copyField: null }] : []),
                    ];
                    const messageRows = [
                       [translate("session.user"), sessionStats.userMessages.toLocaleString(locale)],
                       [translate("session.assistant"), sessionStats.assistantMessages.toLocaleString(locale)],
                       [translate("session.toolCalls"), sessionStats.toolCalls.toLocaleString(locale)],
                       [translate("session.toolResults"), sessionStats.toolResults.toLocaleString(locale)],
                       [translate("session.total"), sessionStats.totalMessages.toLocaleString(locale)],
                    ];
                    const tokenRows = [
                       [translate("session.input"), sessionStats.tokens.input.toLocaleString(locale)],
                       [translate("session.output"), sessionStats.tokens.output.toLocaleString(locale)],
                       ...(sessionStats.tokens.cacheRead > 0 ? [[translate("session.cacheRead"), sessionStats.tokens.cacheRead.toLocaleString(locale)]] : []),
                       ...(sessionStats.tokens.cacheWrite > 0 ? [[translate("session.cacheWrite"), sessionStats.tokens.cacheWrite.toLocaleString(locale)]] : []),
                       [translate("session.total"), sessionStats.tokens.total.toLocaleString(locale)],
                    ];
                    const ctx = contextUsage ?? sessionStats.contextUsage;
                    const formatCompact = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                    const extraTokenRows = [
                       ...(sessionStats.cost > 0 ? [[translate("session.cost"), `$${sessionStats.cost.toFixed(4)}`]] : []),
                       ...(ctx?.contextWindow ? [[translate("session.context"), `${ctx.percent !== null ? `${ctx.percent.toFixed(1)}%` : "?"} / ${formatCompact(ctx.contextWindow)}`]] : []),
                       // Cache hit rate = cache reads / (input + cache writes + cache reads) — the denominator covers all input-class tokens.
                       ...(sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite > 0 && sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite + sessionStats.tokens.input > 0
                         ? [[translate("session.cacheHitRate"), `${(sessionStats.tokens.cacheRead / (sessionStats.tokens.cacheRead + sessionStats.tokens.cacheWrite + sessionStats.tokens.input) * 100).toFixed(1)}%`]]
                         : []),
                    ];
                    const section = (
                      title: string,
                      sectionRows: string[][],
                      valueAlign: "left" | "right" = "left",
                      compact = false,
                    ) => (
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{title}</div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: compact ? "max-content max-content" : "auto minmax(0, 1fr)",
                            columnGap: compact ? 14 : 12,
                            rowGap: 4,
                            justifyContent: compact ? "start" : undefined,
                          }}>
                            {sectionRows.map(([label, value]) => (
                              <div key={`${title}:${label}`} style={{ display: "contents" }}>
                                <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{label}</div>
                                <div style={{
                                  color: "var(--text-muted)",
                                  minWidth: 0,
                                  overflowWrap: compact ? "normal" : "anywhere",
                                  textAlign: valueAlign,
                                  whiteSpace: valueAlign === "right" ? "nowrap" : "normal",
                                }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    const copyButton = (field: SessionCopyField, value: string) => {
                      const copied = copiedSessionField === field;
                      return (
                        <button
                          type="button"
                           title={copied ? translate("session.copied") : translate(field === "file" ? "session.copyFile" : "session.copyId")}
                          onClick={() => handleCopySessionField(field, value)}
                          style={{
                            alignSelf: "start",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            marginTop: -2,
                            color: copied ? "var(--accent)" : "var(--text-dim)",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            cursor: "pointer",
                            flex: "0 0 auto",
                            transition: "color 0.12s, border-color 0.12s, background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--accent)";
                            e.currentTarget.style.borderColor = "var(--accent)";
                            e.currentTarget.style.background = "var(--bg-hover)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = copied ? "var(--accent)" : "var(--text-dim)";
                            e.currentTarget.style.borderColor = "var(--border)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          {copied ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      );
                    };
                    const sessionInfoSection = (
                      <div style={{ minWidth: 0 }}>
                         <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{translate("session.infoSection")}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", columnGap: 12, rowGap: 8, alignItems: "start" }}>
                          {sessionRows.map((row) => (
                            <div key={`session-info:${row.label}`} style={{ display: "contents" }}>
                              <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{row.label}</div>
                              <div style={{
                                color: "var(--text-muted)",
                                minWidth: 0,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>{row.value}</div>
                              <div>{row.copyField ? copyButton(row.copyField, row.value) : null}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );

                    return (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : "minmax(360px, 1.7fr) minmax(140px, 0.55fr) minmax(190px, 0.75fr)",
                        gap: isMobile ? 16 : 24,
                        fontSize: 12,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-mono)",
                      }}>
                        {sessionInfoSection}
                         {section(translate("session.messages"), messageRows)}
                         {section(translate("session.tokens"), [...tokenRows, ...extraTokenRows], "right", true)}
                      </div>
                    );
                  })() : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                       {translate("session.load")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
        {isMobile && renderProjectTrustWarning(true)}
        </div>

        {/* 主栏：编辑器放文件，助手放对话 */}
        {isEditorLayout ? fileWorkspace : agentWorkspace}
      </div>

      <div
        aria-hidden="true"
        className={`right-panel-overlay-backdrop${rightPanelOpen ? " is-open" : ""}`}
        onClick={() => setRightPanelOpen(false)}
      />
      {rightPanelOpen && (
        <div
          {...rightPanelResizer.separatorProps}
          aria-controls="file-panel"
          className={`panel-resize-handle right-panel-resize-handle${rightPanelResizer.isResizing ? " is-resizing" : ""}`}
          data-resize-handle="right-panel"
          title={`${translate("layout.resizeFilePanel")}: ${translate("layout.resizeHint")}`}
        />
      )}

      {/* 辅栏：编辑器放对话，助手放文件。始终挂载以便宽度动画与状态保留。 */}
      <div
        ref={rightPanelResizer.panelRef}
        id="file-panel"
        className={`right-panel-container${rightPanelOpen ? " right-panel-open" : " right-panel-closed"}${rightPanelResizer.isResizing || historyResizer.isResizing ? " right-panel-resizing" : ""}`}
        style={{
          "--right-panel-width": `${rightPanelResizer.width + (
            !isMobile && isEditorLayout && rightPanelOpen && agentHistoryOpen
              ? historyResizer.width
              : 0
          )}px`,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          background: "var(--bg)",
        } as React.CSSProperties}
      >
        {isEditorLayout ? agentWorkspace : fileWorkspace}
      </div>
    </div>
    <AppStatusBar
      soundEnabled={soundEnabled}
      onSoundToggle={onSoundToggle}
      toolPreset={statusToolPreset}
      onToolPresetChange={statusHasTool ? handleStatusToolPresetChange : undefined}
      toolPresetDisabled={statusToolDisabled}
      onCompact={statusHasCompact ? handleStatusCompact : undefined}
      onAbortCompaction={handleStatusAbortCompaction}
      isCompacting={statusCompacting}
      compactDisabled={statusCompactDisabled}
    />
    </div>
    {settingsOpen && (
      <SettingsDialog
        cwd={projectTrustCwd}
        sessionId={selectedSession?.id ?? null}
        soundEnabled={soundEnabled}
        onSoundToggle={onSoundToggle}
        onClose={() => {
          setSettingsOpen(false);
          setModelsRefreshKey((key) => key + 1);
        }}
        onModelsClosed={() => setModelsRefreshKey((key) => key + 1)}
        onPluginsReloaded={() => setSessionKey((key) => key + 1)}
      />
    )}
    {projectTrustDialogOpen && projectTrustCwd && (
      <ProjectTrustDialog
        cwd={projectTrustCwd}
        busy={projectTrustBusy}
        error={projectTrustError}
        onCancel={() => {
          if (!projectTrustBusy) setProjectTrustDialogOpen(false);
        }}
        onConfirm={() => void handleTrustProject()}
      />
    )}
    </>
  );
}
