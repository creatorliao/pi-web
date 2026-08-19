import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { AppStatusBar } = await jiti.import("./AppStatusBar.tsx");
const { I18nProvider } = await jiti.import("../hooks/useI18n");

test("renders the read-only tool preset as the active selection", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AppStatusBar, {
        soundEnabled: true,
        onSoundToggle() {},
        toolPreset: "read-only",
        onToolPresetChange() {},
      }),
    ),
  );

  assert.match(html, /title="Change tool preset: read-only"/);
  assert.match(html, />read-only<\/span>/);
  assert.match(html, /role="contentinfo"/);
});

test("renders compact on the status bar and can switch to the abort label", () => {
  const idle = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AppStatusBar, {
        soundEnabled: true,
        onSoundToggle() {},
        onCompact() {},
      }),
    ),
  );
  assert.match(idle, /aria-label="Compact context"/);
  assert.match(idle, />Compact<\/span>/);

  const busy = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AppStatusBar, {
        soundEnabled: true,
        onSoundToggle() {},
        onCompact() {},
        onAbortCompaction() {},
        isCompacting: true,
      }),
    ),
  );
  assert.match(busy, /aria-label="Stop compaction"/);
  assert.match(busy, /<rect x="2" y="2" width="12" height="12"/);
});

test("hides the tool preset when no change handler is provided", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(AppStatusBar, {
        soundEnabled: false,
        onSoundToggle() {},
      }),
    ),
  );

  assert.doesNotMatch(html, /Change tool preset/);
  assert.match(html, /Enable completion sound/);
});
