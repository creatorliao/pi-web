"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  readShowHiddenFiles,
  subscribeShowHiddenFiles,
  writeShowHiddenFiles,
} from "@/lib/explorer-visibility";

/**
 * 目录树是否显示点文件与构建目录。默认关闭。
 */
export function useExplorerVisibility(): {
  showHiddenFiles: boolean;
  setShowHiddenFiles: (show: boolean) => void;
} {
  const showHiddenFiles = useSyncExternalStore(
    subscribeShowHiddenFiles,
    readShowHiddenFiles,
    () => false,
  );
  const setShowHiddenFiles = useCallback((show: boolean) => {
    writeShowHiddenFiles(show);
  }, []);
  return { showHiddenFiles, setShowHiddenFiles };
}
