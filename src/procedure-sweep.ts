export type SweepParameterType = "string" | "number" | "boolean" | "path" | "enum";

export interface BashProcedureRecord {
  entryId: string;
  command: string;
  result: string;
}

export interface SweepParameter {
  name: string;
  type: SweepParameterType;
  required: boolean;
  description: string;
}

export interface ProcedureCandidate {
  name: string;
  purpose: string;
  parameters: SweepParameter[];
  evidenceEntryIds: string[];
  observedOperations: string[];
  examples: string[];
  confidence: "high" | "medium" | "low";
  safeRuntimePlan: string;
  implementation: string;
}

export interface ProcedureSweepResponse {
  candidates: ProcedureCandidate[];
  rejected: Array<{ reason: string; entryIds: string[] }>;
}

export interface ProcedureSweepParseResult {
  response: ProcedureSweepResponse | null;
  errors: string[];
}

const ALLOWED_IMPORT = /^\s*import\s+[^;]+\s+from\s+["']node:(?:fs\/promises|path|child_process)["'];?\s*$/u;
const FORBIDDEN_IMPLEMENTATION = /(?:\b(?:fetch|eval|require)\s*\(|\b(?:process\.env|process\.exit)|\b(?:import|require)\s*\(\s*["']node:(?:net|tls|http)|\bshell\s*:\s*true|\b(?:npm|npx|sudo)\s+(?:install|exec|run)|\bFunction\s*\(|\brm\s+-rf\b|\b(?:git\s+push|git\s+reset\s+--hard)\b)/u;

/** Host-side safety gate for code that may become a callable session tool. */
export function validateGeneratedImplementation(source: string): string[] {
  const errors: string[] = [];
  if (source.length > MAX_IMPLEMENTATION_CHARS) errors.push(`implementation exceeds ${MAX_IMPLEMENTATION_CHARS} characters`);
  if (!/export\s+(?:async\s+)?function\s+run\s*\(/u.test(source)) errors.push("implementation must export function run(input, context)");
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ") && !ALLOWED_IMPORT.test(trimmed)) errors.push("implementation imports a module outside the allowlist");
  }
  if (FORBIDDEN_IMPLEMENTATION.test(source)) errors.push("implementation contains a forbidden capability");
  return [...new Set(errors)];
}

const MAX_RECORDS = 32;
const MAX_COMMAND_CHARS = 12_000;
const MAX_RESULT_CHARS = 2_400;
const MAX_CANDIDATES = 8;
const MAX_PARAMETERS = 12;
const MAX_IMPLEMENTATION_CHARS = 24_000;
const PARAMETER_TYPES = new Set<SweepParameterType>(["string", "number", "boolean", "path", "enum"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function stringValue(value: unknown, field: string, max: number, errors: string[]): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    errors.push(`${field} must be a non-empty string of at most ${max} characters`);
    return undefined;
  }
  return value.trim();
}

function stringArray(value: unknown, field: string, maxItems: number, maxChars: number, errors: string[]): string[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) {
    errors.push(`${field} must be an array with at most ${maxItems} items`);
    return undefined;
  }
  const output: string[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = stringValue(item, `${field}[${index}]`, maxChars, errors);
    if (parsed) output.push(parsed);
  }
  return output;
}

/** Extract the first balanced JSON object, tolerating fenced model output. */
export function extractJsonObject(text: string): string | null {
  const source = text.replace(/^\s*```(?:json)?\s*/iu, "").replace(/\s*```\s*$/u, "");
  const start = source.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

export function parseProcedureSweepResponse(text: string, evidenceIds: ReadonlySet<string>): ProcedureSweepParseResult {
  const errors: string[] = [];
  const json = extractJsonObject(text);
  if (!json) return { response: null, errors: ["response did not contain a complete JSON object"] };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    return { response: null, errors: [`invalid JSON: ${String(error)}`] };
  }
  if (!isRecord(value)) return { response: null, errors: ["top-level response must be an object"] };
  if (!Array.isArray(value.candidates)) errors.push("candidates must be an array");
  if (!Array.isArray(value.rejected)) errors.push("rejected must be an array");
  if (errors.length > 0) return { response: null, errors };

  const candidates: ProcedureCandidate[] = [];
  const rawCandidates = value.candidates as unknown[];
  const rawRejected = value.rejected as unknown[];
  for (const [index, raw] of rawCandidates.entries()) {
    if (candidates.length >= MAX_CANDIDATES) {
      errors.push(`candidates exceeds the limit of ${MAX_CANDIDATES}`);
      break;
    }
    if (!isRecord(raw)) { errors.push(`candidates[${index}] must be an object`); continue; }
    const local: string[] = [];
    const name = stringValue(raw.name, `candidates[${index}].name`, 80, local);
    const purpose = stringValue(raw.purpose, `candidates[${index}].purpose`, 500, local);
    const safeRuntimePlan = stringValue(raw.safeRuntimePlan, `candidates[${index}].safeRuntimePlan`, 1_000, local);
    const implementation = stringValue(raw.implementation, `candidates[${index}].implementation`, MAX_IMPLEMENTATION_CHARS, local);
    if (implementation) local.push(...validateGeneratedImplementation(implementation).map(error => `candidates[${index}]: ${error}`));
    const confidence = raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low" ? raw.confidence : undefined;
    if (!confidence) local.push(`candidates[${index}].confidence is invalid`);
    const evidence = stringArray(raw.evidenceEntryIds, `candidates[${index}].evidenceEntryIds`, 32, 100, local);
    const operations = stringArray(raw.observedOperations, `candidates[${index}].observedOperations`, 32, 200, local);
    const examples = raw.examples === undefined ? [] : stringArray(raw.examples, `candidates[${index}].examples`, 8, MAX_COMMAND_CHARS, local);
    if (evidence) for (const id of evidence) if (!evidenceIds.has(id)) local.push(`unknown evidence entry: ${id}`);
    const parameters: SweepParameter[] = [];
    if (!Array.isArray(raw.parameters) || raw.parameters.length > MAX_PARAMETERS) local.push(`candidates[${index}].parameters is invalid`);
    else for (const [parameterIndex, parameter] of raw.parameters.entries()) {
      if (!isRecord(parameter)) { local.push(`parameter ${parameterIndex} must be an object`); continue; }
      const parameterErrors: string[] = [];
      const parameterName = stringValue(parameter.name, `parameter ${parameterIndex}.name`, 80, parameterErrors);
      const description = stringValue(parameter.description, `parameter ${parameterIndex}.description`, 300, parameterErrors);
      const type = typeof parameter.type === "string" && PARAMETER_TYPES.has(parameter.type as SweepParameterType) ? parameter.type as SweepParameterType : undefined;
      if (!type) parameterErrors.push(`parameter ${parameterIndex}.type is invalid`);
      if (typeof parameter.required !== "boolean") parameterErrors.push(`parameter ${parameterIndex}.required must be boolean`);
      if (parameterErrors.length > 0) local.push(...parameterErrors);
      else parameters.push({ name: parameterName!, type: type!, required: parameter.required as boolean, description: description! });
    }
    if (local.length > 0) errors.push(...local);
    else candidates.push({ name: name!, purpose: purpose!, parameters, evidenceEntryIds: evidence!, observedOperations: operations!, examples: examples!, confidence: confidence!, safeRuntimePlan: safeRuntimePlan!, implementation: implementation! });
  }
  const rejected = rawRejected.flatMap((raw: unknown, index: number) => {
    if (!isRecord(raw)) { errors.push(`rejected[${index}] must be an object`); return []; }
    const local: string[] = [];
    const reason = stringValue(raw.reason, `rejected[${index}].reason`, 500, local);
    const entryIds = stringArray(raw.entryIds, `rejected[${index}].entryIds`, 32, 100, local);
    if (entryIds) for (const id of entryIds) if (!evidenceIds.has(id)) local.push(`unknown rejected evidence entry: ${id}`);
    if (local.length > 0) { errors.push(...local); return []; }
    return [{ reason: reason!, entryIds: entryIds! }];
  });
  return { response: { candidates, rejected }, errors };
}

export function collectBashProcedureRecords(entries: readonly unknown[], maxEntries = 64): BashProcedureRecord[] {
  const recent = entries.slice(-maxEntries);
  const results = new Map<string, string>();
  for (const entry of recent) {
    if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
    const message = entry.message;
    if (message.role !== "toolResult" || typeof message.toolCallId !== "string" || !Array.isArray(message.content)) continue;
    results.set(message.toolCallId, message.content.filter(isRecord).filter(part => part.type === "text" && typeof part.text === "string").map(part => part.text as string).join("\n").slice(0, MAX_RESULT_CHARS));
  }
  const output: BashProcedureRecord[] = [];
  for (const entry of recent) {
    if (output.length >= MAX_RECORDS || !isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
    const message = entry.message;
    if (message.role !== "assistant" || !Array.isArray(message.content) || typeof entry.id !== "string") continue;
    for (const part of message.content) {
      if (output.length >= MAX_RECORDS || !isRecord(part) || part.type !== "toolCall" || part.name !== "bash" || typeof part.id !== "string") continue;
      const args = isRecord(part.arguments) ? part.arguments : undefined;
      if (!args || typeof args.command !== "string") continue;
      output.push({ entryId: entry.id, command: args.command.slice(0, MAX_COMMAND_CHARS), result: results.get(part.id) ?? "" });
    }
  }
  return output;
}

export function buildProcedureSweepPrompt(records: readonly BashProcedureRecord[]): string {
  return `You are a bounded procedure-mining assistant running before context compaction. You receive only bash execution calls and bounded results from one session. Group repeated or structurally similar procedures, especially ephemeral inline scripts and heredocs, into generic parameterized session-scoped tool candidates. Do not invent capabilities. Return only JSON with this shape: {"candidates":[{"name":string,"purpose":string,"parameters":[{"name":string,"type":"string|number|boolean|path|enum","required":boolean,"description":string}],"evidenceEntryIds":string[],"observedOperations":string[],"examples":string[],"confidence":"high|medium|low","safeRuntimePlan":string,"implementation":string}],"rejected":[{"reason":string,"entryIds":string[]}]}. The implementation must be a self-contained Node.js ES module exporting async function run(input, context). It may use only node:fs/promises, node:path, and node:child_process via execFile/spawn; it must never install dependencies, access credentials, use a shell, use network APIs, or delete files. The host supplies JSON input and a workspace cwd. Candidates are session-scoped and callable without a human approval prompt, but invalid or unsafe implementations must be rejected by the host.\n\nBASH CALLS:\n${JSON.stringify(records)}`;
}
