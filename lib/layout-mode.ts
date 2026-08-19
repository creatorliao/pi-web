/**
 * 工作区布局：编辑器（中文件、右对话）与助手（中对话、右文件）。
 * 偏好写入 localStorage，设置页与 AppShell 共用同一份状态。
 */

export type WorkspaceLayoutMode = "editor" | "assistant";

export const LAYOUT_MODE_STORAGE_KEY = "pi-layout-mode";
export const DEFAULT_LAYOUT_MODE: WorkspaceLayoutMode = "editor";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const listeners = new Set<() => void>();

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** 非法值回落到编辑器布局，避免旧数据把壳层切到未知模式。 */
export function parseLayoutMode(value: string | null | undefined): WorkspaceLayoutMode {
  return value === "assistant" ? "assistant" : DEFAULT_LAYOUT_MODE;
}

export function readLayoutMode(storage: StorageLike | null = getBrowserStorage()): WorkspaceLayoutMode {
  if (!storage) return DEFAULT_LAYOUT_MODE;
  try {
    return parseLayoutMode(storage.getItem(LAYOUT_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_LAYOUT_MODE;
  }
}

export function writeLayoutMode(
  mode: WorkspaceLayoutMode,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) {
    emit();
    return;
  }
  try {
    storage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    // 隐私模式仍通知订阅者，只是下次刷新会丢偏好。
  }
  emit();
}

export function subscribeLayoutMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLayoutModeSnapshot(): WorkspaceLayoutMode {
  return readLayoutMode();
}
