import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  applyWebConfigAction,
  parseWebConfigDocument,
  patchWebConfig,
  readWebConfig,
} = await jiti.import("./web-config-store.ts");

function empty() {
  return { version: 1, workspaces: { starred: [], hidden: [] } };
}

test("parseWebConfigDocument keeps unknown top-level keys and legacy string marks", () => {
  const { config, extras } = parseWebConfigDocument({
    version: 1,
    futureFlag: true,
    workspaces: {
      starred: ["proj-a", { key: "proj-b", at: "2026-08-20T00:00:00.000Z" }],
      hidden: [{ key: "proj-c" }],
    },
  });
  assert.equal(extras.futureFlag, true);
  assert.deepEqual(config.workspaces.starred.map((item) => item.key), ["proj-a", "proj-b"]);
  assert.equal(config.workspaces.hidden[0].key, "proj-c");
});

test("applyWebConfigAction stars, hides, and resetHidden leaves stars", () => {
  let config = applyWebConfigAction(empty(), { action: "star", key: "a" }, new Date("2026-08-20T00:00:00.000Z"));
  config = applyWebConfigAction(config, { action: "hide", key: "b" }, new Date("2026-08-20T00:01:00.000Z"));
  config = applyWebConfigAction(config, { action: "resetHidden" });
  assert.equal(config.workspaces.starred[0].key, "a");
  assert.equal(config.workspaces.hidden.length, 0);
});

test("hiding a starred project drops the star", () => {
  const starred = applyWebConfigAction(empty(), { action: "star", key: "a" }, new Date("2026-08-20T00:00:00.000Z"));
  const hidden = applyWebConfigAction(starred, { action: "hide", key: "a" }, new Date("2026-08-20T00:01:00.000Z"));
  assert.equal(hidden.workspaces.starred.length, 0);
  assert.equal(hidden.workspaces.hidden[0].key, "a");
});

test("patchWebConfig merges extras and refuses to overwrite corrupt JSON", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pi-web-web-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "web.json");
  writeFileSync(path, `${JSON.stringify({ version: 1, keepMe: 1, workspaces: { starred: [], hidden: [] } }, null, 2)}\n`);

  const patched = patchWebConfig({ action: "star", key: "p1" }, path);
  assert.equal(patched.writable, true);
  assert.match(readFileSync(path, "utf8"), /"keepMe": 1/);
  assert.equal(patched.config.workspaces.starred[0].key, "p1");

  writeFileSync(path, "{ not json");
  const broken = readWebConfig(path);
  assert.equal(broken.writable, false);
  const refused = patchWebConfig({ action: "star", key: "p2" }, path);
  assert.equal(refused.writable, false);
  assert.equal(readFileSync(path, "utf8"), "{ not json");
});
