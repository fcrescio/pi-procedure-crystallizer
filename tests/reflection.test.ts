import test from "node:test";
import assert from "node:assert/strict";
import { BoundedReflectionEngine, findExplicitFixtureCandidates } from "../src/reflection.js";

const entry = (id: string, content: unknown[]) => ({
  type: "message",
  id,
  message: { role: "assistant", content },
});

test("extracts only explicit bounded fixture creation requests", () => {
  const entries = [
    entry("ignored", [{ type: "text", text: "create a tool for ../secret" }]),
    entry("one", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "docs/report.json" } }]),
    entry("duplicate", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "docs/report.json" } }]),
    entry("other", [{ type: "toolCall", name: "bash", arguments: { command: "session_tool_create" } }]),
  ];

  assert.deepEqual(findExplicitFixtureCandidates(entries), [{ defaultPath: "docs/report.json", sourceEntryId: "one" }]);
});

test("bounded reflection skips overflow and honors cancellation", async () => {
  const calls: string[] = [];
  const engine = new BoundedReflectionEngine({
    materialize: async (candidate) => { calls.push(candidate.defaultPath); },
  });
  const entries = [entry("one", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "fixture.json" } }])];

  await engine.maybeCrystallize({ reason: "overflow", sessionKey: "session-a", branchEntries: entries });
  assert.deepEqual(calls, []);

  const controller = new AbortController();
  controller.abort();
  await engine.maybeCrystallize({ reason: "threshold", sessionKey: "session-a", branchEntries: entries, signal: controller.signal });
  assert.deepEqual(calls, []);
});

test("bounded reflection materializes explicit candidates in order", async () => {
  const calls: string[] = [];
  const engine = new BoundedReflectionEngine({
    materialize: async (candidate) => { calls.push(candidate.defaultPath); },
  });
  const entries = [entry("one", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "a.json" } }]),
    entry("two", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "b.json" } }])];

  await engine.maybeCrystallize({ reason: "threshold", sessionKey: "session-a", branchEntries: entries });
  assert.deepEqual(calls, ["a.json", "b.json"]);
});
