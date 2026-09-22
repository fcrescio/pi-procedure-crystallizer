# Development status

## Current state

The main package is now prepared for an initial public npm release as
`pi-procedure-crystallizer@0.1.0`: its README describes the shipped behavior, the Pi
manifest declares both the extension and workflow skill, and `npm pack
--dry-run` contains only runtime code and public documentation. The companion
`pi-compaction-recovery@0.1.0` package lives in the standalone repository at
`/home/fcrescio/pi-compaction-recovery` and has its own release check.

The first lifecycle vertical slice is implemented against Pi `0.84.4`. A bounded model-assisted procedure sweep now runs during non-overflow pre-compaction and can materialize validated generated procedures as session-scoped callable tools without prompting for review.

Working now:

- `/tools-create-demo` creates a deterministic `session_echo` session artifact and registers it immediately;
- `/tools list` lists current-session artifacts and globally promoted artifacts separately;
- `/tools inspect <name>` shows the manifest, provenance, and artifact directory;
- `/tools review` shows runtime support, provenance, declared side effects, dependencies, secret declaration, and artifact location;
- `/tools test <name>` runs a bounded deterministic smoke test for supported runtimes;
- `/tools delete <name>` requires confirmation, deletes only the session artifact, and disables the active tool;
- `/tools promote <name>` requires explicit confirmation and copies the artifact into the separate global store;
- `session_start` restores global tools and tools belonging to the exact `SessionManager.getSessionId()`;
- `session_before_compact` runs bounded crystallization and returns nothing, leaving Pi's native compaction in control. It scans at most 64 recent entries, recovers explicit `session_tool_create` calls, and discovers repeated safe read-only procedures; explicit fixture recovery remains skipped on overflow while bounded native runtimes may still be materialized there.
- The pre-compaction sweep extracts at most 32 recent Bash calls with bounded results, asks the active model to group repeated/structurally similar procedures, and validates fenced or plain JSON, parameter schemas, and provenance entry IDs. Invalid fields fail open; `needsHumanReview` is intentionally not an operational gate.
- The pre-compaction sweep uses Pi's provider-neutral concrete-provider `streamSimple(...).result()` API with an explicit `reasoning: "off"` and a 4096-token output budget. In Pi `0.84.4` this is exposed through `ModelRegistry.getProvider(model.provider)`, not the registry facade; the adapter also forwards `getApiKeyAndHeaders(model)` because calling the concrete provider directly otherwise bypasses Pi's auth resolution.
- Validated candidates now include a self-contained `run(input, context)` ES module. The host persists and registers it as `builtin:generated_procedure`, executes it with Node in the workspace, a 30-second timeout, 64 KiB output cap, minimal environment, and an import/capability allowlist. No dependencies are installed and no credentials are passed.
- `session_tool_create` lets the agent create a read-only `fixture_inventory` tool in the current session; it never promotes the tool globally;
- unsafe names/session keys are rejected, artifacts are isolated by session, and promotion is never implicit.

Storage defaults to `<PI_CODING_AGENT_DIR>/session-tools`; tests and the manual harness can override it with `PI_SESSION_TOOLS_ROOT`. Supported runtimes are deliberately constrained to deterministic built-ins: `builtin:session_echo`, read-only `builtin:fixture_inventory`, and bounded `builtin:native_strings_search`.

## Verification performed

Local verification against the installed Pi package:

- Pi `0.84.4` declarations/source verified for `session_start`, `session_shutdown`/runtime replacement, `session_before_compact`, `SessionManager.getSessionId()`, `registerTool()`, `registerCommand()`, `setActiveTools()`, and UI confirmation.
- `npm run check`: typecheck passed; all 23 unit tests passed.
- Separate Docker container using `vllm-local/qwen3.8-27b` reached the local vLLM endpoint and loaded the extension.
- Session A: created, listed, invoked (`session_echo: lifecycle-ok`), exited, resumed, listed, and invoked again (`session_echo: resume-ok`).
- Fresh session B: session tool absent.
- Session A promotion: confirmation was required; approved promotion produced `global/session_echo`.
- Fresh session C: session list had no session tools, global list contained `session_echo`, and the globally scoped tool was callable (`session_echo: global-ok`).
- A real compaction survival run was executed in an isolated Docker container using the copied `pi-interactive` goal setup (`pi-goal-list-loop-audit`, `pi-loop-guard`, `pi-subagents`, and local packages). The session used Pi `0.84.4`, `vllm-local/qwen3.8-27b`, thinking `medium`, and a temporary 64k context window.
- The `/goal` task reached a recorded turn usage of about 46.8k tokens, continued into a second turn, and GLLA displayed `compacting…` at the native compaction boundary. The model then resumed work and wrote new post-compaction artifacts (`.gitignore`, `input-inventory.md`) in the isolated workspace. The running `pi-interactive` container was not touched.
- The deterministic RPC harness now performs an explicit native Pi compaction after three bounded fixture prompts. In the vLLM container it observed `compaction_start`, then `compaction_end` with `tokensBefore: 37698` and `estimatedTokensAfter: 34271`, and successfully invoked `session_echo: compacted-ok` afterward.
- Unit coverage exercises explicit-candidate extraction, duplicate filtering, cancellation/overflow skips, bounded materialization ordering, generated implementation validation, and the callable candidate path.
- Unit coverage now includes fenced JSON parsing, braces inside strings, malformed parameters, unknown provenance, bounded Bash/result pairing, and a real LookCam sweep response. The response produced validated candidates with self-contained implementations; generated runtimes are host-validated before registration and are callable through Pi's normal tool registry.
- The latest Docker harness deleted the agent-created fixture manifest immediately before compaction; the hook recovered it with `origin.trigger=pre_compaction`, and the recovered tool passed post-compaction invocation, resume smoke tests, and fresh-session isolation.
- The same harness now has a real fixture and asks the model to call `session_tool_create`. It observed successful creation of `fixture_inventory`, invoked both tools after compaction, restarted the saved session and passed `/tools test session_echo` plus `/tools test fixture_inventory`, then started a fresh session where neither session tool leaked.
- The run intentionally had no Lookcam APK, captures, firmware, or device available. The goal therefore followed the fixture-driven/offline branch and did not probe the LAN or invent protocol facts.
- A separate long `/goal` run used the copied goal extensions in its own Docker container with `thinking medium`, 64k context, and the local vLLM backend. It produced a durable Lookcam RE ledger, evidence inventory, static-analysis workflow, hypothesis ledger, synthetic fixture format/generator, client skeleton, audit report, and session-tool log. Native threshold compaction fired repeatedly; the session-scoped `fixture_inventory` manifest remained present and the tool was invoked after compaction.
- The requested representative APK phase identified the official Google Play package `com.view.ppcs` and an APKCombo page for `V1.3.7`. Google Play required authentication; the APKCombo redirect reached an APKPure CDN bot gate (`403`). The download script applied a ZIP/APK magic-byte gate and saved no unverified file. No APK-specific claims were promoted to facts. `pi-interactive` remained running and untouched.
- The user-supplied LookCam APK was then tested in isolated containers with only that file mounted. With the package skill `skills/session-tools-workflow/SKILL.md` available and Pi `thinking low`, the agent immediately created `evidence/apk_inventory.md`, called `session_tool_create`, and invoked `fixture_inventory` repeatedly before doing deeper analysis. It produced bounded APK entry/manifest/Dex evidence and crossed a native 64k compaction boundary. The post-compaction crystallizer correctly failed open when the task used `evidence/apk_inventory.md` relative to `/workspace` while the file lived under `/workspace/lookcam-re`; this exposed a path-handling issue in the task setup, not a compaction failure. The saved run artifacts are outside the repository at `/tmp/lookcam-re-low-final` and `/tmp/lookcam-sessions-low-final`. The model still returned to speculative DEX decoding before completing all requested reports or a confirmed post-compaction tool invocation.
- The package now ships a concise session-tool workflow skill in `skills/session-tools-workflow/SKILL.md`, included by `npm pack` through `package.json`; it makes early tool creation, bounded reuse after compaction, `/tools review`/`/tools test`, and explicit-promotion boundaries operational guidance rather than relying on the task prompt alone.
- The opt-in `pi-compaction-recovery` package has been split into its own standalone repository directory, with publish metadata, README, release checks, and the same tested implementation. For overflow compaction it calls Pi's exported native `compact()` first, then retries with a transient reduction ladder: tool-result payloads first, assistant reasoning blocks only if needed. The fallback also raises only the transient summarizer reserve budget up to the model-declared output ceiling; persisted settings and entries are unchanged. The current Pi API exposes `session_compact_failed` only as an observer event, so post-failure recovery cannot safely be implemented there without a core API change.

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

- Runtime execution includes deterministic built-ins plus validated generated ES modules. Generated procedures run only as session-scoped artifacts, with an import/capability allowlist, workspace-relative path checks, minimal environment, timeout, and output cap. `fixture_inventory` remains available through `/tools-create-fixture-inventory <relative-path>` and caps inputs at 128 KiB, while `native_strings_search` is bounded to workspace-contained files.
- Branch inheritance semantics are deferred; artifacts are keyed to the exact session ID.
- The Pi `0.84.4` LookCam container probe found and fixed one API difference: `ModelRegistry.streamSimple` is absent there, so the adapter now uses `getProvider(model.provider).streamSimple()`, available in both installed versions. On the rerun, after the known `stopReason=length`, vLLM received the reduced recovery summarization request (about 2k prompt tokens and 520 generated tokens) and then a new continuation request; no extension error was emitted. The test Pi process remains active in the isolated container.
- An earlier recovery-package probe (before the native GC slice) saved a successful fallback compaction at `2026-09-20T15:03:10.419Z`; its missing post-compaction fixture call was a model/workflow adherence issue, not a recovery failure. The later native GC probe above independently proves post-compaction reuse.
- The discovery slice toward automatic garbage collection is implemented: `findRepeatedReadOnlyBashCandidates` scans a bounded entry suffix, recognizes repeated read-only command families inside harmless shell prefixes/pipelines, retains examples and source entry IDs, and rejects redirection, mutators, and arbitrary interpreters. Running it against the LookCam log found concrete candidates such as `strings|grep` (11 occurrences), `grep` (8), and `readelf|grep` (4).
- The next slice now materializes the repeated `strings|grep` candidate as session-scoped `builtin:native_strings_search`. It uses `execFile("strings", ...)` without a shell, enforces workspace containment, a 32 MiB input cap, a 32 KiB output cap, typed `path/query/minLength` parameters, provenance, and immediate registration. The runtime, candidate forwarding, and conservative default path are covered by the repository check.
- The pre-compaction garbage-collection slice is now present: after safe materialization, it mutates only Pi's in-memory `preparation.messagesToSummarize`/`turnPrefixMessages`, replacing matching verbose Bash tool results with a bounded provenance marker. The immutable JSONL history is untouched and Pi's native summarizer still owns compaction. A focused unit test verifies matching results are replaced while unrelated results remain intact. An earlier live probe still hit the known vLLM length-stop failure; the subsequent controlled probe below reaches the hook successfully.
- A fresh isolated Pi RPC probe in the LookCam container now validates the full pre-compaction path with real APK-derived native-library commands: 16 `strings|grep` observations produced a session-scoped `native_strings_search` manifest with 16 source entry IDs; the hook reported replacement of 4 verbose results; native manual compaction succeeded at `tokensBefore: 41427` and `estimatedTokensAfter: 20703`. The immutable JSONL contains the compaction entry and the manifest is under session key `gc-probe-lookcam-3`.
- The resume check now succeeds in the same isolated container: after reopening the saved LookCam session, the model emitted one `native_strings_search` call and the runtime returned 84 `DPS_` matches with `scope=session` and `originSession=gc-probe-lookcam-3`. This proves manifest restoration and actual post-compaction execution, not merely on-disk presence.
- `/tools test <name>` now dispatches the native runtime as well as demo/fixture runtimes; newly crystallized native manifests retain a conservative workspace-relative `defaultPath` derived from the observed command for this deterministic smoke test.
- A retrospective sweep of the real Archive.org session reproduced the failure mode: a direct reasoning-enabled 2048-token request returned no text after spending the budget on reasoning, while the same prompt with thinking disabled produced five parse-valid candidates. The extension now takes the latter Pi API path; `npm run check` passes all 23 tests.
- An exact pre-compaction replay of that session was run with Pi `0.84.4` and the updated extension. The hook reached the concrete provider simple stream (no `ctx.modelRegistry.streamSimple` error), emitted only a validation warning for one malformed candidate, and native compaction completed and appended its compaction entry. This replay did not materialize a generated tool because the stochastic model response had no remaining parse-valid candidate; the transport/reasoning failure is nevertheless removed.
- A debug replay of the same exact prefix isolated two additional field-only failures. First, the concrete-provider call returned `No API key for provider: vllm-local` because it bypassed registry auth; after forwarding resolved auth, the request completed. Second, omitting `reasoning` did not reliably disable Qwen thinking in this path: one replay returned only 99 non-JSON characters. With explicit `reasoning: "off"`, the exact replay returned five candidates, the validator accepted all five, and five session-scoped manifests were materialized under the replay session (`filter_provenance_records`, `deduplicate_provenance`, `list_running_processes_by_pattern`, `replace_text_in_file`, `summarize_provenance_by_category`). The validator also had a false positive for the safe parameter name `requireReferenceOnly`; its capability checks now recognize calls/imports rather than matching the `require` substring. This closes the standalone-versus-field discrepancy: the standalone experiment had already supplied auth and explicitly disabled thinking, while the original extension path had done neither.
- The complete real-session lifecycle is now verified on that Archive.org run: after native compaction, the resumed Pi session invoked `list_running_processes_by_pattern` successfully with `archive-lab`; after stopping and restarting Pi on the same JSONL/session store, it invoked the restored tool again with `serve.js` and returned the live `node scripts/serve.js` process. Both RPC events reported `isError: false`, `generated: true`, `scope: session`, and the original `originSession`. This is the first end-to-end field probe covering sweep, materialization, compaction, resume, restart, and actual generated-tool execution.
- Delete/review/promotion were covered by the manual Pi acceptance flow and store-level tests; the explicit-promotion invariant remains enforced at both layers, including a native-analysis manifest with runtime configuration.
- A real Lookcam capture/device trace is still required before implementing protocol/client behavior. Static APK evidence is now available in the saved isolated run; protocol/client behavior remains outside this lifecycle slice.

## Next smallest task

Extend the same bounded pattern to additional read-only candidate families and improve the compact provenance marker. The lifecycle/GC slice itself is complete; protocol/client behavior and the remaining RE report set are separate follow-on work.
