import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const browseStart = shell.indexOf("const handleBrowseSelect = useCallback");
const browseEnd = shell.indexOf("}, [enterWorkspace]);", browseStart);
const browseSource = shell.slice(browseStart, browseEnd);

test("custom cwd selection installs validated identity before changing cwd", () => {
  assert.notEqual(browseStart, -1);
  assert.ok(browseEnd > browseStart);
  assert.match(browseSource, /projectRoot\?: string;[\s\S]*?projectKey\?: string;/);

  assert.match(
    browseSource,
    /enterWorkspace\(data\.cwd, data\.projectKey \?\? data\.projectRoot \?\? data\.cwd\)/,
  );
});
