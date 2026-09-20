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
