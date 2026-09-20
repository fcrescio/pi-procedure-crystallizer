# Development status

## Current state

The first lifecycle vertical slice is implemented against Pi `0.84.4`, without LLM reflection or generated source execution.

Working now:

- `/tools-create-demo` creates a deterministic `session_echo` session artifact and registers it immediately;
- `/tools list` lists current-session artifacts and globally promoted artifacts separately;
- `/tools inspect <name>` shows the manifest, provenance, and artifact directory;
- `/tools delete <name>` requires confirmation, deletes only the session artifact, and disables the active tool;
- `/tools promote <name>` requires explicit confirmation and copies the artifact into the separate global store;
- `session_start` restores global tools and tools belonging to the exact `SessionManager.getSessionId()`;
- `session_before_compact` runs only the bounded no-op reflection engine and returns nothing, leaving Pi's native compaction in control;
- unsafe names/session keys are rejected, artifacts are isolated by session, and promotion is never implicit.

Storage defaults to `<PI_CODING_AGENT_DIR>/session-tools`; tests and the manual harness can override it with `PI_SESSION_TOOLS_ROOT`. The first runtime is deliberately constrained to `builtin:session_echo`.

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
- The run intentionally had no Lookcam APK, captures, firmware, or device available. The goal therefore followed the fixture-driven/offline branch and did not probe the LAN or invent protocol facts.

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

- The constrained demo runtime is the only executable format; no arbitrary generated TypeScript is executed.
- Branch inheritance semantics are deferred; artifacts are keyed to the exact session ID.
- The harness does not yet cover same-session process restart and fresh-session absence in one run; those behaviors are covered by the earlier manual lifecycle run and should be folded into the harness next.

## Next smallest task

Extend the harness with process restart/resume and a fresh-session assertion, then implement `/tools review` and `/tools test <name>` as the next governance slice.
