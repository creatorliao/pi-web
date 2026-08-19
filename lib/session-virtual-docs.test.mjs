import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { extractMessageText, formatSessionHistoryMarkdown } = await import("./session-virtual-docs.ts");

describe("session-virtual-docs", () => {
  it("extracts text from string or text blocks", () => {
    assert.equal(extractMessageText("hello"), "hello");
    assert.equal(extractMessageText([{ type: "text", text: "a" }, { type: "text", text: "b" }]), "a\n\nb");
  });

  it("formats history with user and assistant turns", () => {
    const md = formatSessionHistoryMarkdown({
      sessionId: "abc",
      name: "demo",
      filePath: "/tmp/s.jsonl",
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: [{ type: "text", text: "世界" }], model: "m", provider: "p" },
      ],
    });
    assert.match(md, /^# 完整历史/m);
    assert.match(md, /会话 ID：`abc`/);
    assert.match(md, /## 1\. 用户/);
    assert.match(md, /你好/);
    assert.match(md, /## 2\. 助手（p\/m）/);
    assert.match(md, /世界/);
  });

});
