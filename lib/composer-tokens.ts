/**
 * 把输入框文本拆成普通字与结构化 token（技能 / 斜杠命令 / @ 上下文）。
 * 只做展示与芯片删除，不改发送给 pi 的原文契约。
 */

export type ComposerTokenKind = "text" | "skill" | "slash" | "mention";

export interface ComposerSegment {
  kind: ComposerTokenKind;
  text: string;
  /** 在原文中的起点；text 段也可有 */
  start: number;
  end: number;
}

export interface ClosedComposerToken {
  kind: Exclude<ComposerTokenKind, "text">;
  raw: string;
  label: string;
  start: number;
  end: number;
}

/** 高亮用：未闭合的 @ / / 也着色，便于边打边认。 */
const OPEN_TOKEN_RE = /(^|[\s])(\/skill:[^\s]*|\/[A-Za-z][\w:.-]*|@"[^"\n]*"?|@[^\s@]*)/g;

/** 芯片用：后面跟空白或文末，才算一颗可删的完整引用。 */
const CLOSED_TOKEN_RE = /(^|[\s])(\/skill:[^\s]+|\/[A-Za-z][\w:.-]+|@"[^"\n]+"|@[^\s@]+)(?=\s|$)/g;

function classifyToken(raw: string): Exclude<ComposerTokenKind, "text"> {
  if (raw.startsWith("/skill:")) return "skill";
  if (raw.startsWith("/")) return "slash";
  return "mention";
}

function tokenLabel(kind: Exclude<ComposerTokenKind, "text">, raw: string): string {
  if (kind === "skill") return raw.slice("/skill:".length) || raw;
  if (kind === "slash") return raw.slice(1);
  if (raw.startsWith("@\"")) return raw.slice(2, raw.endsWith("\"") ? -1 : undefined);
  return raw.slice(1);
}

/**
 * 从左到右切开文本。前导空白归 text，token 单独成段。
 */
export function tokenizeComposer(text: string): ComposerSegment[] {
  const segments: ComposerSegment[] = [];
  let cursor = 0;
  OPEN_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_TOKEN_RE.exec(text)) !== null) {
    const lead = match[1] ?? "";
    const raw = match[2] ?? "";
    if (!raw) continue;
    const tokenStart = match.index + lead.length;
    if (tokenStart < cursor) continue;
    if (tokenStart > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, tokenStart), start: cursor, end: tokenStart });
    }
    const kind = classifyToken(raw);
    segments.push({ kind, text: raw, start: tokenStart, end: tokenStart + raw.length });
    cursor = tokenStart + raw.length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor), start: cursor, end: text.length });
  }
  return segments;
}

/** 已闭合、可做成芯片的引用（可同时多颗技能 + 多颗 @）。 */
export function parseClosedComposerTokens(text: string): ClosedComposerToken[] {
  const tokens: ClosedComposerToken[] = [];
  CLOSED_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLOSED_TOKEN_RE.exec(text)) !== null) {
    const lead = match[1] ?? "";
    const raw = match[2] ?? "";
    if (!raw) continue;
    const start = match.index + lead.length;
    const kind = classifyToken(raw);
    tokens.push({
      kind,
      raw,
      label: tokenLabel(kind, raw),
      start,
      end: start + raw.length,
    });
  }
  return tokens;
}

export interface SlashQueryMatch {
  /** 当前 `/` 在全文中的下标 */
  start: number;
  /** `/` 之后、光标之前的过滤字（不含空白） */
  query: string;
}

/**
 * 光标前是否有一段未闭合的斜杠命令。规则对齐 `@`：行首或空白后的 `/`，
 * `foo/bar` 不触发。查询里一旦出现空白即视为已闭合。
 */
export function extractSlashQuery(textBeforeCursor: string): SlashQueryMatch | null {
  const match = /(?:^|[\s])\/([^\s]*)$/.exec(textBeforeCursor);
  if (!match) return null;
  const query = match[1] ?? "";
  return {
    start: textBeforeCursor.length - query.length - 1,
    query,
  };
}

/**
 * 只替换当前 `/查询`，保留前后文，并在命令后留一格给后续指令。
 */
export function applySlashInsertion(
  text: string,
  caret: number,
  slashStart: number,
  commandName: string,
): { value: string; cursor: number } {
  const before = text.slice(0, slashStart);
  let after = text.slice(Math.max(caret, slashStart));
  const insert = `/${commandName} `;
  // 插入串已带尾空格，避免和原文空格叠成双空格。
  if (after.startsWith(" ")) after = after.slice(1);
  return {
    value: `${before}${insert}${after}`,
    cursor: before.length + insert.length,
  };
}

/**
 * 从原文去掉一颗闭合 token 及其后多余空格，避免芯片删除后留下双空格。
 */
export function removeComposerToken(text: string, token: Pick<ClosedComposerToken, "start" | "end">): string {
  const before = text.slice(0, token.start);
  let after = text.slice(token.end);
  after = after.replace(/^[ \t]+/, (spaces) => (spaces.length > 1 ? " " : ""));
  if (before.endsWith(" ") && after.startsWith(" ")) after = after.slice(1);
  return `${before}${after}`;
}
