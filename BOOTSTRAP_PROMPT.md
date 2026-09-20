# Bootstrap prompt for Codex

You are implementing the first vertical slice of `pi-session-tools`, a Pi extension for session-scoped procedural memory.

Start by reading, in order:

1. `AGENTS.md`
2. `LONG_TERM_GOAL.md`
3. `docs/PRODUCT_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/TEST_PLAN.md`

Then inspect the repository and the currently installed Pi package/types. Verify every Pi API signature you plan to use against local types/source or current official Pi docs. Do not assume this scaffold's imports or API guesses are perfect.

## First implementation objective

Build the smallest end-to-end slice that proves session tool lifecycle **without implementing LLM reflection yet**.

A manually created deterministic demo tool is acceptable for this milestone.

Required behavior:

- `/tools list` displays tools associated with the current Pi session.
- Add a temporary developer command such as `/tools-create-demo` or an internal helper that materializes a trivial deterministic tool (`session_echo` or equivalent) as a session artifact.
- The tool is dynamically registered and callable in the current session.
- The artifact is durable enough to restore when the exact same session is resumed.
- A fresh unrelated session must not load the tool.
- `/tools inspect <name>` displays its manifest/provenance and artifact location.
- `/tools delete <name>` removes/disables the session artifact after confirmation.
- `/tools promote <name>` must require explicit confirmation and place a promoted copy in a clearly documented global store. A new session must be able to load promoted tools.
- No code path may promote automatically.

## Important implementation guidance

Keep the domain layer independent of Pi:

- artifact layout and serialization;
- manifest validation;
- session/global store operations;
- naming/path validation;
- promotion copying/validation.

Put Pi-specific behavior in an adapter layer:

- deriving a stable session identity/location;
- restoring current-session artifacts on `session_start`;
- registering dynamic tools;
- registering commands;
- reacting to session lifecycle events.

Prefer an append-only Pi custom entry for small extension metadata/checkpoints where useful, but do not store executable source inside the conversational context. The artifact itself should live on disk with a manifest.

Do not yet implement arbitrary generated TypeScript execution unless there is a clearly safe, testable strategy. A constrained declarative/demo tool format is acceptable for the first slice. If dynamic source execution is necessary, document the risk and keep it behind an explicit development path.

## Compaction hook in this milestone

Register a `session_before_compact` observer only if it can be done without interfering with Pi's normal compaction. For now it may record that a reflection opportunity occurred or call a no-op `ReflectionEngine`.

It must NOT return a custom compaction summary.
It must NOT cancel compaction.
It must NOT perform expensive/unbounded work.

## Tests

Add unit tests for:

- path/name validation;
- session/global store isolation;
- manifest round-trip;
- explicit promotion copying behavior;
- deletion;
- no implicit promotion.

If practical, add an integration harness for the Pi adapter. If Pi itself cannot be launched in CI, document exact manual acceptance steps.

## Finish criteria

Before stopping:

1. run tests/typecheck;
2. fix failures rather than merely documenting them;
3. update `docs/DECISIONS.md` only if you made durable architecture decisions;
4. update `docs/STATUS.md` with what now works, what remains unproven, and the exact next smallest task;
5. keep the next task narrow.

Do not proceed to automatic LLM reflection until the lifecycle acceptance test is substantially proven.
