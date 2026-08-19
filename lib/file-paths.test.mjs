import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { getRelativeFilePath, getStatusBarFilePath } = await jiti.import("./file-paths.ts");

test("getRelativeFilePath strips the project root, leaving only the file name at cwd", () => {
  assert.equal(
    getRelativeFilePath("D:/code/pi-web/README.md", "D:/code/pi-web"),
    "README.md",
  );
  assert.equal(
    getRelativeFilePath("D:/code/pi-web/docs/01-Projects/note.md", "D:/code/pi-web"),
    "docs/01-Projects/note.md",
  );
});

test("getStatusBarFilePath keeps a complete path for disk and virtual files", () => {
  assert.equal(
    getStatusBarFilePath("D:/code/pi-web/README.md", "D:/code/pi-web"),
    "D:/code/pi-web/README.md",
  );
  assert.equal(
    getStatusBarFilePath("D:\\code\\pi-web\\README.md", "D:\\code\\pi-web"),
    "D:/code/pi-web/README.md",
  );
  assert.equal(
    getStatusBarFilePath("pi-virtual://history/01a018a5-ac99-7043-b69d-17fdd8838734.md"),
    "pi-virtual://history/01a018a5-ac99-7043-b69d-17fdd8838734.md",
  );
  assert.equal(
    getStatusBarFilePath("README.md", "D:/code/pi-web"),
    "D:/code/pi-web/README.md",
  );
});
