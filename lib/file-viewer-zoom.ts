/**
 * 文件区正文的字号档位。只服务细栏 A− / A+，不进设置页（一套入口）。
 */

export const FILE_VIEWER_ZOOM_STORAGE_KEY = "pi-web:file-viewer-zoom";
export const FILE_VIEWER_FONT_SIZES = [12, 13, 14, 16, 18] as const;
export const DEFAULT_FILE_VIEWER_FONT_SIZE = 13;

export type FileViewerFontSize = (typeof FILE_VIEWER_FONT_SIZES)[number];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isFileViewerFontSize(value: number): value is FileViewerFontSize {
  return (FILE_VIEWER_FONT_SIZES as readonly number[]).includes(value);
}

export function parseFileViewerFontSize(value: string | null): FileViewerFontSize {
  const parsed = Number(value);
  return isFileViewerFontSize(parsed) ? parsed : DEFAULT_FILE_VIEWER_FONT_SIZE;
}

export function readFileViewerFontSize(
  storage: StorageLike | null = getBrowserStorage(),
): FileViewerFontSize {
  if (!storage) return DEFAULT_FILE_VIEWER_FONT_SIZE;
  try {
    return parseFileViewerFontSize(storage.getItem(FILE_VIEWER_ZOOM_STORAGE_KEY));
  } catch {
    return DEFAULT_FILE_VIEWER_FONT_SIZE;
  }
}

export function writeFileViewerFontSize(
  fontSize: FileViewerFontSize,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(FILE_VIEWER_ZOOM_STORAGE_KEY, String(fontSize));
  } catch {
    // 存储不可用时字号只作用于当前页
  }
}

export function stepFileViewerFontSize(
  current: number,
  direction: 1 | -1,
): FileViewerFontSize {
  const index = FILE_VIEWER_FONT_SIZES.indexOf(
    isFileViewerFontSize(current) ? current : DEFAULT_FILE_VIEWER_FONT_SIZE,
  );
  const nextIndex = Math.min(
    FILE_VIEWER_FONT_SIZES.length - 1,
    Math.max(0, index + direction),
  );
  return FILE_VIEWER_FONT_SIZES[nextIndex];
}
