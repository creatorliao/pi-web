import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { formatSystemPromptView, splitSystemPrompt } = await import("./system-prompt-view.ts");

const SAMPLE = `You are an expert coding assistant operating inside pi.

Available tools:
- read: Read files

Guidelines:
- Be concise

<project_context>

Project-specific instructions and guidelines:

<project_instructions path="D:\\\\code\\\\pi-web\\\\AGENTS.md">
# Pi Web notes
Never run next build.
</project_instructions>

<project_instructions path="C:\\\\Users\\\\me\\\\.pi\\\\agent\\\\AGENTS.md">
Global agents file.
</project_instructions>

</project_context>


The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>docx</name>
    <description>Word documents</description>
    <location>C:\\\\skills\\\\docx\\\\SKILL.md</location>
  </skill>
</available_skills>
Current working directory: D:/code/pi-web
`;

describe("system-prompt-view", () => {
  it("splits project files, skills, and cwd from the assembled prompt", () => {
    const sections = splitSystemPrompt(SAMPLE);
    assert.match(sections.base, /expert coding assistant/);
    assert.equal(sections.projectInstructions.length, 2);
    assert.equal(sections.projectInstructions[0].fileName, "AGENTS.md");
    assert.match(sections.projectInstructions[0].content, /Never run next build/);
    assert.equal(sections.skills.length, 1);
    assert.equal(sections.skills[0].name, "docx");
    assert.match(sections.skills[0].location, /SKILL\.md/);
    assert.equal(sections.cwd, "D:/code/pi-web");
  });

  it("renders distinct markdown headings per source", () => {
    const md = formatSystemPromptView(SAMPLE, "sid-1");
    assert.match(md, /^# 系统提示词/m);
    assert.match(md, /## 内核与工具约定/);
    assert.match(md, /## 项目指令 · `AGENTS\.md`/);
    assert.match(md, /## 可用技能/);
    assert.match(md, /### `docx`/);
    assert.match(md, /## 工作目录/);
    assert.doesNotMatch(md, /```text/);
  });
});
