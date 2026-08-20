import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");

test("resolves project identity from server worktree data without a worktree UI", () => {
  assert.match(source, /currentWorktreePath: string \| null/);
  assert.match(
    source,
    /const currentWorktree =[\s\S]*?worktreeState\.currentWorktreePath[\s\S]*?worktree\.path === worktreeState\.currentWorktreePath/,
  );
  assert.doesNotMatch(source, /sidebar\.switchWorktree/);
  assert.doesNotMatch(source, /handleCreateWorktree/);
  assert.doesNotMatch(source, /handleRemoveWorktree/);
});
