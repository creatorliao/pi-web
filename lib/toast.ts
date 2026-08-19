/** Toast 语气：说明、成功、失败。 */
export type ToastTone = "info" | "success" | "error";

/** 调用方传入的提示内容。 */
export interface ShowToastOptions {
  /** 展示给用户的短句，不带 HTML。 */
  message: string;
  /** 缺省为 info。 */
  tone?: ToastTone;
  /** 覆盖默认自动消失时长（毫秒）。 */
  durationMs?: number;
}

/** Host 渲染用的一条提示。 */
export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

/** 各语气默认停留时间：说明稍长、成功最短、失败留给人读完。 */
export const TOAST_DEFAULT_DURATION_MS: Record<ToastTone, number> = {
  info: 2800,
  success: 2200,
  error: 4500,
};

/** 同时可见的最大条数，超出时丢掉最旧的。 */
export const TOAST_MAX_VISIBLE = 3;

/** 相同文案在此间隔内不重复入队，避免连点刷屏。 */
export const TOAST_DEDUP_MS = 800;

/**
 * 解析一条 Toast 的停留时长。
 * @param tone 语气
 * @param durationMs 调用方覆盖值；非正数视为未指定
 */
export function resolveToastDuration(tone: ToastTone, durationMs?: number): number {
  if (typeof durationMs === "number" && durationMs > 0) return durationMs;
  return TOAST_DEFAULT_DURATION_MS[tone];
}
