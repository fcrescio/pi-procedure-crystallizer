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
    },
    runtime: {
      kind: input.runtimeKind ?? DEMO_RUNTIME_KIND,
      entrypoint: input.entrypoint ?? DEMO_RUNTIME_ENTRYPOINT,
    },
    safety: {
      declaredSideEffects: [],
      containsSecrets: false,
    },
  };
}
