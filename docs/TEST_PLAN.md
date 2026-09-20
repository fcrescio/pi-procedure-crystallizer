# Test plan

## Testing philosophy

The most important properties are lifecycle and scope isolation, not reflection cleverness.

## Unit tests

### Names and paths

- accepts conservative tool names (`foo`, `extract_pdf_tables`);
- rejects path separators, `..`, empty names, control characters;
- store path never escapes configured root.

### Manifest

- round-trip serialization;
- schema version required;
- session artifact requires originating session key;
- global promotion records source provenance.

### Store isolation

Given session keys A and B:

- create T under A;
- listing A includes T;
- listing B does not include T;
- global listing does not include T.

### Promotion

- promoting A/T copies a validated artifact to global store;
- original remains session-scoped;
- global manifest records promotion provenance;
- promotion requires an explicit authorization signal at the application boundary;
- there is no automatic store API named/behaving like `promoteAll`.

### Delete

- deleting A/T removes only A/T;
- does not delete global promoted copy;
- does not affect B.

## Pi adapter integration tests

Where feasible:

- dynamic registration makes tool visible immediately;
- `/new` or session switch cannot leak previous session dynamic tools;
- resume restores only artifacts for resumed session;
- compaction does not remove active session tool;
- pre-compaction observer does not replace summary or cancel compaction.

If automated Pi integration is difficult, keep a deterministic manual script until a harness exists.

## Mandatory manual v0 acceptance scenario

Record exact commands and observed results in `docs/STATUS.md` when first proven.

```text
A1. launch Pi with extension
A2. create/name session A
A3. create demo session tool T
A4. /tools list → T present
A5. invoke T → expected deterministic output
A6. /compact
A7. invoke T again → same output
A8. exit
A9. resume session A
A10. /tools list → T present
A11. invoke T → works

B1. start a fresh unrelated session B
B2. /tools list → T absent
B3. verify T is not an active callable tool

PROMOTION
P1. resume A
P2. /tools promote T
P3. reject confirmation once → no global tool created
P4. repeat and approve
P5. start fresh session C
P6. promoted T is available globally
```

## Reflection tests (later)

Only after lifecycle works:

- no candidate for trivial commands;
- candidate for repeated non-obvious script;
- duplicate existing tool is not crystallized;
- invalid/generated code is rejected without blocking compaction;
- cancellation signal is honored;
- overflow reflection respects tighter budget;
- no credentials are persisted.
