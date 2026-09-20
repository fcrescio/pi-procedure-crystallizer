#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

const piBin = process.env.PI_BIN ?? "pi";
const extension = path.resolve(process.env.PI_SESSION_TOOLS_EXTENSION ?? "extensions/index.ts");
const provider = process.env.PI_PROVIDER ?? "vllm-local";
const model = process.env.PI_MODEL ?? "qwen3.8-27b";
const thinking = process.env.PI_THINKING ?? "off";
const workspace = await mkdtemp(path.join(os.tmpdir(), "pi-session-tools-harness-"));
const sessionDir = path.join(workspace, "sessions");
const artifactRoot = path.join(workspace, "artifacts");
await mkdir(sessionDir);
await mkdir(artifactRoot);
await writeFile(path.join(workspace, "lifecycle-fixture.json"), '{"kind":"lifecycle-fixture","items":[1,2,3]}\n', "utf8");

const args = [
  "--approve",
  "--mode", "rpc",
  "--provider", provider,
  "--model", model,
  "--thinking", thinking,
  "--session-dir", sessionDir,
  "--extension", extension,
];

const childEnv = {
  ...process.env,
  PI_SESSION_TOOLS_ROOT: artifactRoot,
  PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR ?? workspace,
};

let child;
let events = [];
let nextId = 1;

function attachOutput(process, processEvents) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  const consume = (chunk) => {
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
  while (true) {
    const newline = buffer.indexOf("\n");
    if (newline === -1) return;
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const event = JSON.parse(line);
    processEvents.push(event);
    if (["compaction_start", "compaction_end", "tool_execution_end"].includes(event.type)) {
      console.log(JSON.stringify(event));
    }
  }
  };
  process.stdout.on("data", consume);
}

function startPi(extraArgs = []) {
  const process = spawn(piBin, [...args, ...extraArgs], {
    cwd: workspace,
    env: childEnv,
    stdio: ["pipe", "pipe", "inherit"],
  });
  attachOutput(process, events);
  return process;
}

async function stopPi() {
  if (!child || child.exitCode !== null) return;
  child.stdin.end();
  await new Promise((resolve) => child.once("close", resolve));
}

function send(message) {
  const id = `harness-${nextId++}`;
  child.stdin.write(`${JSON.stringify({ id, ...message })}\n`);
  return id;
}

function waitFor(predicate, fromIndex = 0, timeoutMs = 300_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const match = events.slice(fromIndex).find(predicate);
      if (match) return resolve(match);
      if (Date.now() - started >= timeoutMs) return reject(new Error("Timed out waiting for Pi event"));
      setTimeout(check, 100);
    };
    check();
  });
}

async function prompt(message, streamingBehavior) {
  const fromIndex = events.length;
  const id = send({ type: "prompt", message, ...(streamingBehavior ? { streamingBehavior } : {}) });
  await waitFor((event) => event.type === "response" && event.id === id, fromIndex);
  if (message.startsWith("/")) return;
  await waitFor((event) => event.type === "agent_settled", fromIndex);
}

async function compact() {
  const fromIndex = events.length;
  const id = send({ type: "compact" });
  await waitFor((event) => event.type === "response" && event.id === id, fromIndex);
  await waitFor((event) => event.type === "compaction_end", fromIndex);
}

try {
  child = startPi();
  await prompt("/tools-create-demo");
  await prompt("Call session_tool_create exactly once with defaultPath lifecycle-fixture.json. Do not call any other tool.");

  const filler = "Preserve this bounded lifecycle-test marker exactly: SESSION_TOOL_COMPACTION_MARKER. ".repeat(800);
  const sessionToolDirectory = (await readdir(path.join(artifactRoot, "sessions"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(artifactRoot, "sessions", entry.name, "tools", "fixture_inventory"))[0];
  if (!sessionToolDirectory) throw new Error("Agent-created fixture tool was not persisted");
  // Exercise bounded pre-compaction crystallization: the explicit tool-call remains
  // in branchEntries, while the persisted artifact is recovered by the hook.
  await rm(sessionToolDirectory, { recursive: true, force: true });
  await prompt(`Read this fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await prompt(`Read this second fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await prompt(`Read this third fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await compact();
  await prompt("Use the session_echo tool exactly once with text compacted-ok, then report only its result.");
  await prompt("Use the fixture_inventory tool exactly once with path lifecycle-fixture.json, then report only its result.");

  const compacted = events.some(
    (event) => event.type === "compaction_end" && event.aborted === false && typeof event.result?.summary === "string",
  );
  const invoked = events.some((event) => event.type === "tool_execution_end" && event.toolName === "session_echo" && event.isError === false);
  const created = events.some((event) => event.type === "tool_execution_end" && event.toolName === "session_tool_create" && event.isError === false);
  const inventoried = events.some((event) => event.type === "tool_execution_end" && event.toolName === "fixture_inventory" && event.isError === false);
  if (!compacted) throw new Error("Pi did not report a completed native compaction; configure a smaller context window");
  if (!created) throw new Error("The agent did not create fixture_inventory through session_tool_create");
  if (!invoked) throw new Error("session_echo was not invoked successfully after the lifecycle prompts");
  if (!inventoried) throw new Error("fixture_inventory was not invoked successfully after compaction");
  const recoveredManifest = await (async () => {
    const sessions = await readdir(path.join(artifactRoot, "sessions"), { withFileTypes: true });
    for (const session of sessions.filter((entry) => entry.isDirectory())) {
      const manifestPath = path.join(artifactRoot, "sessions", session.name, "tools", "fixture_inventory", "manifest.json");
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        if (manifest.origin?.trigger === "pre_compaction") return manifest;
      } catch { /* keep searching */ }
    }
    return undefined;
  })();
  if (!recoveredManifest) throw new Error("Pre-compaction crystallization did not recover fixture_inventory");
  const sessionFile = (await readdir(sessionDir)).find((entry) => entry.endsWith(".jsonl"));
  if (!sessionFile) throw new Error("Pi did not persist a session file");

  await stopPi();
  events = [];
  child = startPi(["--session", path.join(sessionDir, sessionFile)]);
  await prompt("/tools test session_echo");
  await prompt("/tools test fixture_inventory");
  const resumed = events.some((event) => JSON.stringify(event).includes("Test passed for session_echo")) &&
    events.some((event) => JSON.stringify(event).includes("Test passed for fixture_inventory"));
  if (!resumed) throw new Error("Resumed session did not restore both session tools");

  await stopPi();
  events = [];
  child = startPi(["--no-session"]);
  await prompt("/tools list");
  const freshListing = events.filter((event) => event.type === "extension_ui_request");
  const leaked = freshListing.some((event) => JSON.stringify(event).includes("session_echo") || JSON.stringify(event).includes("fixture_inventory"));
  if (leaked) throw new Error("Fresh session unexpectedly exposed session_echo");

  console.log(JSON.stringify({ ok: true, workspace, sessionDir, artifactRoot, resumed: true, freshSessionIsolated: true }));
} finally {
  await stopPi();
  if (process.env.KEEP_PI_HARNESS !== "1") await rm(workspace, { recursive: true, force: true });
}
