import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  filterExplorerEntries,
  isExplorerEntryHidden,
  readShowHiddenFiles,
  writeShowHiddenFiles,
} = await jiti.import("./explorer-visibility.ts");

test("hides dotfiles and common build directories", () => {
  assert.equal(isExplorerEntryHidden(".next"), true);
  assert.equal(isExplorerEntryHidden("node_modules"), true);
  assert.equal(isExplorerEntryHidden(".gitignore"), true);
  assert.equal(isExplorerEntryHidden("package.json"), false);
  assert.equal(isExplorerEntryHidden("docs"), false);
});

test("filter keeps everything only when showHidden is on", () => {
  const entries = [
    { name: "docs" },
    { name: ".next" },
    { name: "node_modules" },
    { name: "README.md" },
  ];
  assert.deepEqual(filterExplorerEntries(entries, false).map((item) => item.name), ["docs", "README.md"]);
  assert.deepEqual(filterExplorerEntries(entries, true).map((item) => item.name), [
    "docs", ".next", "node_modules", "README.md",
  ]);
});

test("persists the hidden-file preference", () => {
  const store = new Map();
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); },
  };
  assert.equal(readShowHiddenFiles(storage), false);
  writeShowHiddenFiles(true, storage);
  assert.equal(readShowHiddenFiles(storage), true);
});
