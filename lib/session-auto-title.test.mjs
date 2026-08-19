import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  hasPersistedSessionName,
  parseAutoNameForce,
  shouldAttemptAutoSessionTitle,
} = await jiti.import("./session-auto-title.ts");

test("空名与纯空白都不算已持久化命名", () => {
  assert.equal(hasPersistedSessionName(undefined), false);
  assert.equal(hasPersistedSessionName(""), false);
  assert.equal(hasPersistedSessionName("   "), false);
  assert.equal(hasPersistedSessionName("修 SSE 重连"), true);
});

test("自动门控：有持久化名则跳过，展示回退不参与判断", () => {
  const ready = {
    transient: false,
    persistedName: "",
    hasMessages: true,
    alreadyAutoSucceeded: false,
    isBusy: false,
  };
  assert.equal(shouldAttemptAutoSessionTitle(ready), true);
  assert.equal(shouldAttemptAutoSessionTitle({ ...ready, persistedName: "用户起的名" }), false);
  assert.equal(shouldAttemptAutoSessionTitle({ ...ready, transient: true }), false);
  assert.equal(shouldAttemptAutoSessionTitle({ ...ready, hasMessages: false }), false);
  assert.equal(shouldAttemptAutoSessionTitle({ ...ready, alreadyAutoSucceeded: true }), false);
  assert.equal(shouldAttemptAutoSessionTitle({ ...ready, isBusy: true }), false);
});

test("auto-name 仅当 force 显式为 true 才覆盖", () => {
  assert.equal(parseAutoNameForce(""), false);
  assert.equal(parseAutoNameForce("{}"), false);
  assert.equal(parseAutoNameForce('{"force":false}'), false);
  assert.equal(parseAutoNameForce('{"force":true}'), true);
  assert.equal(parseAutoNameForce("not-json"), false);
});

test("auto-name 路由在非 force 时让已有名称", async () => {
  const source = await readFile(new URL("../app/api/sessions/[id]/auto-name/route.ts", import.meta.url), "utf8");
  assert.match(source, /parseAutoNameForce\(await req\.text\(\)\)/);
  assert.match(source, /if \(!force && hasPersistedSessionName\(currentName\)\)/);
  assert.match(source, /if \(!force && hasPersistedSessionName\(nameAfterGenerate\)\)/);
});
