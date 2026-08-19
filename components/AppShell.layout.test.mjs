import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const chatWindow = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const chatInput = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");

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

test("desktop chat entry uses a push drawer and tab-bar icons stay off the file tabs", () => {
  assert.match(source, /data-workspace-new-chat=""/);
  assert.match(source, /data-workspace-chat-history=""/);
  assert.match(source, /data-agent-chrome=""/);
  assert.match(source, /data-agent-history-drawer=""/);
  assert.doesNotMatch(source, /data-file-chrome=""/);
  assert.match(source, /data-file-tab-strip=""/);
  assert.match(source, /data-collapse-right-panel=""/);
  assert.match(source, /const mergeFileTabsIntoMainTopBar = isEditorLayout && !isMobile/);
  assert.match(source, /mergeFileTabsIntoMainTopBar && renderFileTabStrip\(true\)/);
  assert.match(source, /!mergeFileTabsIntoMainTopBar && \(/);
  assert.match(source, /const AGENT_HISTORY_DRAWER_WIDTH = 240/);
  assert.match(source, /width: agentHistoryOpen \? AGENT_HISTORY_DRAWER_WIDTH : 0/);
  assert.match(source, /borderLeft: agentHistoryOpen \? "1px solid var\(--border\)" : "none"/);
  assert.match(source, /rightPanelResizer\.width \+ \(/);
  assert.doesNotMatch(source, /display: agentHistoryOpen && !isMobile \? "none"/);
  assert.doesNotMatch(source, /<circle cx="12" cy="12" r="8" \/>/);
  assert.doesNotMatch(source, /<span aria-hidden="true">\+<\/span>/);
  assert.doesNotMatch(source, /\{translate\("chat\.historyList"\)\}/);
  assert.doesNotMatch(source, /chromeHost=\{fileChromeHost\}/);
});

test("desktop chat no longer mounts ChatMinimap hover preview", () => {
  assert.doesNotMatch(chatWindow, /<ChatMinimap[\s>]/);
  assert.match(chatInput, /paddingRight: 16,/);
});
