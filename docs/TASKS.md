# Product task plan

## Goal 1 — Close the lifecycle boundary

- [x] Add a Pi RPC harness for `create → compact → invoke`.
- [x] Prove that native Pi compaction emits `compaction_start` and `compaction_end`.
- [x] Prove that `session_before_compact` is fail-open and does not replace Pi's summary.
- [x] Invoke the restored session tool after compaction.
- [x] Resume the same session and verify the artifact is restored.
- [x] Start a fresh session and verify the artifact is absent.

## Goal 2 — Add user governance

- [x] Implement `/tools review` with provenance, usage, validation state, and risks.
- [x] Implement `/tools test <name>` with bounded deterministic examples.
- [ ] Test delete, review, and promotion confirmation paths.
- [ ] Preserve the explicit-promotion invariant in unit and integration tests.

## Goal 3 — Add safe crystallization

- [x] Define a small declarative runtime for bounded analyzers and pipelines.
- [x] Add schema validation, allowed workspace roots, and a 128 KiB input cap for the first runtime.
- [x] Add an agent-facing creation path that remains session-scoped by default.
- [ ] Add bounded reflection at `session_before_compact`, failing open on errors.
- [ ] Keep arbitrary generated source execution out of the default path.

## Goal 4 — Validate with the Lookcam RE case

- [x] Run a long `/goal` in an isolated container with the Pi goal extensions.
- [x] Reuse at least one crystallized tool across multiple RE steps and a compaction.
- [x] Record confirmed facts, hypotheses, evidence, and blockers.
- [ ] Add APK/capture/device evidence when available; never invent protocol facts. (APK acquisition is currently blocked by public-source download gates.)
- [ ] Promote only a reviewed, explicitly approved tool.
- [ ] Update `docs/STATUS.md` with the complete evidence trail.
