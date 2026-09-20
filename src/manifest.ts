import { randomUUID } from "node:crypto";
import { DEMO_RUNTIME_ENTRYPOINT, DEMO_RUNTIME_KIND, type CreationTrigger, type ToolManifestV1 } from "./domain.js";
import { assertSafeSessionKey, assertSafeToolName } from "./paths.js";

export function createSessionManifest(input: {
  sessionKey: string;
  name: string;
  description: string;
  trigger?: CreationTrigger;
  runtimeKind?: string;
  entrypoint?: string;
  runtimeConfig?: Record<string, unknown>;
  sourceEntryIds?: string[];
  taskSummary?: string;
}): ToolManifestV1 {
  assertSafeSessionKey(input.sessionKey);
  assertSafeToolName(input.name);
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: randomUUID(),
    name: input.name,
    description: input.description,
    scope: "session",
    createdAt: now,
    updatedAt: now,
    origin: {
      sessionKey: input.sessionKey,
      trigger: input.trigger ?? "manual",
      ...(input.sourceEntryIds ? { sourceEntryIds: input.sourceEntryIds } : {}),
      ...(input.taskSummary ? { taskSummary: input.taskSummary } : {}),
    },
    runtime: {
      kind: input.runtimeKind ?? DEMO_RUNTIME_KIND,
      entrypoint: input.entrypoint ?? DEMO_RUNTIME_ENTRYPOINT,
      ...(input.runtimeConfig ? { config: input.runtimeConfig } : {}),
    },
    safety: {
      declaredSideEffects: [],
      containsSecrets: false,
    },
  };
}
