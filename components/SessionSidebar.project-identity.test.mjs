import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const browseStart = shell.indexOf("const handleBrowseSelect = useCallback");
const browseEnd = shell.indexOf("}, [enterWorkspace, patchWorkspacePrefs]);", browseStart);
const browseSource = shell.slice(browseStart, browseEnd);

test("custom cwd selection installs validated identity before changing cwd", () => {
  assert.notEqual(browseStart, -1);
  assert.ok(browseEnd > browseStart);
  assert.match(browseSource, /projectRoot\?: string;[\s\S]*?projectKey\?: string;/);

  assert.match(
    browseSource,
    /enterWorkspace\(data\.cwd, projectKey\)/,
  );
  assert.match(browseSource, /action: "unhide"/);
});

test("picker select validates the folder and project-trust GET does not throw", () => {
  const pickerStart = shell.indexOf("const handlePickerSelect = useCallback");
  const pickerEnd = shell.indexOf("}, [enterWorkspace, showToast, translate, workspacePhase]);", pickerStart);
  assert.ok(pickerEnd > pickerStart);
  assert.match(shell.slice(pickerStart, pickerEnd), /\/api\/cwd\/validate/);
  assert.match(shell.slice(pickerStart, pickerEnd), /workspace\.dirMissing/);

  const trustStart = shell.indexOf("fetch(`/api/project-trust?cwd=");
  const trustEnd = shell.indexOf("}, [projectTrustCwd]);", trustStart);
  const trustSource = shell.slice(trustStart, trustEnd);
  assert.match(trustSource, /setProjectTrust\(null\)/);
  assert.doesNotMatch(trustSource, /throw new Error/);
  assert.doesNotMatch(trustSource, /console\.error/);
});
