/**
 * 把家目录前缀收成 ~，不做截断。左侧省略由 PathLabel 负责。
 * 从 SessionSidebar 抽出，欢迎卡与侧栏共用同一套缩短规则。
 */
export function displayCwd(cwd: string, homeDir?: string): string {
  return (homeDir && cwd.startsWith(homeDir)) ? `~${cwd.slice(homeDir.length)}` : cwd;
}
