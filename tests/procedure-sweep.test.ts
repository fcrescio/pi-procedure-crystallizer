import test from "node:test";
import assert from "node:assert/strict";
import { buildProcedureSweepPrompt, collectBashProcedureRecords, extractJsonObject, parseProcedureSweepResponse, validateGeneratedImplementation } from "../src/procedure-sweep.js";

test("extracts fenced JSON with braces inside strings", () => {
  const text = "Here is the result:\n```json\n{\"candidates\":[],\"note\":\"brace } inside\"}\n```";
  assert.equal(extractJsonObject(text), '{"candidates":[],"note":"brace } inside"}');
});

test("validates candidates and ignores model-only review fields", () => {
  const result = parseProcedureSweepResponse(`
    {"candidates":[{"name":"apk_inventory","purpose":"Inventory an APK","parameters":[{"name":"path","type":"path","required":true,"description":"APK path"}],"evidenceEntryIds":["e1"],"observedOperations":["unzip"],"examples":["unzip -l $APK"],"confidence":"high","safeRuntimePlan":"bounded read-only runtime","implementation":"export async function run(input, context) { return { path: input.path, cwd: context.cwd }; }","needsHumanReview":false}],"rejected":[]}
  `, new Set(["e1"]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.response?.candidates[0]?.name, "apk_inventory");
  assert.equal("needsHumanReview" in (result.response?.candidates[0] ?? {}), false);
});

test("rejects unknown provenance and malformed parameters", () => {
  const result = parseProcedureSweepResponse(JSON.stringify({
    candidates: [{ name: "bad", purpose: "bad", parameters: [{ name: "x", type: "shell", required: true, description: "x" }], evidenceEntryIds: ["missing"], observedOperations: [], examples: [], confidence: "high", safeRuntimePlan: "run it", implementation: "export async function run(input, context) { return fetch(input.url); }" }],
    rejected: [],
  }), new Set(["known"]));
  assert.equal(result.response?.candidates.length, 0);
  assert.ok(result.errors.some(error => error.includes("unknown evidence entry")));
  assert.ok(result.errors.some(error => error.includes("type is invalid")));
});

test("rejects generated network, credential, and shell capabilities", () => {
  const errors = validateGeneratedImplementation("export async function run(input, context) { return fetch(process.env.TOKEN); }");
  assert.ok(errors.some(error => error.includes("forbidden capability")));
});

test("does not confuse a safe parameter name with require()", () => {
  const errors = validateGeneratedImplementation(`
    import { readFile } from "node:fs/promises";
    export async function run(input, context) {
      const requireReferenceOnly = input.requireReferenceOnly ?? false;
      return { requireReferenceOnly, text: await readFile(input.path, "utf8") };
    }
  `);
  assert.deepEqual(errors, []);
});

test("collects bounded bash calls and pairs bounded results", () => {
  const entries = [
    { type: "message", id: "a", message: { role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "python3 - <<'PY'\nprint(1)\nPY" } }] } },
    { type: "message", id: "r", message: { role: "toolResult", toolCallId: "call-1", content: [{ type: "text", text: "result" }] } },
  ];
  const records = collectBashProcedureRecords(entries);
  assert.deepEqual(records, [{ entryId: "a", command: "python3 - <<'PY'\nprint(1)\nPY", result: "result" }]);
  assert.match(buildProcedureSweepPrompt(records), /ephemeral inline scripts/);
});
