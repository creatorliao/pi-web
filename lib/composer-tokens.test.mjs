import assert from "node:assert/strict";
import test from "node:test";
import {
  applySlashInsertion,
  extractSlashQuery,
  parseClosedComposerTokens,
  removeComposerToken,
  tokenizeComposer,
} from "./composer-tokens.ts";

test("colors multiple skills and mentions at once", () => {
  const text = "/skill:pmi-pm-ai-leader 看这个 @src/a.ts 再跑 /skill:docx";
  const closed = parseClosedComposerTokens(text);
  assert.deepEqual(closed.map((t) => [t.kind, t.label]), [
    ["skill", "pmi-pm-ai-leader"],
    ["mention", "src/a.ts"],
    ["skill", "docx"],
  ]);
  const kinds = tokenizeComposer(text).filter((s) => s.kind !== "text").map((s) => s.kind);
  assert.deepEqual(kinds, ["skill", "mention", "skill"]);
});

test("quoted mention and slash command stay distinct", () => {
  const text = `请看 @"my dir/x.ts" 然后 /compact`;
  const closed = parseClosedComposerTokens(text);
  assert.equal(closed[0].kind, "mention");
  assert.equal(closed[0].label, "my dir/x.ts");
  assert.equal(closed[1].kind, "slash");
  assert.equal(closed[1].label, "compact");
});

test("removing a chip keeps surrounding prose", () => {
  const text = "先 /skill:docx 再写";
  const [token] = parseClosedComposerTokens(text);
  assert.equal(removeComposerToken(text, token), "先 再写");
});

test("slash query can start in the middle of the composer", () => {
  assert.deepEqual(extractSlashQuery("先看这个 /sk"), { start: 5, query: "sk" });
  assert.deepEqual(extractSlashQuery("/"), { start: 0, query: "" });
  assert.equal(extractSlashQuery("foo/bar"), null);
  assert.equal(extractSlashQuery("done /skill:foo "), null);
});

test("slash insertion keeps prose before and after the token", () => {
  const text = "先 /sk 再检查";
  const match = extractSlashQuery("先 /sk");
  assert.ok(match);
  const result = applySlashInsertion(text, match.start + 1 + match.query.length, match.start, "skill:docx");
  assert.equal(result.value, "先 /skill:docx 再检查");
  assert.equal(result.value.includes("\n"), false);
});
