import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");

test("desktop editor layout puts files in the main column and chat in the aux panel", () => {
  assert.match(source, /const isEditorLayout = !isMobile && layoutMode === "editor"/);
  assert.match(source, /isEditorLayout \? fileWorkspace : agentWorkspace/);
  assert.match(source, /isEditorLayout \? agentWorkspace : fileWorkspace/);
  assert.match(source, /data-workspace="files"/);
  assert.match(source, /data-workspace="agent"/);
});

test("session list is portaled into the agent block on desktop only", () => {
  assert.match(source, /sessionListPortalTarget=\{isMobile \? null : sessionListHost\}/);
  assert.match(source, /ref=\{setSessionListHost\}/);
});
