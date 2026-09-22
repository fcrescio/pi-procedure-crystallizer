export type ToolScope = "session" | "global";
export type CreationTrigger = "manual" | "pre_compaction" | "agent" | "import";

export interface ToolManifestV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  scope: ToolScope;
  createdAt: string;
  updatedAt: string;
  origin: {
    sessionKey: string;
    trigger: CreationTrigger;
    sourceEntryIds?: string[];
    taskSummary?: string;
  };
  runtime: {
    kind: string;
    entrypoint: string;
    config?: Record<string, unknown>;
    dependencies?: string[];
  };
  safety: {
    declaredSideEffects: string[];
    containsSecrets: false;
  };
  promotedFrom?: {
    sessionKey: string;
    artifactId: string;
    promotedAt: string;
  };
}

export interface StoredTool {
  manifest: ToolManifestV1;
  directory: string;
}

export const DEMO_RUNTIME_KIND = "demo";
export const DEMO_RUNTIME_ENTRYPOINT = "builtin:session_echo";
export const FIXTURE_RUNTIME_KIND = "fixture";
export const FIXTURE_RUNTIME_ENTRYPOINT = "builtin:fixture_inventory";
export const STRINGS_RUNTIME_KIND = "native-analysis";
export const STRINGS_RUNTIME_ENTRYPOINT = "builtin:native_strings_search";
export const GENERATED_RUNTIME_KIND = "generated-procedure";
export const GENERATED_RUNTIME_ENTRYPOINT = "builtin:generated_procedure";
