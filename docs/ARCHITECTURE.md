# Architecture

## Design goals

- Keep the Pi adapter thin.
- Keep artifact lifecycle logic independently testable.
- Avoid coupling to Pi's compaction implementation.
- Avoid storing executable source in chat context.
- Make scope boundaries obvious in the filesystem and API.

## Proposed modules

```text
extensions/index.ts
    Pi adapter / wiring

src/domain.ts
    shared types and invariants

src/paths.ts
    safe names and store path construction

src/store.ts
    session/global artifact persistence

src/registry.ts
    abstraction for activating materialized tools

src/reflection.ts
    bounded reflection interface; no-op in first slice

src/promotion.ts
    validation + explicit session→global transition

src/commands.ts
    parser/domain command handlers where practical
```

Exact boundaries may change after inspecting Pi's real extension API.

## Artifact layout

The exact root should be derived from Pi/session APIs rather than guessed. Conceptually:

```text
<pi-data>/session-tool-artifacts/
  sessions/
    <stable-session-id>/
      index.json
      tools/
        <tool-name>/
          manifest.json
          implementation.*
          tests.json              # optional
  global/
    <tool-name>/
      manifest.json
      implementation.*
      tests.json
```

If Pi exposes a safe way to colocate artifacts directly beside/under the session file, prefer that only after considering deletion/resume/branch semantics.

Never derive filesystem paths directly from an unsanitized model-generated name.

## Manifest sketch

```ts
interface ToolManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  scope: "session" | "global";
  createdAt: string;
  updatedAt: string;
  origin: {
    sessionKey: string;
    trigger: "manual" | "pre_compaction" | "agent" | "import";
    sourceEntryIds?: string[];
    taskSummary?: string;
  };
  runtime: {
    kind: string;
    entrypoint: string;
    dependencies?: string[];
  };
  safety: {
    declaredSideEffects: string[];
    containsSecrets: false;
  };
  promotedFrom?: {
    sessionKey: string;
    artifactId: string;
    promotedAt: string;
  };
}
```

Do not freeze this schema before the first implementation proves what runtime metadata is actually needed. Add `schemaVersion` from day one.

## Session identity

We need a stable key that is identical after resume but different for unrelated sessions. Prefer Pi's stable session identifier/file exposed by `SessionManager`. Do not hash conversation contents.

Open question: how best to handle forks/clones. v0 may treat a fork as a distinct session and document behavior. Long-term semantics should allow inherited ancestor artifacts without leaking sibling artifacts.

## Persistence layers

Use two complementary mechanisms:

1. **Filesystem artifact store** for executable code, manifests, tests, larger payloads.
2. **Pi custom entries** (`pi.appendEntry`) for small durable metadata/checkpoints if they improve replay/branch behavior.

Custom entries do not participate in LLM context, which is desirable for bookkeeping. The model learns about active tools through Pi's tool registry/system prompt, not by replaying source code.

## Dynamic registration

Pi currently documents that `pi.registerTool()` can run after startup and new tools become callable immediately. Restore artifacts on `session_start` and register them for the current session only.

Be careful: Pi extensions themselves may be global/project-loaded while the tools they dynamically register are session-scoped. The extension must clear/deactivate stale dynamic tools when switching sessions if Pi retains registrations across a `/new` or `/resume` lifecycle in-process. Verify actual runtime behavior with an integration test.

## Compaction hook

Pseudo-flow:

```ts
pi.on("session_before_compact", async (event, ctx) => {
  try {
    await reflectionEngine.maybeCrystallize({
      reason: event.reason,
      branchEntries: event.branchEntries,
      signal: event.signal,
      session: currentSession,
    });
  } catch (error) {
    // notify/log bounded error
  }
  // no custom compaction result; Pi proceeds normally
});
```

This is illustrative. Verify hook return semantics before implementation.

## Reflection architecture

Do not make reflection inseparable from persistence. Preferred phases:

1. **Evidence selection** — bounded portion of soon-to-be-compacted entries.
2. **Candidate extraction** — structured descriptions.
3. **Candidate filtering** — duplicate/risk/value checks.
4. **Materialization** — produce implementation + manifest.
5. **Validation** — syntax/schema/smoke checks.
6. **Registration** — activate session tool.
7. **Persist provenance**.

A failure in steps 2–6 should normally leave normal compaction unaffected.

## Runtime strategy

This is deliberately unresolved in bootstrap.

Possible paths:

- generate native Pi TypeScript tool modules;
- use a constrained declarative runner;
- integrate/reuse an existing execution substrate such as `pi-code-tool` rather than creating a new sandbox;
- support multiple runtime kinds behind a `ToolRuntime` interface.

Choose only after testing dynamic registration/reload and threat implications.

## Global store

The global store is controlled by this extension and should be separate from session stores. Promotion must be the only normal write path into it.

Later, the extension may export promoted tools into a conventional Pi package/tool directory, but v0 can use its own global store if it can register those artifacts reliably on session start.
