/**
 * 欢迎页「是否已有模型」探测。禁止打 GET /api/models（依赖已放行 cwd）。
 * 失败一律当作 unknown，避免把「还不知道」画成「第一次用」。
 */

export type ModelsReady = boolean | "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * models.json 是否已声明至少一个非空 model id。
 * @param data GET /api/models-config 的 JSON
 */
export function modelsConfigHasModel(data: unknown): boolean {
  if (!isRecord(data) || !isRecord(data.providers)) return false;
  return Object.values(data.providers).some((provider) => {
    if (!isRecord(provider) || !Array.isArray(provider.models)) return false;
    return provider.models.some((model) => (
      isRecord(model) && typeof model.id === "string" && model.id.trim().length > 0
    ));
  });
}

/**
 * 按 05 §4.1：先看 models-config，再并行两个 auth 列表。
 * 任一请求失败且尚未得到 true → unknown。
 */
export async function probeModelsReady(): Promise<ModelsReady> {
  try {
    const configRes = await fetch("/api/models-config");
    if (!configRes.ok) return "unknown";
    const configData: unknown = await configRes.json();
    if (modelsConfigHasModel(configData)) return true;
  } catch {
    return "unknown";
  }

  try {
    const [apiKeyRes, oauthRes] = await Promise.all([
      fetch("/api/auth/all-providers"),
      fetch("/api/auth/providers"),
    ]);
    if (!apiKeyRes.ok || !oauthRes.ok) return "unknown";
    const apiKeyData = await apiKeyRes.json() as { providers?: Array<{ configured?: boolean }> };
    const oauthData = await oauthRes.json() as { providers?: Array<{ loggedIn?: boolean }> };
    const configured = (apiKeyData.providers ?? []).some((provider) => provider.configured === true);
    const loggedIn = (oauthData.providers ?? []).some((provider) => provider.loggedIn === true);
    return configured || loggedIn;
  } catch {
    return "unknown";
  }
}
