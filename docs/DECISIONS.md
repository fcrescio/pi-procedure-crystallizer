# Durable architecture decisions

Keep this file short. Add only decisions that future agents should not casually rediscover/change.

## D-001 — Session persistence is not global scope

Generated tools persist as artifacts of their originating session. Persistence across resume does not make them visible to other sessions.

## D-002 — Promotion is explicitly user-owned

No automatic path may promote session tools to global scope. Promotion requires a deliberate user command/action and confirmation.

## D-003 — Pre-compaction reflection does not own compaction

The extension may observe `session_before_compact` and materialize procedural knowledge, but it should not replace Pi's normal compaction summary pipeline by default.

## D-004 — Prove lifecycle before reflection quality

The first milestone uses a deterministic/manual demo tool if necessary. Do not spend significant effort on automatic LLM crystallization until session isolation, resume, compaction survival, and promotion are demonstrated.

## D-005 — First runtime is a constrained built-in demo

The first Pi adapter materializes only the deterministic `builtin:session_echo` runtime. Manifests live on disk; Pi dynamically registers this built-in implementation on `session_start` and after creation/promotion. Other runtime kinds are ignored until a separately reviewed execution strategy exists.

Artifacts default to `<PI_CODING_AGENT_DIR>/session-tools` (or `PI_SESSION_TOOLS_ROOT` for tests), with session IDs obtained from Pi's `SessionManager.getSessionId()` and global artifacts in a separate `global/` directory.

## D-006 — First declarative runtime is bounded fixture inventory

The next runtime is `builtin:fixture_inventory`: read-only, workspace-relative, dependency-free, and capped at 128 KiB. It rejects traversal, directories, and oversized files. This gives RE workflows a reusable artifact without opening arbitrary generated source execution.

## D-007 — Pre-compaction crystallization only honors explicit bounded requests

The first automatic crystallizer scans a bounded suffix of recent Pi entries and accepts only structured `session_tool_create` calls previously emitted by the agent. It does not infer tools from prose, shell commands, or generated source. Materialization still requires a workspace-relative regular file within the fixture size cap; overflow and cancellation skip crystallization, and all failures remain fail-open so Pi's native compaction continues.

## D-008 — Tool-use workflow is package-distributed guidance

The package ships `skills/session-tools-workflow/SKILL.md`. It tells Pi to create and invoke a session tool as soon as a deterministic fixture exists, reuse it after compaction, and never promote automatically. The guidance is intentionally procedural and bounded so lower-thinking models do not spend the task rediscovering tool usage or debugging an unnecessary parser.

## D-009 — Compaction recovery is a separate, native-first package

`pi-compaction-recovery` is an opt-in package and separate repository from session-tool crystallization. Pi `session_compact_failed` is an observer-only event, so recovery runs in `session_before_compact`: it calls Pi's exported native `compact()` first for overflow compaction, then retries with a transient copy that first removes tool-result payloads and, only if needed, assistant reasoning blocks. It never rewrites persisted entries, silently changes the main package's native-compaction behavior, or promotes anything globally.

## D-010 — Discovery precedes runtime materialization

Pre-compaction discovery first emits bounded, provenance-bearing candidates for repeated read-only procedures. It must not turn arbitrary shell history into executable tools without validation. Candidate classes may materialize as session-scoped generated procedures only when their implementation passes the host allowlist (no dependencies, credentials, network, shell, or destructive operations), with bounded timeout/output. Global promotion remains explicit.

## D-011 — Model-assisted procedure sweep is bounded garbage collection

At pre-compaction, a bounded sweep may send only recent Bash calls and bounded results to the active model to group ephemeral scripts into parameterized session-tool candidates. The response is schema-validated against observed entry IDs and implementation capabilities. The sweep does not prompt for human approval; validated candidates become session-scoped callable artifacts, while review remains available through the catalog and promotion remains explicit.
