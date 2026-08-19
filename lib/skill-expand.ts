import { readFileSync } from "fs";
import { stripFrontmatter } from "@earendil-works/pi-coding-agent";
import { parseClosedComposerTokens, removeComposerToken } from "./composer-tokens";

/**
 * 与 pi `_expandSkillCommand` 读盘所需字段对齐。
 * resourceLoader 运行时带 filePath / baseDir；本地类型不必改 pi-types。
 */
export interface ExpandableSkill {
  name: string;
  filePath: string;
  baseDir: string;
}

export interface ExpandAllSkillCommandsOptions {
  /** 单测注入；默认读磁盘，失败则该令牌当未知名留下。 */
  readSkillFile?: (filePath: string) => string;
}

/**
 * 生成与 SDK `_expandSkillCommand` 同构的信封（换行与字段顺序必须一致）。
 */
export function formatSkillEnvelope(
  skill: Pick<ExpandableSkill, "name" | "filePath" | "baseDir">,
  body: string,
): string {
  return `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
}

/**
 * 按 Composer 闭合 `/skill:name` 令牌从左到右展开全部已知技能。
 * 未知令牌留在剩余散文里；一个都展开不了则返回原文。
 */
export function expandAllSkillCommands(
  text: string,
  skills: readonly ExpandableSkill[],
  options?: ExpandAllSkillCommandsOptions,
): string {
  const skillTokens = parseClosedComposerTokens(text).filter((token) => token.kind === "skill");
  if (skillTokens.length === 0) return text;

  const byName = new Map<string, ExpandableSkill>();
  for (const skill of skills) {
    if (!byName.has(skill.name)) byName.set(skill.name, skill);
  }

  const readSkillFile = options?.readSkillFile ?? defaultReadSkillFile;
  const envelopes: string[] = [];
  const expandedRanges: Array<{ start: number; end: number }> = [];

  for (const token of skillTokens) {
    const skill = byName.get(token.label);
    if (!skill) continue;
    try {
      const content = readSkillFile(skill.filePath);
      const body = stripFrontmatter(content).trim();
      envelopes.push(formatSkillEnvelope(skill, body));
      expandedRanges.push({ start: token.start, end: token.end });
    } catch {
      // 读盘失败与 SDK 一样：该令牌当普通字留下，不中断其余展开。
    }
  }

  if (envelopes.length === 0) return text;

  let remaining = text;
  for (const range of [...expandedRanges].sort((a, b) => b.start - a.start)) {
    remaining = removeComposerToken(remaining, range);
  }
  remaining = remaining.trim();

  return remaining ? `${envelopes.join("\n\n")}\n\n${remaining}` : envelopes.join("\n\n");
}

function defaultReadSkillFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}
