import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { projectIdentityKey } = await jiti.import("./project-identity.ts");
const {
  arrangeWorkspaceCards,
  getProjectActivity,
  getRecentProjects,
  sessionsForProject,
  toWorkspaceCards,
} = await jiti.import("./project-groups.ts");

function session(id, projectRoot, modified) {
  return {
    id,
    path: `${id}.jsonl`,
    cwd: projectRoot,
    projectRoot,
    projectKey: projectIdentityKey(projectRoot, "win32"),
    created: modified,
    modified,
    messageCount: 1,
    firstMessage: id,
  };
}

test("Windows path variants form one recent project using the newest display path", () => {
  const older = session("older", "C:\\Users\\Alex\\Project\\Study\\ELM", "2026-08-12T00:00:00.000Z");
  const newer = session("newer", "c:/users/ALEX/project/study/elm", "2026-08-13T00:00:00.000Z");

  assert.deepEqual(getRecentProjects([older, newer]), [{
    key: older.projectKey,
    root: newer.projectRoot,
  }]);
});

test("project filtering includes every session with the stable identity", () => {
  const first = session("first", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  const second = session("second", "c:/users/alex/project/", "2026-08-13T00:00:00.000Z");
  const other = session("other", "D:\\Elsewhere", "2026-08-13T01:00:00.000Z");

  assert.deepEqual(
    sessionsForProject([first, second, other], first.projectKey).map((item) => item.id),
    ["first", "second"],
  );
});

test("running and unread counts aggregate under the stable project identity", () => {
  const first = session("first", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  const second = session("second", "c:/users/alex/project/", "2026-08-13T00:00:00.000Z");

  const activity = getProjectActivity(
    [first, second],
    new Set(["first", "second"]),
    new Set(["second"]),
  );

  assert.deepEqual(activity.get(first.projectKey), { running: 2, unread: 1 });
  assert.equal(activity.size, 1);
});

test("toWorkspaceCards keeps getRecentProjects order and counts sessions", () => {
  const first = session("first", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  const second = session("second", "c:/users/alex/project/", "2026-08-13T00:00:00.000Z");
  const other = session("other", "D:\\Elsewhere", "2026-08-13T01:00:00.000Z");

  const cards = toWorkspaceCards([first, second, other], "C:\\Users\\Alex");
  assert.equal(cards[0].key, other.projectKey);
  assert.equal(cards[0].name, "Elsewhere");
  assert.equal(cards[0].sessionCount, 1);
  assert.equal(cards[1].sessionCount, 2);
  assert.equal(cards[1].lastModified, second.modified);
});

test("getRecentProjects skips folders the server marked missing", () => {
  const gone = session("gone", "D:\\Deleted", "2026-08-13T01:00:00.000Z");
  gone.directoryExists = false;
  const kept = session("kept", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z");
  kept.directoryExists = true;
  assert.deepEqual(getRecentProjects([gone, kept]).map((item) => item.root), [kept.projectRoot]);
});

test("arrangeWorkspaceCards pins stars then recents and drops hidden", () => {
  const cards = toWorkspaceCards([
    session("first", "C:\\Users\\Alex\\Project", "2026-08-12T00:00:00.000Z"),
    session("other", "D:\\Elsewhere", "2026-08-13T01:00:00.000Z"),
    session("old", "E:\\Pinned", "2026-08-01T00:00:00.000Z"),
  ]);
  const pinned = cards.find((card) => card.name === "Pinned");
  const elsewhere = cards.find((card) => card.name === "Elsewhere");
  const arranged = arrangeWorkspaceCards(cards, {
    starredKeys: [pinned.key],
    hiddenKeys: [elsewhere.key],
  });
  assert.deepEqual(arranged.map((card) => card.name), ["Pinned", "Project"]);
});
