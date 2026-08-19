/**
 * Display-only restoration for the exact envelope emitted by pi's
 * `_expandSkillCommand`. The expanded text remains the stored session input.
 */
const SKILL_EXPANSION_RE = /^<skill name="([^"\n]+)" location="([^"\n]+)">\nReferences are relative to [^\n]+\.\n\n([\s\S]*)\n<\/skill>(?:\n\n([\s\S]+))?$/;

/** 信封头：与 SDK 展开字节同构，用于从左扫描多颗。 */
const ENVELOPE_HEAD_RE = /<skill name="([^"\n]+)" location="([^"\n]+)">\nReferences are relative to [^\n]+\.\n\n/g;

export interface ParsedSkillEnvelope {
  name: string;
  location: string;
  /** 含开闭标签的完整信封，下拉只渲染这一段 */
  text: string;
}

export interface ParsedSkillExpansions {
  envelopes: ParsedSkillEnvelope[];
  /** 全部信封之后的用户说明；不含前导空行 */
  prose: string;
}

/**
 * Restore a complete SDK skill expansion to its compact command form.
 *
 * The expression intentionally requires the opening envelope, matching
 * base-directory reference, final closing tag, and an optional two-newline args
 * suffix. This avoids collapsing ordinary text that merely starts with a
 * skill-looking tag. The greedy body capture makes the final closing tag win
 * when a skill body contains an example `</skill>` tag.
 */
export function skillExpansionToCommand(text: string): string | null {
  const match = text.match(SKILL_EXPANSION_RE);
  if (!match) return null;

  const [, name, , , args] = match;
  return args ? `/skill:${name} ${args}` : `/skill:${name}`;
}

/**
 * 解析 1～N 个连续信封 + 尾部散文。
 * 多信封时用「信封头」切段，末信封闭包仍取最后一个 `</skill>`（兼容正文样例标签）。
 */
export function parseSkillExpansions(text: string): ParsedSkillExpansions | null {
  if (!text.startsWith("<skill name=")) return null;

  const heads: Array<{ name: string; location: string; start: number }> = [];
  ENVELOPE_HEAD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENVELOPE_HEAD_RE.exec(text)) !== null) {
    heads.push({ name: match[1] ?? "", location: match[2] ?? "", start: match.index });
  }
  if (heads.length === 0 || heads[0].start !== 0) return null;

  const envelopes: ParsedSkillEnvelope[] = [];
  for (let index = 0; index < heads.length; index++) {
    const head = heads[index];
    const nextStart = index + 1 < heads.length ? heads[index + 1].start : text.length;
    let slice = text.slice(head.start, nextStart);
    if (index + 1 < heads.length) {
      if (!slice.endsWith("\n\n")) return null;
      slice = slice.slice(0, -2);
    } else {
      const close = "\n</skill>";
      const lastClose = slice.lastIndexOf(close);
      if (lastClose === -1) return null;
      const after = slice.slice(lastClose + close.length);
      if (after === "") {
        // 末信封后无散文
      } else if (after.startsWith("\n\n")) {
        slice = slice.slice(0, lastClose + close.length);
      } else {
        return null;
      }
    }
    if (!slice.startsWith("<skill name=") || !slice.endsWith("\n</skill>")) return null;
    envelopes.push({ name: head.name, location: head.location, text: slice });
  }

  let cursor = 0;
  for (let index = 0; index < envelopes.length; index++) {
    if (heads[index].start !== cursor) return null;
    cursor += envelopes[index].text.length;
    if (index < envelopes.length - 1) cursor += 2;
  }

  let prose = "";
  if (cursor < text.length) {
    if (!text.startsWith("\n\n", cursor)) return null;
    prose = text.slice(cursor + 2);
  }
  return { envelopes, prose };
}

/** 复制/回编：多颗还原为 `/skill:a /skill:b 说明`。 */
export function skillExpansionsToCompactCommand(text: string): string | null {
  const parsed = parseSkillExpansions(text);
  if (!parsed) return skillExpansionToCommand(text);
  const commands = parsed.envelopes.map((envelope) => `/skill:${envelope.name}`);
  const joined = commands.join(" ");
  return parsed.prose ? `${joined} ${parsed.prose}` : joined;
}

/**
 * 侧栏自动标题：多颗时用 `/skill:首颗 +N`，避免第二颗命令糊进 50 字截断。
 */
export function skillExpansionsToSidebarTitle(text: string): string | null {
  const parsed = parseSkillExpansions(text);
  if (!parsed) return skillExpansionToCommand(text);
  const first = `/skill:${parsed.envelopes[0].name}`;
  const extra = parsed.envelopes.length - 1;
  if (extra > 0) return `${first} +${extra}`;
  return parsed.prose ? `${first} ${parsed.prose}` : first;
}
