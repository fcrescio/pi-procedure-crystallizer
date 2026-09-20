# Development status

## Current state

Bootstrap only. No lifecycle behavior has been proven yet.

## Known-good assumptions from current Pi documentation

- extensions can subscribe to `session_before_compact`;
- extensions can persist custom state with `pi.appendEntry()`;
- `pi.registerTool()` can register tools after startup and refresh them in the current session;
- sessions are persistent JSONL trees and compaction entries checkpoint system/tool declarations.

All API signatures must still be verified against the installed Pi version before implementation.

## Next smallest task

Implement a pure TypeScript artifact store with conservative naming/path validation and tests. No Pi runtime dependency is needed for that step.
