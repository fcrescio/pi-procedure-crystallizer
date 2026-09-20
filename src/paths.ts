import path from "node:path";

const TOOL_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function assertSafeToolName(name: string): void {
  if (!TOOL_NAME_RE.test(name)) {
    throw new Error(
      `Invalid tool name ${JSON.stringify(name)}. Use lowercase letters, digits, underscores; start with a letter; max 64 chars.`,
    );
  }
}

export function assertSafeSessionKey(key: string): void {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(key) || key === "." || key === "..") {
    throw new Error("Invalid session key");
  }
}

export function childPath(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Resolved path escapes store root");
  }
  return candidate;
}
