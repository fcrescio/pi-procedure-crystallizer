import test from "node:test";
import assert from "node:assert/strict";
import { BoundedReflectionEngine, findExplicitFixtureCandidates, findRepeatedReadOnlyBashCandidates, replaceCrystallizedProcedureDetails } from "../src/reflection.js";

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

test("detects repeated read-only procedures but rejects mutating shell", () => {
  const entries = [
    entry("one", [{ type: "toolCall", name: "bash", arguments: { command: "cd /workspace && strings -n 6 libX.so | grep -i ppcs" } }]),
    entry("two", [{ type: "toolCall", name: "bash", arguments: { command: "cd   /workspace &&   strings -n 6 libX.so | grep -i ppcs" } }]),
    entry("mutating", [{ type: "toolCall", name: "bash", arguments: { command: "strings libX.so > report.txt" } }]),
  ];

  assert.deepEqual(findRepeatedReadOnlyBashCandidates(entries), [{
    name: "observed_readonly_procedure_1",
    signature: "strings|grep",
    command: "cd /workspace && strings -n 6 libX.so | grep -i ppcs",
    examples: [
      "cd /workspace && strings -n 6 libX.so | grep -i ppcs",
    ],
    sourceEntryIds: ["one", "two"],
    occurrences: 2,
    reason: "repeated-read-only-command",
  }]);
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

test("bounded reflection forwards repeated procedure candidates", async () => {
  const calls: string[] = [];
  const engine = new BoundedReflectionEngine({
    materialize: async () => {},
    materializeProcedure: async (candidate) => { calls.push(`${candidate.signature}:${candidate.occurrences}`); },
  });
  const entries = [
    entry("one", [{ type: "toolCall", name: "bash", arguments: { command: "strings a.so | grep ppcs" } }]),
    entry("two", [{ type: "toolCall", name: "bash", arguments: { command: "strings b.so | grep dps" } }]),
  ];

  await engine.maybeCrystallize({ reason: "threshold", sessionKey: "session-a", branchEntries: entries });
  assert.deepEqual(calls, ["strings|grep:2"]);
});

test("overflow still scans safe procedures while skipping explicit fixture recovery", async () => {
  const calls: string[] = [];
  const engine = new BoundedReflectionEngine({
    materialize: async () => { calls.push("fixture"); },
    materializeProcedure: async (candidate) => { calls.push(candidate.signature); },
  });
  const entries = [
    entry("one", [{ type: "toolCall", name: "session_tool_create", arguments: { defaultPath: "fixture.txt" } }, { type: "toolCall", name: "bash", arguments: { command: "strings a.so | grep ppcs" } }]),
    entry("two", [{ type: "toolCall", name: "bash", arguments: { command: "strings b.so | grep dps" } }]),
  ];

  await engine.maybeCrystallize({ reason: "overflow", sessionKey: "session-a", branchEntries: entries });
  assert.deepEqual(calls, ["strings|grep"]);
});

test("replaces promoted bash results only in the native compaction preparation", () => {
  const assistant = {
    role: "assistant",
    content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "strings libX.so | grep ppcs" } }],
  };
  const toolResult = {
    role: "toolResult",
    toolCallId: "call-1",
    content: [{ type: "text", text: "a very large native-analysis result" }],
    details: { exitCode: 0 },
  };
  const untouched = { role: "toolResult", toolCallId: "call-2", content: [{ type: "text", text: "keep me" }] };
  const candidate = findRepeatedReadOnlyBashCandidates([
    entry("one", assistant.content),
    entry("two", assistant.content),
  ])[0];

  const replaced = replaceCrystallizedProcedureDetails([assistant, toolResult, untouched], [{ toolName: "native_strings_search", candidate }]);

  assert.equal(replaced, 1);
  assert.match((toolResult.content[0] as { text: string }).text, /Crystallized native_strings_search/);
  assert.equal("details" in toolResult, false);
  assert.equal((untouched.content[0] as { text: string }).text, "keep me");
});
