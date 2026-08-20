import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const chatWindow = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const chatInput = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("opening a session expands the history drawer on desktop", () => {
  assert.match(
    source,
    /if \(!selectedSession \|\| isMobile\) return;\s*setAgentHistoryOpen\(true\);/,
  );
  assert.match(source, /\[isMobile, selectedSession\?\.id\]/);
});

test("desktop editor layout puts files in the main column and chat in the aux panel", () => {
  assert.match(source, /const isEditorLayout = !isMobile && layoutMode === "editor"/);
  assert.match(source, /isEditorLayout \? fileWorkspace : agentWorkspace/);
  assert.match(source, /isEditorLayout \? agentWorkspace : fileWorkspace/);
  assert.match(source, /data-workspace="files"/);
  assert.match(source, /data-workspace="agent"/);
});

test("editor layout without file tabs expands chat instead of keeping an empty center", () => {
  assert.match(source, /const editorChatExpanded = isEditorLayout && fileTabs\.length === 0/);
  assert.match(source, /const editorChatFills = editorChatExpanded && rightPanelOpen/);
  assert.match(source, /data-editor-main-column=\{editorChatFills \? "collapsed" : "open"\}/);
  assert.match(source, /right-panel-fill/);
  assert.match(source, /data-editor-chat-expanded=\{editorChatFills \? "" : undefined\}/);
  assert.match(source, /rightPanelOpen && !editorChatFills/);
});

test("sidebar rail toggles stay available after the empty editor column hides", () => {
  assert.match(source, /data-workspace-sidebar-toggle=""/);
  assert.match(source, /editorChatExpanded && renderLeftSidebarToggle\(\)/);
  assert.match(source, /data-collapse-right-panel-on-chat=""/);
  assert.match(source, /<line x1="9" y1="3" x2="9" y2="21" \/>/);
  assert.doesNotMatch(
    source,
    /sidebarOpen \? \(\s*<svg[\s\S]*?<line x1="3" y1="6"/,
  );
});

test("session list is portaled into the agent block on desktop only", () => {
  assert.match(source, /sessionListPortalTarget=\{isMobile \? null : sessionListHost\}/);
  assert.match(source, /ref=\{setHistoryDrawerRef\}/);
  assert.match(source, /setSessionListHost\(node\)/);
});

test("desktop chat entry uses a push drawer and tab-bar icons stay off the file tabs", () => {
  assert.match(source, /data-workspace-new-chat=""/);
  assert.match(source, /data-workspace-chat-history=""/);
  assert.match(source, /data-workspace-chat-title=/);
  assert.match(source, /data-workspace-session-tools=/);
  assert.match(source, /data-workspace-new-chat-collapsed=/);
  assert.match(source, /data-agent-chrome=""/);
  assert.match(source, /data-agent-column=/);
  assert.match(source, /showHistoryToggle \?\? true/);
  assert.doesNotMatch(source, /showHistoryToggle: !agentHistoryOpen/);
  assert.match(source, /data-agent-history-drawer=""/);
  assert.doesNotMatch(source, /data-file-chrome=""/);
  assert.match(source, /data-file-tab-strip=""/);
  assert.match(source, /data-collapse-right-panel=""/);
  assert.match(source, /const mergeFileTabsIntoMainTopBar = isEditorLayout && !isMobile/);
  assert.match(source, /mergeFileTabsIntoMainTopBar && renderFileTabStrip\(true\)/);
  assert.match(source, /!mergeFileTabsIntoMainTopBar && \(/);
  assert.match(source, /storageKey: "pi-agent-history-width"/);
  assert.match(source, /data-resize-handle="history"/);
  assert.match(source, /data-agent-history-open=\{agentHistoryOpen \? "" : undefined\}/);
  assert.match(source, /borderLeft: agentHistoryOpen \? "1px solid var\(--border\)" : "none"/);
  assert.match(source, /rightPanelResizer\.width \+ \(/);
  assert.match(source, /historyResizer\.width/);
  assert.doesNotMatch(source, /AGENT_HISTORY_DRAWER_WIDTH/);
  assert.doesNotMatch(source, /display: agentHistoryOpen && !isMobile \? "none"/);
  assert.doesNotMatch(source, /<circle cx="12" cy="12" r="8" \/>/);
  assert.doesNotMatch(source, /<span aria-hidden="true">\+<\/span>/);
  assert.doesNotMatch(source, /\{translate\("chat\.historyList"\)\}/);
  assert.doesNotMatch(source, /<span>\{translate\("chat\.sessionMenu"\)\}<\/span>/);
  assert.doesNotMatch(source, /chromeHost=\{fileChromeHost\}/);
});

test("history drawer chrome and collapsed new-chat live in the shell", () => {
  assert.match(source, /includeCollapse && !rightPanelOpen/);
  assert.match(source, /startNewConversation/);
});

test("first-visit history rail follows the file rail default width", () => {
  assert.match(source, /getDefaultWidth: getDefaultHistoryWidth/);
  assert.match(source, /sidebarWidthRef\.current \|\| SIDEBAR_DEFAULT_WIDTH/);
  assert.match(
    cssSource,
    /\[data-agent-history-drawer\]\[data-agent-history-open\] \{[\s\S]*?min-width: var\(--agent-history-width, 240px\);/,
  );
});

test("desktop chat no longer mounts ChatMinimap hover preview", () => {
  assert.doesNotMatch(chatWindow, /<ChatMinimap[\s>]/);
  assert.match(chatInput, /paddingRight: 16,/);
});

test("chat column uses the shared overlay scrollbar instead of hiding it", () => {
  assert.match(chatWindow, /overlay-scroll/);
  assert.doesNotMatch(chatWindow, /scrollbar-width:none/);
});
