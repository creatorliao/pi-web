import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");

function callbackBody(name, nextName) {
  const start = source.indexOf(`const ${name} = useCallback`);
  const end = source.indexOf(`\n  const ${nextName}`, start);
  assert.notEqual(start, -1, `${name} callback not found`);
  assert.notEqual(end, -1, `${nextName} callback not found after ${name}`);
  return source.slice(start, end);
}

test("explicit context changes invalidate a pending workspace restore", () => {
  const callbacks = [
    ["handleCwdChange", "handleSelectSession"],
    ["handleSelectSession", "handleNewSession"],
    ["handleNewSession", "hydrateSelectedSession"],
    ["handleSessionCreated", "handleAgentEnd"],
    ["handleSessionForked", "handleInitialRestoreDone"],
    ["handleSessionDeleted", "handleOpenFile"],
  ];

  for (const [name, nextName] of callbacks) {
    assert.match(callbackBody(name, nextName), /invalidateWorkspaceRestore\(\);/);
  }
});

test("all active-session transitions share one persistence effect", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s+if \(!selectedSession\) return;[\s\S]*?setLastOpenSession\(projectKey, selectedSession\.id\);\s+\}, \[selectedSession\]\);/,
  );
});

test("workspace restoration remains inside the cross-project branch", () => {
  assert.match(
    callbackBody("handleCwdChange", "handleSelectSession"),
    /if \(currentProject !== newProject\) \{[\s\S]*?restoreWorkspaceContext\(newProject\);[\s\S]*?\}/,
  );
});

test("workspace restore asks the session list even without a remembered id", () => {
  const body = callbackBody("restoreWorkspaceContext", "handleCwdChange");
  assert.match(body, /pickWorkspaceSessionToRestore/);
  assert.doesNotMatch(body, /if \(!lastOpenSessionId\) return;/);
});

test("same-cwd key hydration does not invalidate an in-flight workspace restore", () => {
  const body = callbackBody("handleCwdChange", "handleSelectSession");
  const hydrateGuard = body.indexOf("if (currentFreshCwd === cwd && currentProject !== newProject)");
  const invalidate = body.indexOf("invalidateWorkspaceRestore()");
  assert.ok(hydrateGuard >= 0, "same-cwd hydration guard missing");
  assert.ok(invalidate > hydrateGuard, "invalidate must run only after hydration guards");
});
