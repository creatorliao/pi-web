/**
 * 目录树默认对普通人隐藏点文件与构建/依赖目录。
 * 「显示隐藏文件」打开后原样列出。
 */

export const EXPLORER_SHOW_HIDDEN_STORAGE_KEY = "pi-explorer-show-hidden";

const HIDDEN_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  ".git",
]);

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

/** 点文件、点目录，以及常见构建产物目录，默认不出现在树里。 */
export function isExplorerEntryHidden(name: string): boolean {
  if (!name) return false;
  if (name.startsWith(".")) return true;
  return HIDDEN_DIRECTORY_NAMES.has(name);
}

export function filterExplorerEntries<T extends { name: string }>(
  entries: T[],
  showHidden: boolean,
): T[] {
  if (showHidden) return entries;
  return entries.filter((entry) => !isExplorerEntryHidden(entry.name));
}

export function readShowHiddenFiles(storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(EXPLORER_SHOW_HIDDEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeShowHiddenFiles(
  showHidden: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) {
    emit();
    return;
  }
  try {
    storage.setItem(EXPLORER_SHOW_HIDDEN_STORAGE_KEY, String(showHidden));
  } catch {
    // 与主题偏好相同：写失败不阻断本次切换。
  }
  emit();
}

export function subscribeShowHiddenFiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
