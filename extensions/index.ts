import os from "node:os";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
  DEMO_RUNTIME_ENTRYPOINT,
  DEMO_RUNTIME_KIND,
  FIXTURE_RUNTIME_ENTRYPOINT,
  FIXTURE_RUNTIME_KIND,
  type StoredTool,
} from "../src/domain.js";
import { createSessionManifest } from "../src/manifest.js";
import { assertSafeSessionKey } from "../src/paths.js";
import { NoopReflectionEngine } from "../src/reflection.js";
import { ArtifactStore } from "../src/store.js";

const DEMO_PARAMETERS = Type.Object({
  text: Type.String({ description: "Text to echo deterministically" }),
});

type DemoParameters = { text: string };
const FIXTURE_PARAMETERS = Type.Object({
  path: Type.String({ description: "Workspace-relative fixture path" }),
});
type FixtureParameters = { path: string };
const CREATE_TOOL_PARAMETERS = Type.Object({
  defaultPath: Type.String({ description: "Workspace-relative fixture path used by the new session tool" }),
});
type CreateToolParameters = { defaultPath: string };
const MAX_FIXTURE_BYTES = 128 * 1024;

function artifactRoot(): string {
  return path.resolve(
    process.env.PI_SESSION_TOOLS_ROOT ??
      path.join(process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent"), "session-tools"),
  );
}

function currentSessionKey(ctx: ExtensionContext): string {
  const sessionKey = ctx.sessionManager.getSessionId();
  assertSafeSessionKey(sessionKey);
  return sessionKey;
}

function isDemoTool(tool: StoredTool): boolean {
  return tool.manifest.runtime.kind === DEMO_RUNTIME_KIND && tool.manifest.runtime.entrypoint === DEMO_RUNTIME_ENTRYPOINT;
}

function isFixtureTool(tool: StoredTool): boolean {
  return tool.manifest.runtime.kind === FIXTURE_RUNTIME_KIND && tool.manifest.runtime.entrypoint === FIXTURE_RUNTIME_ENTRYPOINT;
}

function demoTool(tool: StoredTool): ToolDefinition<typeof DEMO_PARAMETERS> {
  return {
    name: tool.manifest.name,
    label: tool.manifest.name,
    description: tool.manifest.description,
    promptSnippet: "Echo text through a deterministic session-scoped demo tool",
    parameters: DEMO_PARAMETERS,
    async execute(_toolCallId, params: DemoParameters) { return executeDemo(tool, params.text); },
  };
}

function executeDemo(tool: StoredTool, text: string) {
  return {
    content: [{ type: "text" as const, text: `session_echo: ${text}` }],
    details: {
      artifactId: tool.manifest.id,
      scope: tool.manifest.scope,
      originSession: tool.manifest.origin.sessionKey,
    },
  };
}

async function executeFixture(tool: StoredTool, params: FixtureParameters, ctx: ExtensionContext) {
  assertSafeFixturePath(params.path);
  const fixturePath = path.resolve(ctx.cwd, params.path);
  const relative = path.relative(ctx.cwd, fixturePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Fixture path escapes the workspace");
  const info = await stat(fixturePath);
  if (!info.isFile()) throw new Error("Fixture path must identify a regular file");
  if (info.size > MAX_FIXTURE_BYTES) throw new Error(`Fixture exceeds ${MAX_FIXTURE_BYTES} byte limit`);
  const text = await readFile(fixturePath, "utf8");
  const lines = text.length === 0 ? 0 : text.split(/\r?\n/u).length;
  let jsonKind = "not-json";
  try {
    const parsed: unknown = JSON.parse(text);
    jsonKind = Array.isArray(parsed) ? "array" : parsed !== null && typeof parsed === "object" ? "object" : typeof parsed;
  } catch {
    // Inventory remains useful for raw captures and other non-JSON fixtures.
  }
  return {
    content: [{ type: "text" as const, text: `fixture_inventory: ${path.relative(ctx.cwd, fixturePath)} bytes=${info.size} lines=${lines} json=${jsonKind}` }],
    details: { artifactId: tool.manifest.id, scope: tool.manifest.scope, originSession: tool.manifest.origin.sessionKey },
  };
}

function fixtureTool(tool: StoredTool): ToolDefinition<typeof FIXTURE_PARAMETERS> {
  return {
    name: tool.manifest.name,
    label: tool.manifest.name,
    description: tool.manifest.description,
    promptSnippet: "Inventory a bounded workspace-relative fixture without modifying it",
    parameters: FIXTURE_PARAMETERS,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeFixture(tool, params, ctx);
    },
  };
}

function isSupportedTool(tool: StoredTool): boolean {
  return isDemoTool(tool) || isFixtureTool(tool);
}

function assertSafeFixturePath(value: string): void {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/u).includes("..")) {
    throw new Error("Fixture path must be non-empty, workspace-relative, and cannot traverse parent directories");
  }
}

function formatTool(tool: StoredTool): string {
  const { manifest } = tool;
  return `${manifest.name} [${manifest.scope}] — ${manifest.description} — ${tool.directory}`;
}

function formatReview(tool: StoredTool): string {
  const { manifest } = tool;
  const runnable = isDemoTool(tool) || isFixtureTool(tool) ? "runnable" : "unsupported-runtime";
  const effects = manifest.safety.declaredSideEffects.length > 0 ? manifest.safety.declaredSideEffects.join(", ") : "none";
  const dependencies = manifest.runtime.dependencies?.join(", ") || "none";
  return [
    `${manifest.name} [${manifest.scope}] — ${runnable}`,
    `  description: ${manifest.description}`,
    `  origin: ${manifest.origin.trigger} / ${manifest.origin.sessionKey}`,
    `  side effects: ${effects}`,
    `  dependencies: ${dependencies}`,
    `  secrets: ${manifest.safety.containsSecrets ? "declared" : "none declared"}`,
    `  artifact: ${tool.directory}`,
  ].join("\n");
}

async function notifyList(ctx: ExtensionCommandContext, store: ArtifactStore, sessionKey: string): Promise<void> {
  const sessionTools = await store.listSession(sessionKey);
  const globalTools = await store.listGlobal();
  const lines = [
    `Session ${sessionKey}:`,
    ...(sessionTools.length > 0 ? sessionTools.map(formatTool) : ["(none)"]),
    "",
    "Global tools available:",
    ...(globalTools.length > 0 ? globalTools.map(formatTool) : ["(none)"]),
  ];
  ctx.ui.notify(lines.join("\n"), "info");
}

async function requireConfirmation(ctx: ExtensionCommandContext, title: string, message: string): Promise<boolean> {
  if (!ctx.hasUI) {
    ctx.ui.notify(`${title} requires interactive confirmation.`, "warning");
    return false;
  }
  return ctx.ui.confirm(title, message);
}

export default function sessionToolsExtension(pi: ExtensionAPI) {
  const store = new ArtifactStore({ root: artifactRoot() });
  const reflection = new NoopReflectionEngine();

  const registerStoredTool = (tool: StoredTool): boolean => {
    if (isDemoTool(tool)) pi.registerTool(demoTool(tool));
    else if (isFixtureTool(tool)) pi.registerTool(fixtureTool(tool));
    else return false;
    return true;
  };

  pi.registerTool({
    name: "session_tool_create",
    label: "session_tool_create",
    description: "Create a session-scoped bounded fixture_inventory tool. Never promotes anything globally.",
    promptSnippet: "Create a session-scoped read-only fixture inventory tool",
    parameters: CREATE_TOOL_PARAMETERS,
    async execute(_toolCallId, params: CreateToolParameters, _signal, _onUpdate, ctx) {
      assertSafeFixturePath(params.defaultPath);
      const sessionKey = currentSessionKey(ctx);
      const existing = (await store.listSession(sessionKey)).find((tool) => tool.manifest.name === "fixture_inventory");
      if (existing) {
        return {
          content: [{ type: "text" as const, text: "fixture_inventory already exists in this session" }],
          details: { artifactId: existing.manifest.id, scope: existing.manifest.scope },
        };
      }
      const stored = await store.putSessionManifest(
        sessionKey,
        createSessionManifest({
          sessionKey,
          name: "fixture_inventory",
          description: "Inventory one bounded workspace-relative fixture without modifying it.",
          trigger: "agent",
          runtimeKind: FIXTURE_RUNTIME_KIND,
          entrypoint: FIXTURE_RUNTIME_ENTRYPOINT,
          runtimeConfig: { defaultPath: params.defaultPath },
        }),
      );
      registerStoredTool(stored);
      return {
        content: [{ type: "text" as const, text: `Created session-scoped fixture_inventory for ${params.defaultPath}` }],
        details: { artifactId: stored.manifest.id, scope: stored.manifest.scope, directory: stored.directory },
      };
    },
  });

  const restoreTools = async (ctx: ExtensionContext): Promise<void> => {
    const sessionKey = currentSessionKey(ctx);
    const globalTools = (await store.listGlobal()).filter(isSupportedTool);
    const sessionTools = (await store.listSession(sessionKey)).filter(isSupportedTool);
    const registered = new Set<string>();

    for (const tool of globalTools) {
      if (registered.has(tool.manifest.name)) continue;
      registerStoredTool(tool);
      registered.add(tool.manifest.name);
    }
    for (const tool of sessionTools) {
      if (registered.has(tool.manifest.name)) continue;
      registerStoredTool(tool);
      registered.add(tool.manifest.name);
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    try {
      await restoreTools(ctx);
    } catch (error) {
      ctx.ui.notify(`Session tools restore skipped: ${String(error)}`, "warning");
    }
  });

  pi.registerCommand("tools", {
    description: "List, inspect, delete, and explicitly promote session tools",
    handler: async (args, ctx) => {
      const [command = "list", name] = args.trim().split(/\s+/);
      const sessionKey = currentSessionKey(ctx);

      try {
        if (command === "list") {
          await notifyList(ctx, store, sessionKey);
          return;
        }
        if (command === "review") {
          const sessionTools = await store.listSession(sessionKey);
          const globalTools = await store.listGlobal();
          const tools = [...sessionTools, ...globalTools];
          ctx.ui.notify(
            tools.length > 0 ? tools.map(formatReview).join("\n\n") : "No session or global tools to review.",
            "info",
          );
          return;
        }
        if (command === "test" && name) {
          let tool: StoredTool;
          try {
            tool = await store.readSession(sessionKey, name);
          } catch {
            const global = (await store.listGlobal()).find((candidate) => candidate.manifest.name === name);
            if (!global) throw new Error(`Tool not found: ${name}`);
            tool = global;
          }
          if (!isSupportedTool(tool)) throw new Error(`Tool ${name} has no supported deterministic test runtime`);
          const result = isDemoTool(tool)
            ? executeDemo(tool, "tools-test")
            : await executeFixture(tool, { path: String(tool.manifest.runtime.config?.defaultPath ?? "") }, ctx);
          ctx.ui.notify(`Test passed for ${name}: ${result.content[0]?.type === "text" ? result.content[0].text : "ok"}`, "info");
          return;
        }
        if (command === "inspect" && name) {
          const tool = await store.readSession(sessionKey, name);
          ctx.ui.notify(JSON.stringify({ ...tool.manifest, artifactDirectory: tool.directory }, null, 2), "info");
          return;
        }
        if (command === "delete" && name) {
          const tool = await store.readSession(sessionKey, name);
          if (await requireConfirmation(ctx, "Delete session tool", `Delete ${tool.manifest.name} from this session?`)) {
            await store.deleteSession(sessionKey, name);
            pi.setActiveTools(pi.getActiveTools().filter((toolName) => toolName !== name));
            ctx.ui.notify(`Deleted session tool ${name}.`, "info");
          }
          return;
        }
        if (command === "promote" && name) {
          const tool = await store.readSession(sessionKey, name);
          const approved = await requireConfirmation(
            ctx,
            "Promote session tool",
            `Copy ${name} to the global store? Future sessions will be able to load it.`,
          );
          if (approved) {
            const promoted = await store.promote(sessionKey, name, true);
            registerStoredTool(promoted);
            ctx.ui.notify(`Promoted ${name} to ${promoted.directory}.`, "info");
          }
          return;
        }
        ctx.ui.notify("Usage: /tools list | review | test <name> | inspect <name> | delete <name> | promote <name>", "warning");
      } catch (error) {
        ctx.ui.notify(`Tools command failed: ${String(error)}`, "error");
      }
    },
  });

  pi.registerCommand("tools-create-demo", {
    description: "Create the deterministic session_echo demo tool for this session",
    handler: async (_args, ctx) => {
      try {
        const sessionKey = currentSessionKey(ctx);
        const existing = await store.listSession(sessionKey);
        if (existing.some((tool) => tool.manifest.name === "session_echo")) {
          ctx.ui.notify("Session tool session_echo already exists.", "info");
          return;
        }
        const stored = await store.putSessionManifest(
          sessionKey,
          createSessionManifest({
            sessionKey,
            name: "session_echo",
            description: "Echo text deterministically; first lifecycle demo tool.",
          }),
        );
        registerStoredTool(stored);
        ctx.ui.notify(`Created and registered session_echo at ${stored.directory}.`, "info");
      } catch (error) {
        ctx.ui.notify(`Demo tool creation failed: ${String(error)}`, "error");
      }
    },
  });

  pi.registerCommand("tools-create-fixture-inventory", {
    description: "Create a bounded read-only fixture inventory session tool",
    handler: async (args, ctx) => {
      try {
        const defaultPath = args.trim();
        assertSafeFixturePath(defaultPath);
        const sessionKey = currentSessionKey(ctx);
        const stored = await store.putSessionManifest(
          sessionKey,
          createSessionManifest({
            sessionKey,
            name: "fixture_inventory",
            description: "Inventory one bounded workspace-relative fixture without modifying it.",
            runtimeKind: FIXTURE_RUNTIME_KIND,
            entrypoint: FIXTURE_RUNTIME_ENTRYPOINT,
            runtimeConfig: { defaultPath },
          }),
        );
        registerStoredTool(stored);
        ctx.ui.notify(`Created and registered fixture_inventory at ${stored.directory}.`, "info");
      } catch (error) {
        ctx.ui.notify(`Fixture tool creation failed: ${String(error)}`, "error");
      }
    },
  });

  pi.on("session_before_compact", async (event, ctx) => {
    try {
      await reflection.maybeCrystallize({
        reason: event.reason,
        sessionKey: currentSessionKey(ctx),
        signal: event.signal,
      });
    } catch (error) {
      ctx.ui.notify(`Session-tool reflection skipped: ${String(error)}`, "warning");
    }
    // No return value: Pi's native compaction remains in control.
  });
}
