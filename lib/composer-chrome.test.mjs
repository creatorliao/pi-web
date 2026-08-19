import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { resolveComposerChromeVisibility } = await jiti.import("./composer-chrome.ts");

test("keeps the context ring until the composer is very narrow", () => {
  assert.deepEqual(resolveComposerChromeVisibility(500), { showRing: true });
  assert.equal(resolveComposerChromeVisibility(390).showRing, true);
  assert.equal(resolveComposerChromeVisibility(200).showRing, false);
});
