/**
 * 历史抽屉：按活动日给根会话分桶，并支持标题搜索与每桶截断。
 * fork 子节点不单独入桶，始终挂在父会话下。
 */

export type HistoryDateBucket = "today" | "yesterday" | "last7" | "older";

/** 分组头展示顺序：今天 → 昨天 → 近 7 天 → 更早。 */
export const HISTORY_BUCKET_ORDER: readonly HistoryDateBucket[] = [
  "today",
  "yesterday",
  "last7",
  "older",
];

/** 每个日期桶默认先露出的根会话条数（D23）。 */
export const HISTORY_BUCKET_DEFAULT_CAP = 6;

/** sessionStorage：记住本页已展开的日期桶，刷新后仍展开。 */
export const HISTORY_BUCKET_EXPAND_STORAGE_KEY = "pi-history-bucket-expanded";

export interface HistorySessionLike {
  id: string;
  name?: string;
  firstMessage: string;
  modified: string;
  created?: string;
}

export interface HistoryTreeNode<T extends HistorySessionLike = HistorySessionLike> {
  session: T;
  children: HistoryTreeNode<T>[];
}

export interface HistoryDateGroup<T extends HistorySessionLike = HistorySessionLike> {
  bucket: HistoryDateBucket;
  roots: HistoryTreeNode<T>[];
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * 按本地日历把时间戳分进四个桶。
 * 「近 7 天」= 今天往前 7 个日历日之内、且不是今天/昨天。
 */
export function dateBucketOf(iso: string, now: Date = new Date()): HistoryDateBucket {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return "older";

  const day = startOfLocalDay(stamp);
  const today = startOfLocalDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  if (day === today) return "today";
  if (day === today - dayMs) return "yesterday";
  if (day >= today - 7 * dayMs) return "last7";
  return "older";
}

/** 根会话入桶；子节点跟着根走，不单独分组。 */
export function groupRootsByDate<T extends HistorySessionLike>(
  roots: HistoryTreeNode<T>[],
  now: Date = new Date(),
): HistoryDateGroup<T>[] {
  const buckets: Record<HistoryDateBucket, HistoryTreeNode<T>[]> = {
    today: [],
    yesterday: [],
    last7: [],
    older: [],
  };
  for (const root of roots) {
    const iso = root.session.modified || root.session.created || "";
    buckets[dateBucketOf(iso, now)].push(root);
  }
  return HISTORY_BUCKET_ORDER
    .map((bucket) => ({ bucket, roots: buckets[bucket] }))
    .filter((group) => group.roots.length > 0);
}

export function sessionMatchesQuery(session: HistorySessionLike, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const title = `${session.name ?? ""} ${session.firstMessage ?? ""}`.toLowerCase();
  return title.includes(needle);
}

/**
 * 搜索：节点自身命中则保留整棵子树；仅子孙命中则保留祖先链和命中枝。
 * 空查询原样返回，避免无谓拷贝。
 */
export function filterSessionTreeByQuery<T extends HistorySessionLike>(
  roots: HistoryTreeNode<T>[],
  query: string,
): HistoryTreeNode<T>[] {
  if (!query.trim()) return roots;

  const filterNode = (node: HistoryTreeNode<T>): HistoryTreeNode<T> | null => {
    if (sessionMatchesQuery(node.session, query)) return node;
    const children = node.children
      .map((child) => filterNode(child))
      .filter((child): child is HistoryTreeNode<T> => child !== null);
    if (children.length === 0) return null;
    return { session: node.session, children };
  };

  return roots
    .map((root) => filterNode(root))
    .filter((root): root is HistoryTreeNode<T> => root !== null);
}

/**
 * 空搜索时每桶截断；搜索中取消截断，避免漏掉命中项。
 */
export function sliceBucketRoots<T>(
  roots: T[],
  cap: number,
  expanded: boolean,
  searching: boolean,
): { visible: T[]; hiddenCount: number } {
  if (searching || expanded || roots.length <= cap) {
    return { visible: roots, hiddenCount: 0 };
  }
  return {
    visible: roots.slice(0, cap),
    hiddenCount: roots.length - cap,
  };
}

export function readExpandedHistoryBuckets(): Set<HistoryDateBucket> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HISTORY_BUCKET_EXPAND_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is HistoryDateBucket =>
        item === "today" || item === "yesterday" || item === "last7" || item === "older",
      ),
    );
  } catch {
    return new Set();
  }
}

export function writeExpandedHistoryBuckets(buckets: Set<HistoryDateBucket>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      HISTORY_BUCKET_EXPAND_STORAGE_KEY,
      JSON.stringify([...buckets]),
    );
  } catch {
    // 隐私模式写不进 sessionStorage 时静默，展开状态只活在本次渲染。
  }
}
