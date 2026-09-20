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

export interface ProcedureCandidate {
  name: string;
  signature: string;
  command: string;
  examples: string[];
  sourceEntryIds: string[];
  occurrences: number;
  reason: "repeated-read-only-command";
}

export interface CrystallizedProcedure {
  toolName: string;
  candidate: ProcedureCandidate;
}

const MAX_SCAN_ENTRIES = 64;
const MAX_CANDIDATES = 4;
const MAX_PROCEDURE_CANDIDATES = 8;

const READ_ONLY_COMMAND = /\b(?:sha256sum|stat|file|find|grep|rg|readelf|strings|od|xxd|7z\s+l)\b/u;
const MUTATING_SHELL = /(?:^|[;&|])\s*(?:rm|mv|cp|mkdir|rmdir|touch|chmod|chown|sed\s+-i|dd\b[^\n]*\bof=|apktool\s+d|jadx\b[^\n]*\s+-d\s)|>>?|<(?!=)/u;
const UNSAFE_INTERPRETER = /(?:^|[;&|])\s*(?:python(?:3)?|node|perl|ruby|bash|sh|zsh|eval)\b/u;

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/gu, " ");
}

function commandSignature(command: string): string {
  const verbs = [...normalizeCommand(command).matchAll(/\b(sha256sum|stat|file|find|grep|rg|readelf|strings|od|xxd|7z|head|sort|sed|awk)\b/gu)]
    .map((match) => match[1])
    .filter((verb) => verb !== "head" && verb !== "sort" && verb !== "sed" && verb !== "awk");
  return [...new Set(verbs)].join("|");
}

/**
 * Replace verbose messages for procedures already materialized as safe session
 * tools. This mutates only Pi's in-memory compaction preparation; the immutable
 * JSONL session history is never rewritten.
 */
export function replaceCrystallizedProcedureDetails(
  messages: unknown[],
  procedures: readonly CrystallizedProcedure[],
): number {
  if (procedures.length === 0) return 0;
  const bySignature = new Map(procedures.map((procedure) => [procedure.candidate.signature, procedure]));
  const toolCallIds = new Map<string, CrystallizedProcedure>();
  let replacements = 0;

  for (const message of messages) {
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!isRecord(part) || part.type !== "toolCall" || part.name !== "bash") continue;
      const args = isRecord(part.arguments) ? part.arguments : undefined;
      const command = typeof args?.command === "string" ? args.command : undefined;
      if (!command) continue;
      const procedure = bySignature.get(commandSignature(command));
      if (!procedure || typeof part.id !== "string") continue;
      toolCallIds.set(part.id, procedure);
    }
  }

  for (const message of messages) {
    if (!isRecord(message) || message.role !== "toolResult" || typeof message.toolCallId !== "string") continue;
    const procedure = toolCallIds.get(message.toolCallId);
    if (!procedure) continue;
    message.content = [{
      type: "text",
      text: crystallizationMarker(procedure),
    }];
    delete message.details;
    replacements++;
  }
  return replacements;
}

function crystallizationMarker(procedure: CrystallizedProcedure): string {
  const { candidate } = procedure;
  return `[pi-session-tools] Crystallized ${procedure.toolName}: repeated read-only ${candidate.signature} procedure observed ${candidate.occurrences} times. Use the session-scoped tool instead; original command results remain in the immutable session log. Example: ${candidate.command}`;
}

/** Find repeated, conservative read-only shell procedures without an LLM. */
export function findRepeatedReadOnlyBashCandidates(
  entries: readonly unknown[],
  maxEntries = MAX_SCAN_ENTRIES,
): ProcedureCandidate[] {
  const grouped = new Map<string, { command: string; examples: string[]; sourceEntryIds: string[] }>();
  for (const entry of entries.slice(-maxEntries)) {
    if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
    const message = entry.message;
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!isRecord(part) || part.type !== "toolCall" || part.name !== "bash") continue;
      const args = isRecord(part.arguments) ? part.arguments : undefined;
      const command = args?.command;
      if (typeof command !== "string") continue;
      const normalized = normalizeCommand(command);
      if (!READ_ONLY_COMMAND.test(normalized) || MUTATING_SHELL.test(normalized) || UNSAFE_INTERPRETER.test(normalized)) continue;
      const signature = commandSignature(normalized);
      const item = grouped.get(signature) ?? { command: normalized, examples: [], sourceEntryIds: [] };
      if (typeof entry.id === "string" && !item.sourceEntryIds.includes(entry.id)) item.sourceEntryIds.push(entry.id);
      if (item.examples.length < 3 && !item.examples.includes(normalized)) item.examples.push(normalized);
      grouped.set(signature, item);
    }
  }
  return [...grouped.values()]
    .filter((item) => item.sourceEntryIds.length >= 2)
    .sort((a, b) => b.sourceEntryIds.length - a.sourceEntryIds.length)
    .slice(0, MAX_PROCEDURE_CANDIDATES)
    .map((item, index) => ({
      name: `observed_readonly_procedure_${index + 1}`,
      signature: [...grouped.entries()].find(([, value]) => value === item)?.[0] ?? "unknown",
      command: item.command,
      examples: item.examples,
      sourceEntryIds: item.sourceEntryIds,
      occurrences: item.sourceEntryIds.length,
      reason: "repeated-read-only-command" as const,
    }));
}

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
  materializeProcedure?: (candidate: ProcedureCandidate, input: ReflectionInput) => Promise<void>;
}

/**
 * Safe first crystallizer: it only reifies explicit session_tool_create calls.
 * It never asks an LLM for code and never replaces native compaction.
 */
export class BoundedReflectionEngine implements ReflectionEngine {
  constructor(private readonly options: BoundedReflectionOptions) {}

  async maybeCrystallize(input: ReflectionInput): Promise<void> {
    if (input.signal?.aborted || !input.branchEntries) return;
    // Explicit fixture recovery can add filesystem work at the most latency-
    // sensitive boundary, so keep its old overflow skip. The deterministic
    // read-only procedure scanner remains allowed: it is bounded and its
    // selected runtimes do not execute shell/source code.
    if (input.reason !== "overflow") {
      for (const candidate of findExplicitFixtureCandidates(input.branchEntries)) {
        if (input.signal?.aborted) return;
        await this.options.materialize(candidate, input);
      }
    }
    if (this.options.materializeProcedure) {
      for (const candidate of findRepeatedReadOnlyBashCandidates(input.branchEntries)) {
        if (input.signal?.aborted) return;
        await this.options.materializeProcedure(candidate, input);
      }
    }
  }
}

/** Kept as a small test/dev fallback for callers that do not want crystallization. */
export class NoopReflectionEngine implements ReflectionEngine {
  async maybeCrystallize(_input: ReflectionInput): Promise<void> {
    return;
  }
}
