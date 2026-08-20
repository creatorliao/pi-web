export interface InitialNavigation {
  requestedCwd: string | null;
  sessionId: string | null;
}

/**
 * URL 深链与 AppShell 相位的关系：
 * - 无 query → welcome-*（闸门）
 * - ?cwd= → deeplink-validating / deeplink-error / ready（有 cwd 时忽略 session）
 * - ?session= → 直达 ready，找不到则回 welcome
 * 进入后不要 replace(?cwd=)，否则刷新会跳过欢迎闸门。
 */
export function getInitialNavigation(searchParams: Pick<URLSearchParams, "get">): InitialNavigation {
  const requestedCwd = searchParams.get("cwd")?.trim() || null;

  return {
    requestedCwd,
    sessionId: requestedCwd ? null : searchParams.get("session"),
  };
}
