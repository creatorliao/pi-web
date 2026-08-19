import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  dateBucketOf,
  filterSessionTreeByQuery,
  groupRootsByDate,
  sessionMatchesQuery,
  sliceBucketRoots,
} = await jiti.import("./session-history-groups.ts");

/** 用本地日历构造，避免 CI 时区把「当天」判成昨天。 */
const NOW = new Date(2026, 7, 19, 15, 0, 0);

function isoDaysAgo(days, hour = 12) {
  return new Date(2026, 7, 19 - days, hour, 0, 0).toISOString();
}

function node(id, modified, extras = {}) {
  return {
    session: {
      id,
      firstMessage: extras.firstMessage ?? id,
      name: extras.name,
      modified,
      created: extras.created ?? modified,
    },
    children: extras.children ?? [],
  };
}

test("dateBucketOf splits local calendar days into four buckets", () => {
  assert.equal(dateBucketOf(isoDaysAgo(0, 1), NOW), "today");
  assert.equal(dateBucketOf(isoDaysAgo(1, 23), NOW), "yesterday");
  assert.equal(dateBucketOf(isoDaysAgo(6), NOW), "last7");
  assert.equal(dateBucketOf(isoDaysAgo(7), NOW), "last7");
  assert.equal(dateBucketOf(isoDaysAgo(8), NOW), "older");
  assert.equal(dateBucketOf("not-a-date", NOW), "older");
});

test("groupRootsByDate buckets only roots and keeps fork children with the parent", () => {
  const child = node("child", isoDaysAgo(7), { firstMessage: "fork child" });
  const today = node("today", isoDaysAgo(0, 10), { children: [child] });
  const older = node("older", isoDaysAgo(18, 10));
  const groups = groupRootsByDate([today, older], NOW);

  assert.deepEqual(groups.map((group) => group.bucket), ["today", "older"]);
  assert.equal(groups[0].roots[0].session.id, "today");
  assert.equal(groups[0].roots[0].children[0].session.id, "child");
  assert.equal(groups[1].roots[0].session.id, "older");
});

test("filterSessionTreeByQuery keeps ancestors when only a child matches", () => {
  const child = node("child", isoDaysAgo(0, 10), { name: "界面 Cursor 化" });
  const root = node("root", isoDaysAgo(0, 9), {
    firstMessage: " unrelated ",
    children: [child],
  });
  const other = node("other", isoDaysAgo(0, 8), { firstMessage: "别的话题" });

  const filtered = filterSessionTreeByQuery([root, other], "Cursor");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].session.id, "root");
  assert.equal(filtered[0].children[0].session.id, "child");
});

test("filterSessionTreeByQuery keeps the full subtree when the root title matches", () => {
  const child = node("child", isoDaysAgo(0, 10), { firstMessage: "fork" });
  const root = node("root", isoDaysAgo(0, 9), {
    name: "布局优化",
    children: [child],
  });

  const filtered = filterSessionTreeByQuery([root], "布局");
  assert.equal(filtered[0].children[0].session.id, "child");
});

test("sessionMatchesQuery looks at name and firstMessage", () => {
  assert.equal(sessionMatchesQuery({ id: "1", firstMessage: "hello world", modified: "" }, "WORLD"), true);
  assert.equal(sessionMatchesQuery({ id: "1", name: "FineBar", firstMessage: "", modified: "" }, "fine"), true);
  assert.equal(sessionMatchesQuery({ id: "1", firstMessage: "nope", modified: "" }, "yes"), false);
  assert.equal(sessionMatchesQuery({ id: "1", firstMessage: "nope", modified: "" }, "  "), true);
});

test("sliceBucketRoots hides extras unless expanded or searching", () => {
  const roots = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(sliceBucketRoots(roots, 6, false, false), {
    visible: [1, 2, 3, 4, 5, 6],
    hiddenCount: 2,
  });
  assert.deepEqual(sliceBucketRoots(roots, 6, true, false), {
    visible: roots,
    hiddenCount: 0,
  });
  assert.deepEqual(sliceBucketRoots(roots, 6, false, true), {
    visible: roots,
    hiddenCount: 0,
  });
  assert.deepEqual(sliceBucketRoots([1, 2], 6, false, false), {
    visible: [1, 2],
    hiddenCount: 0,
  });
});
