import { randomUUID } from "node:crypto";
import type { CreationTrigger, ToolManifestV1 } from "./domain.js";
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
      kind: input.runtimeKind ?? "demo",
      entrypoint: input.entrypoint ?? "builtin:session_echo",
    },
    safety: {
      declaredSideEffects: [],
      containsSecrets: false,
    },
  };
}
