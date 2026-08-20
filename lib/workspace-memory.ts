/**
 * Per-workspace "last open session" memory.
 *
 * Switching to a workspace (project root or cwd) restores the session the user
 * had open there last, instead of landing on a blank new-session page. Without
 * this, every workspace switch required re-picking the session by hand.
 *
 * The workspace key is the server-provided project identity when known, so
 * Windows path variants and all worktrees of one repo share one memory slot.
 * Transient and legacy session objects fall back to projectRoot/cwd.
 *
 * Stored in localStorage; best-effort (silently ignored when unavailable).
 */

const STORAGE_KEY = "pi-web:last-open-by-workspace";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readMap(storage: StorageLike): Record<string, string | undefined> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string | undefined>
      : {};
  } catch {
    return {};
  }
}

/** The remembered session id for a workspace, or null when none/stale. */
export function getLastOpenSession(
  workspaceKey: string,
  storage: StorageLike | null = getBrowserStorage(),
): string | null {
  if (!storage) return null;
  try {
    const id = readMap(storage)[workspaceKey];
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setLastOpenSession(
  workspaceKey: string,
  sessionId: string,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    const map = readMap(storage);
    map[workspaceKey] = sessionId;
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — memory is best-effort
  }
}

export function clearLastOpen(
  workspaceKey: string,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    const map = readMap(storage);
    if (!(workspaceKey in map)) return;
    delete map[workspaceKey];
    // Keep the store clean: drop the key entirely when nothing is remembered.
    if (Object.keys(map).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Workspace identity for a session: resolved project root when known, else cwd. */
export function workspaceKeyOf(session: {
  cwd: string;
  projectRoot?: string | null;
  projectKey?: string | null;
}): string {
  return session.projectKey ?? session.projectRoot ?? session.cwd;
}

export interface WorkspaceRestoreCandidate {
  id: string;
  cwd: string;
  modified: string;
  projectRoot?: string | null;
  projectKey?: string | null;
}

/**
 * 进入工作区时要打开哪一条对话。
 * 记忆仍在该工作区 → 用记忆；否则用 modified 最新；没有会话 → null（空输入态）。
 * 「没有」指磁盘上没有历史，不是浏览器没记住。
 */
/**
 * 侧栏未加载完时可能用 cwd/projectRoot 当 key，会话上却是稳定 projectKey。
 * 两种写法都算同一个工作区，否则有历史也会被当成空。
 */
export function sessionBelongsToWorkspace(
  session: WorkspaceRestoreCandidate,
  workspaceKey: string,
): boolean {
  if (!workspaceKey) return false;
  // 不用 Node path：本文件跑在浏览器里。欢迎页用稳定 key，侧栏可能先报 cwd/root。
  return workspaceKeyOf(session) === workspaceKey
    || session.projectKey === workspaceKey
    || session.projectRoot === workspaceKey
    || session.cwd === workspaceKey;
}

export function pickWorkspaceSessionToRestore<T extends WorkspaceRestoreCandidate>(
  sessions: T[],
  projectKey: string,
  rememberedId: string | null,
): T | null {
  const inWorkspace = sessions.filter((session) => sessionBelongsToWorkspace(session, projectKey));
  if (inWorkspace.length === 0) return null;
  if (rememberedId) {
    const remembered = inWorkspace.find((session) => session.id === rememberedId);
    if (remembered) return remembered;
  }
  return inWorkspace.reduce((latest, session) => (
    session.modified.localeCompare(latest.modified) > 0 ? session : latest
  ));
}
