#!/usr/bin/env node

import { mkdtemp, mkdir, rm } from "node:fs/promises";
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

const args = [
  "--approve",
  "--mode", "rpc",
  "--provider", provider,
  "--model", model,
  "--thinking", thinking,
  "--session-dir", sessionDir,
  "--extension", extension,
];

const child = spawn(piBin, args, {
  cwd: workspace,
  env: {
    ...process.env,
    PI_SESSION_TOOLS_ROOT: artifactRoot,
    PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR ?? workspace,
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const events = [];
const decoder = new StringDecoder("utf8");
let buffer = "";
let nextId = 1;

function consume(chunk) {
  buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
  while (true) {
    const newline = buffer.indexOf("\n");
    if (newline === -1) return;
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const event = JSON.parse(line);
    events.push(event);
    if (["compaction_start", "compaction_end", "tool_execution_end"].includes(event.type)) {
      console.log(JSON.stringify(event));
    }
  }
}

child.stdout.on("data", consume);

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
  await prompt("/tools-create-demo");

  const filler = "Preserve this bounded lifecycle-test marker exactly: SESSION_TOOL_COMPACTION_MARKER. ".repeat(800);
  await prompt(`Read this fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await prompt(`Read this second fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await prompt(`Read this third fixture and reply exactly ACK. Do not call tools. ${filler}`);
  await compact();
  await prompt("Use the session_echo tool exactly once with text compacted-ok, then report only its result.");

  const compacted = events.some(
    (event) => event.type === "compaction_end" && event.aborted === false && typeof event.result?.summary === "string",
  );
  const invoked = events.some((event) => event.type === "tool_execution_end" && event.toolName === "session_echo" && event.isError === false);
  if (!compacted) throw new Error("Pi did not report a completed native compaction; configure a smaller context window");
  if (!invoked) throw new Error("session_echo was not invoked successfully after the lifecycle prompts");
  console.log(JSON.stringify({ ok: true, workspace, sessionDir, artifactRoot }));
} finally {
  child.stdin.end();
  await new Promise((resolve) => child.once("close", resolve));
  if (process.env.KEEP_PI_HARNESS !== "1") await rm(workspace, { recursive: true, force: true });
}
