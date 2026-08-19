import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

test("压缩后的会话仍可根据持久化消息数生成标题", () => {
  assert.match(
    source,
    /\(sessionStats\?\.userMessages \?\? 0\) > 0 \|\| selectedSession\.messageCount > 0/,
  );
});

test("尚未落盘的会话不会触发依赖 JSONL 的自动命名", () => {
  assert.match(
    source,
    /const disabled = !selectedSession \|\| selectedSession\.transient \|\| !hasMessages/,
  );
});

test("会话落盘后会用服务端记录清除临时状态", () => {
  assert.match(source, /\{ \.\.\.prev, \.\.\.full, transient: full\.transient \?\? false \}/);
  assert.match(source, /if \(sessionId\) \{\s*void hydrateSelectedSession\(sessionId\)/s);
});

test("一轮结束后会静默尝试自动命名，按钮则 force 覆盖", () => {
  assert.match(source, /requestSessionTitle\(\{ silent: true \}\)/);
  assert.match(source, /requestSessionTitle\(\{ force: true \}\)/);
  assert.match(source, /body: JSON\.stringify\(\{ force \}\)/);
  assert.match(source, /shouldAttemptAutoSessionTitle\(/);
});
