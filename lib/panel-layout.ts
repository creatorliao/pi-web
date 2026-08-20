export const MOBILE_MAX_WIDTH = 640;
export const SPLIT_PANEL_MIN_WIDTH = 960;

/** 左右侧栏出厂同宽：初次进入两边对齐，之后各栏可单独拖。 */
export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 360;
/** 指针暗示宽度低于此值时松手收起左栏。 */
export const SIDEBAR_SNAP_COLLAPSE = 160;

export const RIGHT_PANEL_FALLBACK_WIDTH = 380;
export const RIGHT_PANEL_MIN_WIDTH = 320;
export const RIGHT_PANEL_MAX_WIDTH = 560;
/** 历史已关且再往右压，指针低于此值则整栏收起。 */
export const RIGHT_PANEL_SNAP_COLLAPSE = 240;

export const HISTORY_DEFAULT_WIDTH = SIDEBAR_DEFAULT_WIDTH;
export const HISTORY_MIN_WIDTH = 180;
export const HISTORY_MAX_WIDTH = 360;

/** 中间文件列安全宽（编辑器主角）。 */
export const FILE_SAFE_WIDTH = 420;
export const CHAT_SAFE_WIDTH = 320;

const COMPACT_CENTER_MIN_WIDTH = 320;

export function clampPanelWidth(width: number, minWidth: number, maxWidth: number): number {
  const finiteWidth = Number.isFinite(width) ? width : minWidth;
  const effectiveMax = Math.max(minWidth, maxWidth);
  return Math.round(Math.max(minWidth, Math.min(effectiveMax, finiteWidth)));
}

/** 编辑器下对话是配角：约 24%，夹在 360～420。 */
export function getDefaultRightPanelWidth(viewportWidth: number): number {
  return clampPanelWidth(viewportWidth * 0.24, 360, 420);
}

export function getSidebarMaxWidth(options: {
  viewportWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
}): number {
  const { viewportWidth, rightPanelOpen, rightPanelWidth } = options;
  if (viewportWidth <= MOBILE_MAX_WIDTH) return SIDEBAR_MAX_WIDTH;

  const compact = viewportWidth < SPLIT_PANEL_MIN_WIDTH;
  const centerMin = compact ? COMPACT_CENTER_MIN_WIDTH : FILE_SAFE_WIDTH;
  const visibleRightPanelWidth = !compact && rightPanelOpen ? rightPanelWidth : 0;
  return Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - centerMin - visibleRightPanelWidth);
}

export function getRightPanelMaxWidth(options: {
  viewportWidth: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
}): number {
  const { viewportWidth, sidebarOpen, sidebarWidth } = options;
  if (viewportWidth < SPLIT_PANEL_MIN_WIDTH) return RIGHT_PANEL_MAX_WIDTH;

  const visibleSidebarWidth = sidebarOpen ? sidebarWidth : 0;
  return Math.min(
    RIGHT_PANEL_MAX_WIDTH,
    viewportWidth - FILE_SAFE_WIDTH - visibleSidebarWidth,
  );
}
