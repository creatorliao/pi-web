export function normalizeFilePathSlashes(filePath: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\")) {
    return filePath.replace(/\\/g, "/");
  }
  return filePath;
}

export function encodeFilePathForApi(filePath: string): string {
  return normalizeFilePathSlashes(filePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function getFileName(filePath: string): string {
  const normalized = normalizeFilePathSlashes(filePath).replace(/\/+$/, "");
  return normalized.split("/").pop() ?? normalized;
}

export function getFileDirectory(filePath: string): string {
  const normalized = normalizeFilePathSlashes(filePath).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash < 0) return "";
  if (lastSlash === 0) return "/";
  if (lastSlash === 2 && /^[a-zA-Z]:\//.test(normalized)) return normalized.slice(0, 3);
  return normalized.slice(0, lastSlash);
}

export function getRelativeFilePath(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;

  const normalizedFile = normalizeFilePathSlashes(filePath);
  const normalizedCwd = normalizeFilePathSlashes(cwd).replace(/\/$/, "");
  if (normalizedFile.startsWith(normalizedCwd + "/")) {
    return normalizedFile.slice(normalizedCwd.length + 1);
  }
  return filePath;
}

function isAbsoluteFilePath(filePath: string): boolean {
  const normalized = normalizeFilePathSlashes(filePath);
  if (normalized.startsWith("/") || normalized.startsWith("//")) return true;
  if (/^[a-zA-Z]:\//.test(normalized)) return true;
  if (normalized.startsWith("pi-virtual://")) return true;
  return false;
}

/**
 * 细栏用的完整路径：虚拟文档保留 URI，磁盘文件给出绝对路径。
 * 不再相对化到 cwd——根目录文件相对化后只剩文件名，和页签重复。
 */
export function getStatusBarFilePath(filePath: string, cwd?: string): string {
  const normalized = normalizeFilePathSlashes(filePath);
  if (isAbsoluteFilePath(normalized)) return normalized;
  if (cwd) return normalizeFilePathSlashes(joinFilePath(cwd, normalized));
  return normalized;
}

export function joinFilePath(parent: string, child: string): string {
  return `${normalizeFilePathSlashes(parent).replace(/\/$/, "")}/${child}`;
}
