import { statSync } from "node:fs";
import type { SessionInfo } from "./types";

/** 该路径此刻是否仍是本机上的目录（文件或已删都不算）。 */
export function isExistingDirectory(path: string): boolean {
  if (!path) return false;
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 按「项目根或 cwd」给会话标 directoryExists。
 * 同一路径只 stat 一次，避免列表里几十条会话打同一块盘。
 */
export function annotateSessionDirectoryExists(
  sessions: readonly SessionInfo[],
): SessionInfo[] {
  const cache = new Map<string, boolean>();
  const exists = (path: string): boolean => {
    const hit = cache.get(path);
    if (hit !== undefined) return hit;
    const value = isExistingDirectory(path);
    cache.set(path, value);
    return value;
  };
  return sessions.map((session) => {
    const root = session.projectRoot ?? session.cwd;
    return { ...session, directoryExists: exists(root) };
  });
}
