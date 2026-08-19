import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { expandAllSkillCommands, formatSkillEnvelope } = await jiti.import("./skill-expand.ts");
const { skillExpansionToCommand } = await jiti.import("./slash-display.ts");

const files = {
  "/skills/review/SKILL.md": "---\nname: review\n---\n\nReview the supplied files.\n",
  "/skills/docx/SKILL.md": "Docx skill body.",
  "/skills/a/SKILL.md": "Body A",
  "/skills/b/SKILL.md": "Body B",
  "/skills/c/SKILL.md": "Body C",
};

const catalog = [
  { name: "review", filePath: "/skills/review/SKILL.md", baseDir: "/skills/review" },
  { name: "docx", filePath: "/skills/docx/SKILL.md", baseDir: "/skills/docx" },
  { name: "a", filePath: "/skills/a/SKILL.md", baseDir: "/skills/a" },
  { name: "b", filePath: "/skills/b/SKILL.md", baseDir: "/skills/b" },
  { name: "c", filePath: "/skills/c/SKILL.md", baseDir: "/skills/c" },
];

function expand(text) {
  return expandAllSkillCommands(text, catalog, {
    readSkillFile: (filePath) => {
      const body = files[filePath];
      if (body === undefined) throw new Error(`missing ${filePath}`);
      return body;
    },
  });
}

test("single skill plus args matches the SDK envelope contract", () => {
  const expanded = expand("/skill:review src/main.ts");
  assert.equal(
    expanded,
    formatSkillEnvelope(catalog[0], "Review the supplied files.") + "\n\nsrc/main.ts",
  );
  assert.equal(skillExpansionToCommand(expanded), "/skill:review src/main.ts");
});

test("expands two skills and keeps the question as prose", () => {
  const expanded = expand("/skill:a /skill:b 这两个技能怎么用");
  assert.match(expanded, /<skill name="a"/);
  assert.match(expanded, /<skill name="b"/);
  assert.ok(expanded.indexOf('name="a"') < expanded.indexOf('name="b"'));
  assert.match(expanded, /\n\n这两个技能怎么用$/);
  assert.doesNotMatch(expanded, /\/skill:a/);
  assert.doesNotMatch(expanded, /\/skill:b/);
});

test("expands three skills in typed order", () => {
  const expanded = expand("/skill:c /skill:a /skill:b");
  const names = [...expanded.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["c", "a", "b"]);
});

test("unknown skill tokens stay in the remaining prose", () => {
  const expanded = expand("/skill:a /skill:not-exist 再问");
  assert.match(expanded, /<skill name="a"/);
  assert.match(expanded, /\/skill:not-exist 再问$/);
});

test("expands a skill that is not at the start of the message", () => {
  const expanded = expand("请先 /skill:docx 再检查");
  assert.match(expanded, /<skill name="docx"/);
  assert.match(expanded, /\n\n请先 再检查$/);
});

test("returns the original text when nothing can be expanded", () => {
  assert.equal(expand("/skill:missing 你好"), "/skill:missing 你好");
  assert.equal(expand("普通提问"), "普通提问");
});

test("rpc-manager expands skills before prompt, steer, and follow-up", async () => {
  const rpcSource = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");
  assert.match(rpcSource, /this\.inner\.prompt\(this\.expandOutgoingPrompt\(/);
  assert.match(rpcSource, /this\.inner\.steer\(this\.expandOutgoingPrompt\(/);
  assert.match(rpcSource, /this\.inner\.followUp\(this\.expandOutgoingPrompt\(/);
});
