import type { AgentMessage, AssistantContentBlock, TextContent } from "./types";

export interface SessionHistoryDocInput {
  sessionId: string;
  name?: string | null;
  filePath?: string;
  messages: AgentMessage[];
}

function isTextBlock(block: { type: string }): block is TextContent {
  return block.type === "text" && typeof (block as TextContent).text === "string";
}

/**
 * 从用户 / 工具结果等内容块抽出可读文本。
 */
export function extractMessageText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  return content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

function formatAssistantBlocks(blocks: AssistantContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text.trim()) parts.push(block.text.trim());
      continue;
    }
    if (block.type === "thinking") {
      const thinking = block.thinking?.trim();
      if (thinking) parts.push(`> ${thinking.replace(/\n/g, "\n> ")}`);
      continue;
    }
    if (block.type === "toolCall") {
      const name = block.toolName || "tool";
      parts.push(`\`\`\`\n${name}\n\`\`\``);
    }
  }
  return parts.join("\n\n");
}

function formatOneMessage(message: AgentMessage, index: number): string {
  if (message.role === "user") {
    const text = extractMessageText(message.content);
    return `## ${index}. 用户\n\n${text || "_(空)_"}`;
  }
  if (message.role === "assistant") {
    const body = formatAssistantBlocks(message.content);
    const model = message.model ? `（${message.provider}/${message.model}）` : "";
    return `## ${index}. 助手${model}\n\n${body || "_(空)_"}`;
  }
  if (message.role === "toolResult") {
    const text = extractMessageText(message.content);
    const name = message.toolName ? ` ${message.toolName}` : "";
    const err = message.isError ? "（错误）" : "";
    return `## ${index}. 工具结果${name}${err}\n\n${text || "_(空)_"}`;
  }
  if (message.role === "custom") {
    const text = extractMessageText(message.content);
    return `## ${index}. ${message.customType}\n\n${text || "_(空)_"}`;
  }
  const bash = message;
  return `## ${index}. 命令\n\n\`\`\`\n${bash.command}\n\`\`\`\n\n${bash.output || "_(无输出)_"}`;
}

/**
 * 把当前叶路径上的会话消息拼成虚拟 Markdown。
 */
export function formatSessionHistoryMarkdown(input: SessionHistoryDocInput): string {
  const header = [
    "# 完整历史",
    "",
    `- 会话 ID：\`${input.sessionId}\``,
    input.name ? `- 名称：${input.name}` : null,
    input.filePath ? `- 文件：\`${input.filePath}\`` : null,
    `- 消息数：${input.messages.length}`,
    "",
    "以下为当前分支上的对话，不是磁盘上的真实文件。",
    "",
  ].filter((line) => line !== null);

  if (input.messages.length === 0) {
    return [...header, "_暂无消息。_"].join("\n");
  }

  const body = input.messages.map((message, index) => formatOneMessage(message, index + 1));
  return [...header, ...body].join("\n\n");
}

