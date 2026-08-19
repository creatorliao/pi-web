/**
 * 会话标题自动命名的纯门控与请求体解析。
 * 展示回退（首条消息截断）不是持久化名，不能参与「已命名」判断。
 */

export interface AutoSessionTitleGate {
  /** 尚未落盘的临时会话，不能打依赖 JSONL 的命名接口 */
  transient?: boolean;
  /** SessionManager.getSessionName() / session_info，空串视为未命名 */
  persistedName?: string | null;
  hasMessages: boolean;
  /** 本页生命周期内该会话已自动命名成功，防止 settled 连打 */
  alreadyAutoSucceeded: boolean;
  /** 已有命名请求在飞，含按钮与自动路径 */
  isBusy: boolean;
}

/**
 * 自动路径（非 force）是否允许发起命名。
 * 任一条件不满足即跳过，避免覆盖用户名或打空会话。
 */
export function shouldAttemptAutoSessionTitle(input: AutoSessionTitleGate): boolean {
  if (input.isBusy) return false;
  if (input.alreadyAutoSucceeded) return false;
  if (input.transient) return false;
  if (!input.hasMessages) return false;
  if (hasPersistedSessionName(input.persistedName)) return false;
  return true;
}

/** 文件里是否已有正式名称（手工或自动写入都算）。 */
export function hasPersistedSessionName(name?: string | null): boolean {
  return Boolean(name?.trim());
}

/**
 * 解析 POST /auto-name 的 body。
 * 缺省或非法 JSON 视为 force=false，避免空 body 被当成覆盖。
 */
export function parseAutoNameForce(rawBody: string): boolean {
  const text = rawBody.trim();
  if (!text) return false;
  try {
    const body = JSON.parse(text) as { force?: unknown };
    return body.force === true;
  } catch {
    return false;
  }
}
