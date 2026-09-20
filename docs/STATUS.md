# Development status

## Current state

The first lifecycle vertical slice is implemented against Pi `0.84.4`, without LLM reflection or generated source execution.

Working now:

- `/tools-create-demo` creates a deterministic `session_echo` session artifact and registers it immediately;
- `/tools list` lists current-session artifacts and globally promoted artifacts separately;
- `/tools inspect <name>` shows the manifest, provenance, and artifact directory;
- `/tools review` shows runtime support, provenance, declared side effects, dependencies, secret declaration, and artifact location;
- `/tools test <name>` runs a bounded deterministic smoke test for supported runtimes;
- `/tools delete <name>` requires confirmation, deletes only the session artifact, and disables the active tool;
- `/tools promote <name>` requires explicit confirmation and copies the artifact into the separate global store;
- `session_start` restores global tools and tools belonging to the exact `SessionManager.getSessionId()`;
- `session_before_compact` runs a bounded explicit-request crystallizer and returns nothing, leaving Pi's native compaction in control. It scans at most 64 recent entries, accepts only prior `session_tool_create` calls, materializes only the read-only fixture runtime after path/file/size checks, and skips overflow/cancelled work;
- `session_tool_create` lets the agent create a read-only `fixture_inventory` tool in the current session; it never promotes the tool globally;
- unsafe names/session keys are rejected, artifacts are isolated by session, and promotion is never implicit.

Storage defaults to `<PI_CODING_AGENT_DIR>/session-tools`; tests and the manual harness can override it with `PI_SESSION_TOOLS_ROOT`. Supported runtimes are deliberately constrained to `builtin:session_echo` and read-only `builtin:fixture_inventory`.

## Verification performed

Local verification against the installed Pi package:

- Pi `0.84.4` declarations/source verified for `session_start`, `session_shutdown`/runtime replacement, `session_before_compact`, `SessionManager.getSessionId()`, `registerTool()`, `registerCommand()`, `setActiveTools()`, and UI confirmation.
- `npm run check`: typecheck passed; 9 unit tests passed.
- Separate Docker container using `vllm-local/qwen3.8-27b` reached the local vLLM endpoint and loaded the extension.
- Session A: created, listed, invoked (`session_echo: lifecycle-ok`), exited, resumed, listed, and invoked again (`session_echo: resume-ok`).
- Fresh session B: session tool absent.
- Session A promotion: confirmation was required; approved promotion produced `global/session_echo`.
- Fresh session C: session list had no session tools, global list contained `session_echo`, and the globally scoped tool was callable (`session_echo: global-ok`).
- A real compaction survival run was executed in an isolated Docker container using the copied `pi-interactive` goal setup (`pi-goal-list-loop-audit`, `pi-loop-guard`, `pi-subagents`, and local packages). The session used Pi `0.84.4`, `vllm-local/qwen3.8-27b`, thinking `medium`, and a temporary 64k context window.
- The `/goal` task reached a recorded turn usage of about 46.8k tokens, continued into a second turn, and GLLA displayed `compacting…` at the native compaction boundary. The model then resumed work and wrote new post-compaction artifacts (`.gitignore`, `input-inventory.md`) in the isolated workspace. The running `pi-interactive` container was not touched.
- The deterministic RPC harness now performs an explicit native Pi compaction after three bounded fixture prompts. In the vLLM container it observed `compaction_start`, then `compaction_end` with `tokensBefore: 37698` and `estimatedTokensAfter: 34271`, and successfully invoked `session_echo: compacted-ok` afterward.
- Unit coverage now exercises explicit-candidate extraction, duplicate filtering, cancellation/overflow skips, and bounded materialization ordering. No LLM reflection or arbitrary source execution is involved.
- The same harness now has a real fixture and asks the model to call `session_tool_create`. It observed successful creation of `fixture_inventory`, invoked both tools after compaction, restarted the saved session and passed `/tools test session_echo` plus `/tools test fixture_inventory`, then started a fresh session where neither session tool leaked.
- The run intentionally had no Lookcam APK, captures, firmware, or device available. The goal therefore followed the fixture-driven/offline branch and did not probe the LAN or invent protocol facts.
- A separate long `/goal` run used the copied goal extensions in its own Docker container with `thinking medium`, 64k context, and the local vLLM backend. It produced a durable Lookcam RE ledger, evidence inventory, static-analysis workflow, hypothesis ledger, synthetic fixture format/generator, client skeleton, audit report, and session-tool log. Native threshold compaction fired repeatedly; the session-scoped `fixture_inventory` manifest remained present and the tool was invoked after compaction.
- The requested representative APK phase identified the official Google Play package `com.view.ppcs` and an APKCombo page for `V1.3.7`. Google Play required authentication; the APKCombo redirect reached an APKPure CDN bot gate (`403`). The download script applied a ZIP/APK magic-byte gate and saved no unverified file. No APK-specific claims were promoted to facts. `pi-interactive` remained running and untouched.

The Pi commands used for the proven portions were:

```text
/tools-create-demo
/tools list
Call the session_echo tool with text exactly: lifecycle-ok. Do not use any other tool.
# restart Pi with the saved session A
/tools list
Call session_echo with text exactly resume-ok, and no other tool.
# start a new session B
/tools list                 # session section: (none)
# resume session A
/tools promote session_echo # confirm: yes
# start a new session C
/tools list                 # session section: (none), global section: session_echo
Call session_echo with text exactly global-ok, and no other tool.
```

## Known limitations

- Runtime execution remains constrained to the two built-ins; no arbitrary generated TypeScript is executed. `fixture_inventory` is available through `/tools-create-fixture-inventory <relative-path>` and caps inputs at 128 KiB.
- Branch inheritance semantics are deferred; artifacts are keyed to the exact session ID.
- The harness does not yet cover delete/review/promotion confirmation paths in one automated run; the earlier manual run covers promotion and the unit suite covers promotion/deletion invariants.
- A real Lookcam APK/capture is still required before implementing protocol/client behavior; the isolated web acquisition attempt was blocked by source authentication/bot protection.

## Next smallest task

Repeat the native harness with a deliberately missing-but-explicit fixture manifest to verify pre-compaction recovery, then add a user-supplied Lookcam APK and run the static-analysis workflow.
