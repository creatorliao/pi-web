"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_LAYOUT_MODE,
  getLayoutModeSnapshot,
  subscribeLayoutMode,
  writeLayoutMode,
  type WorkspaceLayoutMode,
} from "@/lib/layout-mode";

const SERVER_SNAPSHOT: WorkspaceLayoutMode = DEFAULT_LAYOUT_MODE;

/**
 * 订阅工作区布局。设置页改值后 AppShell 立即换槽，不必刷新。
 */
export function useLayoutMode(): {
  layoutMode: WorkspaceLayoutMode;
  setLayoutMode: (mode: WorkspaceLayoutMode) => void;
} {
  const layoutMode = useSyncExternalStore(
    subscribeLayoutMode,
    getLayoutModeSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const setLayoutMode = useCallback((mode: WorkspaceLayoutMode) => {
    writeLayoutMode(mode);
  }, []);
  return { layoutMode, setLayoutMode };
}
