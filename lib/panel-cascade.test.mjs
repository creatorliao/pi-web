import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { applyHistoryDrag, applyRightPanelDrag } = await jiti.import("./panel-cascade.ts");

test("shrinking the right split eats history before the chat column", () => {
  const start = { chatWidth: 400, historyOpen: true, historyWidth: 240 };
  const next = applyRightPanelDrag(start, 360);
  assert.deepEqual(next, {
    chatWidth: 400,
    historyOpen: true,
    historyWidth: 200,
    collapsePanel: false,
  });
});

test("further shrink closes history and then reduces chat", () => {
  const start = { chatWidth: 400, historyOpen: true, historyWidth: 240 };
  const next = applyRightPanelDrag(start, 400 - 60 - 40);
  assert.equal(next.historyOpen, false);
  assert.equal(next.historyWidth, 240);
  assert.equal(next.chatWidth, 360);
  assert.equal(next.collapsePanel, false);
});

test("dragging past the snap threshold collapses the whole right panel", () => {
  const start = { chatWidth: 400, historyOpen: false, historyWidth: 240 };
  const next = applyRightPanelDrag(start, 180);
  assert.equal(next.collapsePanel, true);
  assert.equal(next.chatWidth, 320);
});

test("growing history first consumes surplus chat width", () => {
  const next = applyHistoryDrag({ chatWidth: 400, historyWidth: 240 }, 280);
  assert.deepEqual(next, { chatWidth: 360, historyWidth: 280 });
});

test("growing history past the chat safe width keeps chat at 320", () => {
  const next = applyHistoryDrag({ chatWidth: 340, historyWidth: 240 }, 300);
  assert.equal(next.chatWidth, 320);
  assert.equal(next.historyWidth, 300);
});
