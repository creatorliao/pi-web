/**
 * 把内核拼好的系统提示拆成便于阅读的 Markdown 小节。
 * 标记来自 pi `buildSystemPrompt`：project_instructions / available_skills / cwd 行。
 */

export interface ProjectInstructionSection {
  path: string;
  fileName: string;
  content: string;
}

export interface SkillListItem {
  name: string;
  description: string;
  location: string;
}

export interface SystemPromptSections {
  /** 默认内核约定、自定义 prompt、append 拼在一起的前半段 */
  base: string;
  projectInstructions: ProjectInstructionSection[];
  skillsIntro: string;
  skills: SkillListItem[];
  cwd: string | null;
}

const PROJECT_CONTEXT_RE = /<project_context>\s*([\s\S]*?)<\/project_context>/;
const PROJECT_INSTRUCTION_RE = /<project_instructions path="([^"]+)">\n?([\s\S]*?)\n?<\/project_instructions>/g;
const SKILLS_BLOCK_RE = /(?:The following skills provide specialized instructions for specific tasks\.\nUse the read tool to load a skill's file when the task matches its description\.\nWhen a skill file references a relative path[\s\S]*?\n\n)?<available_skills>([\s\S]*?)<\/available_skills>/;
const SKILL_ITEM_RE = /<skill>\s*<name>([\s\S]*?)<\/name>\s*<description>([\s\S]*?)<\/description>\s*<location>([\s\S]*?)<\/location>\s*<\/skill>/g;
const CWD_RE = /\nCurrent working directory: (.+)\s*$/;

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

function fileNameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || filePath;
}

/**
 * 按内核拼接标记切开系统提示。解析失败时 base 为原文。
 */
export function splitSystemPrompt(raw: string): SystemPromptSections {
  let rest = raw;
  let cwd: string | null = null;
  const cwdMatch = rest.match(CWD_RE);
  if (cwdMatch) {
    cwd = cwdMatch[1]?.trim() ?? null;
    rest = rest.slice(0, cwdMatch.index);
  }

  const projectInstructions: ProjectInstructionSection[] = [];
  rest = rest.replace(PROJECT_CONTEXT_RE, (_all, inner: string) => {
    PROJECT_INSTRUCTION_RE.lastIndex = 0;
    let item: RegExpExecArray | null;
    while ((item = PROJECT_INSTRUCTION_RE.exec(inner)) !== null) {
      projectInstructions.push({
        path: item[1] ?? "",
        fileName: fileNameOf(item[1] ?? ""),
        content: (item[2] ?? "").replace(/\n$/, ""),
      });
    }
    return "";
  });

  let skillsIntro = "";
  const skills: SkillListItem[] = [];
  rest = rest.replace(SKILLS_BLOCK_RE, (all, inner: string) => {
    const introEnd = all.indexOf("<available_skills>");
    skillsIntro = introEnd > 0 ? all.slice(0, introEnd).trim() : "";
    SKILL_ITEM_RE.lastIndex = 0;
    let item: RegExpExecArray | null;
    while ((item = SKILL_ITEM_RE.exec(inner)) !== null) {
      skills.push({
        name: decodeXml(item[1] ?? ""),
        description: decodeXml(item[2] ?? ""),
        location: decodeXml(item[3] ?? ""),
      });
    }
    return "";
  });

  return {
    base: rest.replace(/\n{3,}/g, "\n\n").trim(),
    projectInstructions,
    skillsIntro,
    skills,
    cwd,
  };
}

function headingForProjectFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.startsWith("agents")) return `项目指令 · \`${fileName}\``;
  if (lower.startsWith("claude")) return `Claude 兼容指令 · \`${fileName}\``;
  return `项目指令 · \`${fileName}\``;
}

/**
 * 展示用 Markdown：按来源分节，不改变模型实际收到的拼接。
 */
export function formatSystemPromptView(prompt: string | null, sessionId: string): string {
  const header = [
    "# 系统提示词",
    "",
    `- 会话 ID：\`${sessionId}\``,
    "",
    "发给模型的是内核拼好的一整段。下面按来源拆开，方便对照 AGENTS.md、技能清单和内核约定。",
    "",
  ];

  if (prompt === null) return [...header, "_系统提示词尚未加载。_"].join("\n");
  if (prompt === "") return [...header, "_系统提示词为空（工具已禁用或尚未注入）。_"].join("\n");

  const sections = splitSystemPrompt(prompt);
  const parts = [...header];

  if (sections.base) {
    parts.push("## 内核与工具约定", "");
    parts.push("默认系统提示、自定义 prompt、扩展追加都在这一段（内核把它们放在项目文件之前）。", "");
    parts.push(sections.base, "");
  }

  for (const file of sections.projectInstructions) {
    parts.push(`## ${headingForProjectFile(file.fileName)}`, "");
    parts.push(`- 路径：\`${file.path}\``, "");
    parts.push("---", "");
    parts.push(file.content.trim() || "_（空文件）_", "");
    parts.push("---", "");
  }

  if (sections.skills.length > 0) {
    parts.push("## 可用技能", "");
    if (sections.skillsIntro) {
      parts.push(sections.skillsIntro, "");
    }
    parts.push("内核只把技能**目录**写进系统提示；SKILL.md 正文要模型自己用 read 打开。", "");
    for (const skill of sections.skills) {
      parts.push(`### \`${skill.name}\``, "");
      if (skill.description) parts.push(skill.description, "");
      parts.push(`- 位置：\`${skill.location}\``, "");
    }
  }

  if (sections.cwd) {
    parts.push("## 工作目录", "");
    parts.push(`\`${sections.cwd}\``, "");
  }

  return parts.join("\n");
}
