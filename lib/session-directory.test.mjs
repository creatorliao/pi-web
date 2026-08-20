import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { annotateSessionDirectoryExists, isExistingDirectory } = await jiti.import("./session-directory.ts");

test("isExistingDirectory is true only for real directories", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pi-web-dir-exists-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const folder = join(root, "proj");
  const file = join(root, "note.txt");
  mkdirSync(folder);
  writeFileSync(file, "x");
  assert.equal(isExistingDirectory(folder), true);
  assert.equal(isExistingDirectory(file), false);
  assert.equal(isExistingDirectory(join(root, "missing")), false);
});

test("annotateSessionDirectoryExists caches per root", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pi-web-dir-ann-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "alive"));
  const sessions = [
    { id: "a", cwd: join(root, "alive"), projectRoot: join(root, "alive") },
    { id: "b", cwd: join(root, "alive"), projectRoot: join(root, "alive") },
    { id: "c", cwd: join(root, "gone"), projectRoot: join(root, "gone") },
  ];
  const marked = annotateSessionDirectoryExists(sessions);
  assert.equal(marked[0].directoryExists, true);
  assert.equal(marked[1].directoryExists, true);
  assert.equal(marked[2].directoryExists, false);
});
