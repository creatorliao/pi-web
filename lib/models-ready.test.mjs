import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { modelsConfigHasModel } = await jiti.import("./models-ready.ts");

test("modelsConfigHasModel is true when any provider lists a non-empty id", () => {
  assert.equal(modelsConfigHasModel({
    providers: {
      zenmux: { models: [{ id: "claude-sonnet-4-6" }] },
    },
  }), true);
});

test("modelsConfigHasModel is false for empty models or blank ids", () => {
  assert.equal(modelsConfigHasModel({ providers: { a: { models: [] } } }), false);
  assert.equal(modelsConfigHasModel({ providers: { a: { models: [{ id: "  " }] } } }), false);
  assert.equal(modelsConfigHasModel({}), false);
});
