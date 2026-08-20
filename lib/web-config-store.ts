import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";

/** Pi Web 壳配置：跟人走的 agent 目录，TUI 不读。 */
export const WEB_CONFIG_FILE = "web.json";

export interface WorkspaceMark {
  key: string;
  at: string;
}

export interface WebWorkspaces {
  starred: WorkspaceMark[];
  hidden: WorkspaceMark[];
}

export interface WebConfig {
  version: number;
  workspaces: WebWorkspaces;
}

export type WebConfigAction =
  | { action: "star"; key: string }
  | { action: "unstar"; key: string }
  | { action: "hide"; key: string }
  | { action: "unhide"; key: string }
  | { action: "resetHidden" };

export interface WebConfigReadResult {
  config: WebConfig;
  /** 文件损坏时为 false：GET 仍给空配置，PATCH 不得覆盖原文件。 */
  writable: boolean;
}

function emptyConfig(): WebConfig {
  return { version: 1, workspaces: { starred: [], hidden: [] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMarks(value: unknown): WorkspaceMark[] {
  if (!Array.isArray(value)) return [];
  const marks: WorkspaceMark[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      marks.push({ key: item, at: new Date(0).toISOString() });
      continue;
    }
    if (!isRecord(item) || typeof item.key !== "string" || !item.key.trim()) continue;
    marks.push({
      key: item.key,
      at: typeof item.at === "string" && item.at ? item.at : new Date(0).toISOString(),
    });
  }
  return marks;
}

/** 抽出 workspaces，其余顶层键原样保留以便写回。 */
export function parseWebConfigDocument(raw: unknown): { config: WebConfig; extras: Record<string, unknown> } {
  if (!isRecord(raw)) return { config: emptyConfig(), extras: {} };
  const extras = { ...raw };
  delete extras.version;
  delete extras.workspaces;
  const workspaces = isRecord(raw.workspaces) ? raw.workspaces : {};
  const version = typeof raw.version === "number" && Number.isFinite(raw.version) ? raw.version : 1;
  return {
    config: {
      version,
      workspaces: {
        starred: parseMarks(workspaces.starred),
        hidden: parseMarks(workspaces.hidden),
      },
    },
    extras,
  };
}

export function getWebConfigPath(agentDir = getAgentDir()): string {
  return join(agentDir, WEB_CONFIG_FILE);
}

export function readWebConfig(configPath = getWebConfigPath()): WebConfigReadResult {
  if (!existsSync(configPath)) return { config: emptyConfig(), writable: true };
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
    return { config: parseWebConfigDocument(parsed).config, writable: true };
  } catch {
    return { config: emptyConfig(), writable: false };
  }
}

function upsertMark(list: WorkspaceMark[], key: string, at: string): WorkspaceMark[] {
  if (list.some((item) => item.key === key)) return list;
  return [...list, { key, at }];
}

function removeMark(list: WorkspaceMark[], key: string): WorkspaceMark[] {
  return list.filter((item) => item.key !== key);
}

/** 纯函数：方便单测。星标与隐藏互斥时以动作为准（隐藏则去掉星标）。 */
export function applyWebConfigAction(config: WebConfig, patch: WebConfigAction, now = new Date()): WebConfig {
  const at = now.toISOString();
  const starred = [...config.workspaces.starred];
  const hidden = [...config.workspaces.hidden];
  switch (patch.action) {
    case "star":
      return {
        ...config,
        workspaces: {
          starred: upsertMark(removeMark(starred, patch.key), patch.key, at),
          hidden: removeMark(hidden, patch.key),
        },
      };
    case "unstar":
      return { ...config, workspaces: { starred: removeMark(starred, patch.key), hidden } };
    case "hide":
      return {
        ...config,
        workspaces: {
          starred: removeMark(starred, patch.key),
          hidden: upsertMark(removeMark(hidden, patch.key), patch.key, at),
        },
      };
    case "unhide":
      return { ...config, workspaces: { starred, hidden: removeMark(hidden, patch.key) } };
    case "resetHidden":
      return { ...config, workspaces: { starred, hidden: [] } };
    default:
      return config;
  }
}

export function writeWebConfig(
  config: WebConfig,
  extras: Record<string, unknown> = {},
  configPath = getWebConfigPath(),
): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const document = {
    ...extras,
    version: config.version,
    workspaces: config.workspaces,
  };
  writePrivateFileAtomicSync(configPath, `${JSON.stringify(document, null, 2)}\n`);
}

export function patchWebConfig(
  patch: WebConfigAction,
  configPath = getWebConfigPath(),
): { config: WebConfig; writable: boolean } {
  const existingRaw = existsSync(configPath)
    ? (() => {
      try {
        return JSON.parse(readFileSync(configPath, "utf8")) as unknown;
      } catch {
        return null;
      }
    })()
    : {};
  if (existingRaw === null) return { config: emptyConfig(), writable: false };

  const { config, extras } = parseWebConfigDocument(existingRaw);
  const next = applyWebConfigAction(config, patch);
  writeWebConfig(next, extras, configPath);
  return { config: next, writable: true };
}
