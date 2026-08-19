import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  DEFAULT_LAYOUT_MODE,
  parseLayoutMode,
  readLayoutMode,
  writeLayoutMode,
} = await jiti.import("./layout-mode.ts");

test("parses only editor and assistant, defaulting unknown values to editor", () => {
  assert.equal(parseLayoutMode("editor"), "editor");
  assert.equal(parseLayoutMode("assistant"), "assistant");
  assert.equal(parseLayoutMode("glass"), DEFAULT_LAYOUT_MODE);
  assert.equal(parseLayoutMode(null), DEFAULT_LAYOUT_MODE);
});

test("persists the layout preference through a storage stand-in", () => {
  const store = new Map();
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); },
  };
  assert.equal(readLayoutMode(storage), "editor");
  writeLayoutMode("assistant", storage);
  assert.equal(readLayoutMode(storage), "assistant");
});
