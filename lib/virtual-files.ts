/** 客户端虚拟文档路径前缀。不对应磁盘，FileViewer 不得请求 /api/files。 */
export const VIRTUAL_FILE_SCHEME = "pi-virtual://";

export type VirtualDocKind = "history" | "system";

/**
 * 判断文件区标签是否为虚拟文档。
 */
export function isVirtualFilePath(filePath: string): boolean {
  return filePath.startsWith(VIRTUAL_FILE_SCHEME);
}

/**
 * 拼虚拟 Markdown 路径。后缀固定 .md，以便预览走 markdown。
 */
export function virtualDocPath(kind: VirtualDocKind, sessionId: string): string {
  return `${VIRTUAL_FILE_SCHEME}${kind}/${sessionId}.md`;
}
