export interface ReflectionInput {
  reason: "manual" | "threshold" | "overflow" | string;
  sessionKey: string;
  cwd?: string;
  branchEntries?: readonly unknown[];
  signal?: AbortSignal;
}

export interface ReflectionEngine {
  maybeCrystallize(input: ReflectionInput): Promise<void>;
}

export interface ExplicitFixtureCandidate {
  defaultPath: string;
  sourceEntryId?: string;
}

const MAX_SCAN_ENTRIES = 64;
const MAX_CANDIDATES = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** Extract only explicit agent requests for the bounded declarative runtime. */
export function findExplicitFixtureCandidates(entries: readonly unknown[], maxEntries = MAX_SCAN_ENTRIES): ExplicitFixtureCandidate[] {
  const output: ExplicitFixtureCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of entries.slice(-maxEntries)) {
    if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
    const message = entry.message;
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!isRecord(part) || part.type !== "toolCall" || part.name !== "session_tool_create") continue;
      const args = isRecord(part.arguments) ? part.arguments : undefined;
      const defaultPath = args?.defaultPath;
      if (typeof defaultPath !== "string" || seen.has(defaultPath)) continue;
      seen.add(defaultPath);
      output.push({
        defaultPath,
        ...(typeof entry.id === "string" ? { sourceEntryId: entry.id } : {}),
      });
      if (output.length >= MAX_CANDIDATES) return output;
    }
  }
  return output;
}

export interface BoundedReflectionOptions {
  materialize: (candidate: ExplicitFixtureCandidate, input: ReflectionInput) => Promise<void>;
}

/**
 * Safe first crystallizer: it only reifies explicit session_tool_create calls.
 * It never asks an LLM for code and never replaces native compaction.
 */
export class BoundedReflectionEngine implements ReflectionEngine {
  constructor(private readonly options: BoundedReflectionOptions) {}

  async maybeCrystallize(input: ReflectionInput): Promise<void> {
    if (input.reason === "overflow" || input.signal?.aborted || !input.branchEntries) return;
    for (const candidate of findExplicitFixtureCandidates(input.branchEntries)) {
      if (input.signal?.aborted) return;
      await this.options.materialize(candidate, input);
    }
  }
}

/** Kept as a small test/dev fallback for callers that do not want crystallization. */
export class NoopReflectionEngine implements ReflectionEngine {
  async maybeCrystallize(_input: ReflectionInput): Promise<void> {
    return;
  }
}
