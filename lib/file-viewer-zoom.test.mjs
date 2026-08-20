import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  DEFAULT_FILE_VIEWER_FONT_SIZE,
  FILE_VIEWER_FONT_SIZES,
  parseFileViewerFontSize,
  readFileViewerFontSize,
  stepFileViewerFontSize,
  writeFileViewerFontSize,
} = await jiti.import("./file-viewer-zoom.ts");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("parseFileViewerFontSize keeps known steps and falls back to 13", () => {
  assert.equal(parseFileViewerFontSize("16"), 16);
  assert.equal(parseFileViewerFontSize("11"), DEFAULT_FILE_VIEWER_FONT_SIZE);
  assert.equal(parseFileViewerFontSize(null), DEFAULT_FILE_VIEWER_FONT_SIZE);
});

test("stepFileViewerFontSize stops at the ends", () => {
  assert.equal(stepFileViewerFontSize(13, 1), 14);
  assert.equal(stepFileViewerFontSize(18, 1), 18);
  assert.equal(stepFileViewerFontSize(12, -1), 12);
  assert.equal(stepFileViewerFontSize(99, -1), FILE_VIEWER_FONT_SIZES[0]);
});

test("read and write round-trip the stored font size", () => {
  const storage = createStorage();
  writeFileViewerFontSize(16, storage);
  assert.equal(readFileViewerFontSize(storage), 16);
});
