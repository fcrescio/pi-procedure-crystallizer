---
name: session-tools-workflow
description: Use pi-session-tools' session-scoped procedural tools during long-running work, especially before and after compaction.
---

# Session tools workflow

When this package is available, use its tools as part of the work loop. Do not wait for compaction to decide whether a tool is useful.

## Required first move

As soon as a deterministic, bounded procedure or fixture is ready, call `session_tool_create` with a workspace-relative path. This creates a session-scoped `fixture_inventory` tool; it never promotes anything globally.

Immediately invoke `fixture_inventory` on that path and invoke it again after the next meaningful reverse-engineering or analysis step. The result is evidence that the tool is callable, not just persisted on disk.

When the pre-compaction observer reports a repeated read-only procedure candidate, prefer the recovered built-in tool (for example `native_strings_search`) over repeating the shell pipeline. Treat the candidate's examples and provenance as evidence; do not ask for arbitrary shell execution or promote it globally.

## Compaction loop

Before compaction, keep the artifact small and deterministic. After compaction:

1. Re-read the durable ledger or task notes.
2. Invoke `fixture_inventory` again using the same workspace-relative path.
3. Continue the task with the recovered tool; do not recreate or promote it automatically.
4. Use `/tools review` and `/tools test` when available, and report any unavailable command explicitly.
5. If a newly materialized analysis tool exists, invoke it once on the same artifact and record the result before continuing.

## Decision rules

- Prefer an existing session tool over writing a new ad-hoc equivalent.
- Use bounded read-only fixtures and workspace-relative paths.
- Record the artifact path, invocation, and result in the ledger.
- Keep claims tied to files and commands; distinguish confirmed facts from hypotheses.
- Never call promotion or create a global artifact without an explicit user request and confirmation.
- For APK/static analysis, start with hash, size, magic, inventory, manifest, DEX strings, and native-library inventory. Do not spend the task debugging a custom binary parser when a bounded report can be produced with simpler evidence.

## Minimal example

```text
session_tool_create({"defaultPath":"evidence/apk_inventory.md"})
fixture_inventory({"path":"evidence/apk_inventory.md"})
```
