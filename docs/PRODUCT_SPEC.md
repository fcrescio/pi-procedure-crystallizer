# Product specification

## Product statement

`pi-procedure-crystallizer` preserves useful executable procedures discovered during a Pi session as tools attached to that session. It is designed primarily to protect procedural knowledge from context compaction. Users explicitly review and promote selected session tools to global scope.

## Actors

- **Agent:** may propose/materialize tools within the current session.
- **User:** owns promotion and destructive review actions.
- **Pi runtime:** provides lifecycle events, session persistence, dynamic tool registration, and commands.

## Scopes

### Session scope

Default for generated tools. A session tool:

- belongs to one originating session;
- may persist on disk;
- is restored on resume of that session;
- is unavailable in unrelated sessions;
- may shadow a global tool in a later milestone, but v0 can reject name collisions instead.

### Global scope

Explicitly promoted tools. A global tool:

- is loaded for sessions according to extension configuration;
- has promotion provenance;
- must never be created by an automatic reflection path.

## Commands

The command parser should support a single `/tools` namespace if Pi's command API makes subcommands ergonomic.

### `/tools list`

Show current-session tools, including name, status, creation trigger, and simple usage metadata when available.

### `/tools inspect <name>`

Show manifest, provenance, declared parameters/side effects, dependencies, artifact path, and promotion status.

### `/tools review`

v0: structured summary of all current-session tools.
Later: interactive review surface with tests/diff/generalization.

### `/tools test <name>`

Run stored smoke/regression cases without promotion. Can be deferred until executable format is stable.

### `/tools promote <name>`

Mandatory explicit confirmation. Copies/generalizes an artifact into global storage. Promotion must be atomic where practical and must preserve provenance.

### `/tools delete <name>`

Delete/disable the current-session artifact after confirmation. Must not delete an already promoted global copy unless separately requested.

## Reflection triggers

Priority order:

1. `session_before_compact` — primary automatic trigger.
2. Manual `/tools crystallize` — useful for debugging and user control (later milestone).
3. Optional agent-settled/turn heuristic — only after cost/quality measurements.

## Reflection output contract (future milestone)

The reflection engine should return structured candidates, not prose. Conceptually:

```ts
interface CrystallizationCandidate {
  name: string;
  description: string;
  rationale: string;
  inputs: ParameterSpec[];
  implementationPlan: string;
  evidence: EvidenceRef[];
  risks: string[];
  expectedReuse: string;
}
```

Generation/materialization is a separate step so candidates can be rejected safely.

## UX principles

- Quiet by default: no noisy messages when reflection finds nothing.
- Transparent when creating executable artifacts.
- User can always identify origin and inspect source/config.
- Promotion confirmation states destination and consequences.
- Errors should not strand compaction.

## v0 acceptance criteria

See `docs/TEST_PLAN.md` for the executable scenario. The core product acceptance criterion is isolation: restoring session A loads A's tools, creating session B does not.
