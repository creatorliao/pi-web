import { displayCwd } from "./display-cwd";
import { getFileName } from "./file-paths";
import type { SessionInfo } from "./types";
import { workspaceKeyOf } from "./workspace-memory";

/** 欢迎卡 / 切换器共用的最近项目展示行。 */
export interface WorkspaceCard {
  key: string;
  root: string;
  name: string;
  shortPath: string;
  sessionCount: number;
  lastModified: string;
}

export interface RecentProject {
  /** Stable server-provided identity used for comparison and Map keys. */
  key: string;
  /** Original project path used for display and filesystem operations. */
  root: string;
}

/** Projects sorted by most recent activity and deduplicated by stable key. */
export function getRecentProjects(sessions: readonly SessionInfo[]): RecentProject[] {
  const latestByProject = new Map<string, { root: string; modified: string }>();
  for (const session of sessions) {
    const root = session.projectRoot ?? session.cwd;
    if (!root) continue;
    const key = workspaceKeyOf(session);
    const previous = latestByProject.get(key);
    if (!previous || session.modified > previous.modified) {
      latestByProject.set(key, { root, modified: session.modified });
    }
  }
  return [...latestByProject.entries()]
    .sort((a, b) => b[1].modified.localeCompare(a[1].modified))
    .map(([key, { root }]) => ({ key, root }));
}

export function getProjectActivity(
  sessions: readonly SessionInfo[],
  runningSessionIds: ReadonlySet<string>,
  unreadSessionIds: ReadonlySet<string>,
): Map<string, { running: number; unread: number }> {
  const counts = new Map<string, { running: number; unread: number }>();
  for (const session of sessions) {
    const key = workspaceKeyOf(session);
    if (!key) continue;
    let entry = counts.get(key);
    if (!entry) {
      entry = { running: 0, unread: 0 };
      counts.set(key, entry);
    }
    if (runningSessionIds.has(session.id)) entry.running++;
    if (unreadSessionIds.has(session.id)) entry.unread++;
  }
  return counts;
}

export function sessionsForProject(
  sessions: readonly SessionInfo[],
  projectKey: string,
): SessionInfo[] {
  return sessions.filter((session) => workspaceKeyOf(session) === projectKey);
}

/**
 * 把 getRecentProjects 顺序转成卡片字段；不另排。
 * lastModified 取该项目会话 modified 最大值。
 */
export function toWorkspaceCards(
  sessions: readonly SessionInfo[],
  homeDir?: string,
): WorkspaceCard[] {
  return getRecentProjects(sessions).map((project) => {
    const projectSessions = sessionsForProject(sessions, project.key);
    let lastModified = "";
    for (const session of projectSessions) {
      if (!lastModified || session.modified > lastModified) lastModified = session.modified;
    }
    return {
      key: project.key,
      root: project.root,
      name: getFileName(project.root) || project.root,
      shortPath: displayCwd(project.root, homeDir),
      sessionCount: projectSessions.length,
      lastModified,
    };
  });
}
