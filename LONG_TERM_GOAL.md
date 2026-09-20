# Long-term goal: session-scoped procedural memory for Pi

## Mission

Build a Pi extension that turns useful executable knowledge discovered during a working session into **session-scoped tool artifacts**, especially at the moment when context compaction threatens to discard the details needed to reproduce that knowledge.

The system should make a long-running agent progressively more capable **inside the current session** without silently teaching all future sessions. Persistence and scope are deliberately separate concepts:

- **Persistence:** a tool artifact remains stored with its originating session and can be restored when that session is resumed.
- **Scope:** by default, the tool is visible only to its originating session.
- **Promotion:** crossing from session scope to global scope requires an explicit user decision.

The product is not an autonomous global self-improvement system. It is a controlled procedural-memory layer with a user-owned promotion boundary.

---

## Problem

During a long coding/research/automation session, Pi often discovers a procedure that is expensive to rediscover:

- a small script that normalizes a peculiar data format;
- a reliable sequence of CLI calls;
- an API adapter;
- a parser for a recurring artifact;
- a project-specific diagnostic;
- a wrapper around several low-level tools.

Today, this knowledge often remains embedded in conversational context. Context compaction can preserve a textual summary, but a textual summary is a lossy representation of executable knowledge. After compaction, the agent may know *that* something was done yet have to reconstruct *how* it was done.

We want to transform selected procedural knowledge from:

> ephemeral reasoning/code in context

into:

> executable, named, inspectable artifacts attached to the session.

---

## Core product invariant

**No generated tool becomes globally available without an explicit user promotion action.**

This invariant is stronger than convenience features, model preferences, heuristics, or automatic cleanup. Any implementation that violates it is incorrect.

---

## Conceptual lifecycle

```text
normal work
   │
   ├─ agent invents scripts / procedures / command sequences
   │
   ▼
reflection trigger
   │
   ├─ especially session_before_compact
   │
   ▼
identify executable know-how worth preserving in this session
   │
   ├─ none → do nothing
   │
   └─ candidate(s)
          │
          ▼
      crystallize
          │
          ├─ implementation
          ├─ manifest
          ├─ parameter schema
          ├─ provenance
          └─ smoke/regression examples when available
          │
          ▼
      SESSION TOOL ARTIFACT
          │
          ├─ immediately callable in current session
          ├─ survives compaction
          ├─ restored on resume of same session
          └─ invisible to unrelated sessions

user invokes /tools review
          │
          ├─ inspect / test / rename / delete / generalize
          └─ promote (explicit)
                    │
                    ▼
               GLOBAL TOOL
```

---

## The important separation: crystallization vs promotion

### Crystallization

Crystallization optimizes for:

> “Will this procedure be useful again later in this same session, after the detailed context is gone?”

It should be relatively cheap and permissive. A session tool may be narrow, ugly, project-specific, or temporary. It is allowed to encode local assumptions if those assumptions are made visible in its manifest.

Examples:

- `fix_vendor_csv`
- `inspect_local_fixture`
- `query_acme_staging_api`

### Promotion

Promotion optimizes for:

> “Is this artifact safe, general, understandable, and useful enough to expose to future sessions?”

Promotion is deliberately stricter. It can involve renaming, parameterizing hard-coded values, checking dependencies, rerunning saved examples, detecting secrets/absolute paths, and comparing against an existing global tool.

Crystallization is automatic/agent-driven within the session. Promotion is user-authorized.

---

## Session artifact semantics

A session tool is an artifact *of a session*, not transient scratch state.

Required behavior:

1. It survives context compaction.
2. It survives process exit.
3. It is restored when the same session is resumed.
4. It remains associated with the session's branching semantics as far as practical.
5. It is not automatically loaded by unrelated sessions.
6. Deleting a session should make its artifacts eligible for cleanup, but artifact cleanup policy may be implemented later.

Do not equate “session-scoped” with “temporary file”.

---

## Compaction integration

The primary automatic reflection trigger is Pi's `session_before_compact` lifecycle event.

The extension must **not own or replace the normal compaction summary by default**. It should perform bounded pre-compaction reflection/materialization, then return control so Pi's native/custom configured summarizer continues normally.

Reasons:

- separation of responsibilities;
- compatibility with other compaction extensions;
- fewer regressions;
- easier testing;
- no need to duplicate Pi's compaction logic.

A reflection failure must not normally block compaction. Prefer fail-open behavior: record/report the failure and allow Pi to compact.

Overflow compaction is latency-sensitive. The implementation may need a smaller budget or skip policy for `reason === "overflow"` if reflection risks making recovery worse.

---

## Reflection philosophy

Reflection is not a generic “summarize everything” call. It asks a narrow question:

> What executable knowledge present in the soon-to-be-compacted material would be expensive to rediscover and is likely to be useful again in this session?

Good candidates:

- procedures used more than once;
- working scripts developed through iteration;
- transformations with non-obvious edge cases;
- multi-command workflows with meaningful sequencing;
- adapters around project-specific APIs or file formats;
- deterministic calculations/parsers that can be safely parameterized.

Bad candidates:

- one-line shell commands;
- facts better preserved as text;
- speculative or unverified code;
- code containing credentials;
- destructive operations without explicit safeguards;
- functionality already provided by an existing active tool;
- giant copies of application logic;
- a “tool” whose behavior is mostly another unconstrained LLM call.

Reflection must be bounded. The system should aim to save future tokens/work, not spend more tokens than it plausibly saves.

---

## Model/cost strategy

The design should work well with lower-cost models.

Preferred operating principle:

- Use **GPT-5.6 Luna** for routine repository implementation, simple tests, refactors, documentation maintenance, and bounded reflection when it proves reliable enough.
- Use **GPT-5.6 Terra** for architecture changes, difficult debugging, security-sensitive promotion logic, complex schema/runtime problems, or when Luna repeatedly fails a concrete acceptance test.
- Do not default to an expensive model merely because it is available.

The extension itself should eventually allow the reflection model to be configured independently from the active conversational model, but v0 does not need to solve this immediately.

Token discipline for development agents:

- `LONG_TERM_GOAL.md` is the durable north star.
- `AGENTS.md` is intentionally short and should be read first.
- Read deeper docs only for the subsystem being changed.
- Keep `docs/DECISIONS.md` concise and append only durable architectural decisions.
- Prefer executable tests over verbose progress narratives.

---

## User experience

Target command family:

```text
/tools list
/tools inspect <name>
/tools review
/tools test <name>
/tools promote <name>
/tools delete <name>
```

Potential later commands:

```text
/tools diff <name>
/tools rename <old> <new>
/tools generalize <name>
/tools history <name>
/tools export <name>
```

`/tools review` should be the main human governance surface. It should answer:

- What was created in this session?
- Why was it created?
- Where did it come from?
- Has it actually been used?
- What dependencies/side effects does it have?
- Does it contain obvious session-specific assumptions?
- Is there already a global tool with the same name/function?
- What would promotion change?

The system may provide descriptive warnings or a “candidate for review” indication, but should not autonomously promote.

---

## Provenance

Every generated tool should eventually carry enough provenance to answer:

- originating session identifier/file;
- creation time;
- source conversation/entry range when available;
- trigger (`pre_compaction`, manual, agent-created, etc.);
- originating task summary;
- generator/model metadata when useful;
- implementation version/hash;
- saved examples/tests;
- dependencies;
- declared side effects/capabilities;
- promotion history.

Provenance is for debuggability and informed review, not surveillance or excessive logging.

---

## Safety and trust boundaries

Generated executable code is dangerous by default.

The design should evolve toward:

- clear side-effect declarations;
- no credential materialization;
- no silent dependency installation;
- explicit confirmation before risky dependency/install actions;
- path and environment validation;
- bounded outputs;
- cancellation support;
- deterministic schemas;
- promotion-time inspection/tests;
- optional sandboxing or reuse of an established safe execution substrate rather than inventing a weak sandbox.

Do not build a home-grown “secure sandbox” and claim it is secure without a real threat model and tests.

---

## Branching semantics

Pi sessions are trees, not merely linear logs. v0 may initially scope artifacts to the session file, but the long-term behavior should be branch-aware.

Ideal semantics:

- artifacts created on an ancestor branch are available to descendants;
- artifacts created only on an abandoned sibling branch should not silently appear in the active branch;
- promotion remains user-controlled regardless of branch.

If full branch-awareness is deferred, document the limitation explicitly and avoid data-loss migrations.

---

## Global promotion semantics

Global promotion is not just “copy the file”. Before promotion, the system should eventually support a gate that can:

1. show implementation and manifest;
2. run stored tests/examples;
3. detect hard-coded session paths/secrets/environment assumptions;
4. identify dependency/install requirements;
5. compare name/capability with an existing global tool;
6. optionally generalize parameters;
7. require final user confirmation;
8. write the promoted artifact atomically;
9. keep provenance linking it back to the session artifact.

The first v0 can implement a smaller safe subset, but must never auto-promote.

---

## Non-goals for the first versions

Do not prematurely build:

- a tool marketplace;
- semantic vector search over thousands of tools;
- autonomous cross-session learning;
- cloud synchronization;
- automatic global promotion;
- complex quality scores;
- a universal sandbox;
- multi-agent voting;
- an elaborate GUI.

Prove the lifecycle first.

---

## v0 proof

The first meaningful milestone is successful only if this scenario works end-to-end:

1. Start session A.
2. Materialize a simple session tool T.
3. Confirm T is callable in A.
4. Trigger `/compact`.
5. Confirm T remains callable after compaction.
6. Exit Pi.
7. Resume A.
8. Confirm T is restored and callable.
9. Start unrelated session B.
10. Confirm T is not available there.
11. Return to A.
12. Run `/tools promote T` with explicit confirmation.
13. Start unrelated session C.
14. Confirm the promoted form of T is globally available.

A v0 that cannot demonstrate this should not add more sophisticated reflection heuristics.

---

## Definition of success

The project succeeds when long Pi sessions can preserve executable discoveries through compaction with low cognitive/token overhead, while the user retains a crisp boundary between:

- **what this session learned to do**, and
- **what all future sessions are allowed to do**.
