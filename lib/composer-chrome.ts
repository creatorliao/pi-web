/**
 * Composer 框内铬条显隐。
 * 压缩已迁窗口底栏；语音未接线故不画。
 * 圆环只在极窄时卸掉（不再用 400px 这么早藏，避免对话列一收就丢）。
 */

export const COMPOSER_CHROME_HIDE = {
  ring: 220,
} as const;

export function resolveComposerChromeVisibility(width: number): {
  showRing: boolean;
} {
  return {
    showRing: width >= COMPOSER_CHROME_HIDE.ring,
  };
}
