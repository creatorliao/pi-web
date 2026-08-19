import {
  CHAT_SAFE_WIDTH,
  HISTORY_MAX_WIDTH,
  HISTORY_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_SNAP_COLLAPSE,
} from "./panel-layout";

export interface RightPanelDragStart {
  chatWidth: number;
  historyOpen: boolean;
  historyWidth: number;
}

export interface RightPanelDragResult {
  chatWidth: number;
  historyOpen: boolean;
  historyWidth: number;
  collapsePanel: boolean;
}

/**
 * 文件|右栏分栏拖拽：历史开着时先让历史，再保对话安全宽，越界才关整栏。
 * proposedChatWidth 是把指针位移当成「只改对话宽」时的未夹紧值。
 */
export function applyRightPanelDrag(
  start: RightPanelDragStart,
  proposedChatWidth: number,
  limits: {
    chatMin?: number;
    chatMax?: number;
    historyMin?: number;
    snapBelow?: number;
  } = {},
): RightPanelDragResult {
  const chatMin = limits.chatMin ?? CHAT_SAFE_WIDTH;
  const chatMax = limits.chatMax ?? RIGHT_PANEL_MAX_WIDTH;
  const historyMin = limits.historyMin ?? HISTORY_MIN_WIDTH;
  const snapBelow = limits.snapBelow ?? RIGHT_PANEL_SNAP_COLLAPSE;
  const startHistory = Math.max(historyMin, start.historyWidth);

  if (!start.historyOpen) {
    const collapsePanel = proposedChatWidth < snapBelow;
    return {
      chatWidth: clamp(proposedChatWidth, chatMin, chatMax),
      historyOpen: false,
      historyWidth: startHistory,
      collapsePanel,
    };
  }

  const needShrink = start.chatWidth - proposedChatWidth;
  if (needShrink <= 0) {
    return {
      chatWidth: clamp(proposedChatWidth, chatMin, chatMax),
      historyOpen: true,
      historyWidth: startHistory,
      collapsePanel: false,
    };
  }

  const histTake = Math.min(needShrink, startHistory - historyMin);
  const remain = needShrink - histTake;
  if (remain <= 0) {
    return {
      chatWidth: start.chatWidth,
      historyOpen: true,
      historyWidth: startHistory - histTake,
      collapsePanel: false,
    };
  }

  const nextChat = start.chatWidth - remain;
  const collapsePanel = nextChat < snapBelow;
  return {
    chatWidth: clamp(nextChat, chatMin, chatMax),
    historyOpen: false,
    historyWidth: startHistory,
    collapsePanel,
  };
}

export interface HistoryDragStart {
  chatWidth: number;
  historyWidth: number;
}

/**
 * 对话|历史 分栏：向左加宽先吃对话多余宽，对话到安全宽后再撑大右栏总宽。
 */
export function applyHistoryDrag(
  start: HistoryDragStart,
  proposedHistoryWidth: number,
  limits: {
    chatMin?: number;
    historyMin?: number;
    historyMax?: number;
  } = {},
): { chatWidth: number; historyWidth: number } {
  const chatMin = limits.chatMin ?? CHAT_SAFE_WIDTH;
  const historyMin = limits.historyMin ?? HISTORY_MIN_WIDTH;
  const historyMax = limits.historyMax ?? HISTORY_MAX_WIDTH;
  const historyWidth = clamp(proposedHistoryWidth, historyMin, historyMax);
  const delta = historyWidth - start.historyWidth;

  if (delta <= 0) {
    return { chatWidth: start.chatWidth, historyWidth };
  }

  if (start.chatWidth - delta >= chatMin) {
    return { chatWidth: start.chatWidth - delta, historyWidth };
  }

  return { chatWidth: chatMin, historyWidth };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
