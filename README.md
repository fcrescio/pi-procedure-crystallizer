# pi-session-tools

Experimental Pi extension for **session-scoped procedural memory**.

The core idea is simple: when useful executable know-how emerges during a long Pi session, crystallize it into a callable tool **before context compaction can erase the implementation details**. The tool remains an artifact of that session. It is available when that exact session is resumed, but it is not inherited by unrelated sessions. Promotion to a global tool is always an explicit user action.

## Status

Bootstrap repository. The architecture and acceptance criteria are specified; the runtime implementation is intentionally minimal so Codex can verify current Pi APIs before locking in details.

## Start here

1. Read `LONG_TERM_GOAL.md`.
2. Read `AGENTS.md`.
3. Read `docs/PRODUCT_SPEC.md` and `docs/ARCHITECTURE.md` only as needed.
4. Follow `BOOTSTRAP_PROMPT.md` for the first implementation pass.

## Intended v0 behavior

- A Pi session has its own set of generated tools.
- Before `/compact` or automatic compaction, a bounded reflection pass may identify reusable procedural knowledge.
- Candidate procedures can be materialized as session tools.
- Session tools survive compaction and session resume.
- New/unrelated sessions do not see them.
- `/tools list|inspect|review|test|promote|delete` provides user control.
- Only `promote` crosses the session → global boundary.
- The extension does **not** replace Pi's normal compaction summary pipeline.

## Local development target

```bash
npm install
npm run check
pi -e .
```

Before relying on any Pi API signature, verify it against the currently installed Pi version and the latest official documentation.
