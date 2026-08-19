import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { resolveToastDuration, TOAST_DEFAULT_DURATION_MS } = await jiti.import("./toast.ts");

test("resolveToastDuration uses the tone default when duration is omitted", () => {
  assert.equal(resolveToastDuration("info"), TOAST_DEFAULT_DURATION_MS.info);
  assert.equal(resolveToastDuration("success"), TOAST_DEFAULT_DURATION_MS.success);
  assert.equal(resolveToastDuration("error"), TOAST_DEFAULT_DURATION_MS.error);
});

test("resolveToastDuration accepts a positive override and ignores non-positive values", () => {
  assert.equal(resolveToastDuration("info", 1200), 1200);
  assert.equal(resolveToastDuration("error", 0), TOAST_DEFAULT_DURATION_MS.error);
  assert.equal(resolveToastDuration("error", -1), TOAST_DEFAULT_DURATION_MS.error);
});
