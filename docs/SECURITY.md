# Security notes / preliminary threat model

Generated tools are executable artifacts and therefore a trust boundary.

## Threats to account for

- model-generated source containing destructive commands;
- credential/token leakage into generated source or manifests;
- path traversal through generated tool names;
- dependency confusion or silent package installation;
- stale session tool leaking into another session;
- malicious artifact modified on disk before promotion;
- tool output flooding model context;
- a promoted tool having broader side effects than shown during review;
- global name collision changing behavior unexpectedly.

## Runtime safety rules

- sanitize/validate every artifact name before filesystem use;
- never persist environment secrets intentionally;
- never auto-install dependencies;
- do not claim sandbox security without a real sandbox;
- promotion is explicit and should surface dependencies/side effects;
- prefer deterministic demo/declarative tools until runtime execution design is reviewed;
- honor cancellation/abort signals where Pi exposes them;
- bound generated tool output before returning it to the model.

## Deferred questions

- reuse `pi-code-tool` execution substrate vs native TypeScript modules;
- signing/hashing artifacts;
- dependency allowlists;
- permission model for mutating tools;
- branch-aware capability inheritance.
