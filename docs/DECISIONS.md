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
