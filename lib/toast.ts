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

/**
 * 各语气默认停留时间。
 * 对照：Carbon Toast 默认 5s；Sonner / Chakra 默认 4–5s。
 * 本仓 Toast 在文档区，人从对话栏抬头需要额外时间，因此不低于 4s；
 * 失败句更长，给 8s 读完。
 */
export const TOAST_DEFAULT_DURATION_MS: Record<ToastTone, number> = {
  info: 5000,
  success: 4000,
  error: 8000,
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
