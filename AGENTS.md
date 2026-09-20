# Agent instructions

Read `LONG_TERM_GOAL.md` before making architectural changes.

## Working rules

1. Preserve the invariant: **session tools never become global without explicit user promotion**.
2. Prefer small vertical slices with runnable tests over broad scaffolding.
3. Verify current Pi APIs from installed types/source or official docs before coding against them; Pi evolves quickly.
4. Do not replace Pi's native compaction summarizer. Use `session_before_compact` only for bounded crystallization work, then let compaction proceed.
5. Reflection failure should normally fail open and not prevent compaction.
6. Keep generated tool execution conservative. Do not silently install dependencies or embed credentials.
7. Treat session scope and disk persistence as separate concerns.
8. Keep core logic testable without launching Pi. Put Pi adapters at the edges.
9. Before finishing a task, run the narrowest relevant tests, then `npm run check` when practical.
10. Update `docs/DECISIONS.md` only for durable design decisions; do not use it as a work log.

## Token discipline

- Read only the documents relevant to the current task.
- Prefer Luna for normal implementation/testing.
- Escalate to Terra only for genuinely difficult architectural/debug/security work.
- Do not repeatedly restate the whole design in responses or comments; point to the canonical docs.

## First milestone

Do not optimize reflection quality until the lifecycle works:
create → register → survive compact → resume same session → absent in new session → explicit promotion → global availability.
