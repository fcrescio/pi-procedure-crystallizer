# pi-procedure-crystallizer

Session-scoped procedural memory for [Pi](https://pi.dev): preserve useful,
deterministic procedures before context compaction without silently turning
them into global tools.

During a long session the extension observes a bounded suffix of the Pi
history. Repeated safe read-only procedures can become named, inspectable
tools attached to that session. The artifact survives compaction and resume,
while unrelated sessions remain isolated. Promotion to the global store is
always an explicit user action.

## What is included

- lifecycle-safe session artifact storage and restoration;
- `/tools list`, `inspect`, `review`, `test`, `delete`, and `promote`;
- bounded pre-compaction discovery and provenance;
- `native_strings_search`, a workspace-contained runtime for native-library
  analysis;
- semantic replacement of crystallized tool results in Pi's in-memory native
  compaction preparation, without rewriting the JSONL session history;
- a small workflow skill for creating and reusing session tools.

The extension does not replace Pi's native compaction summarizer and does not
execute arbitrary generated source or install dependencies silently.

## Install

```bash
pi install npm:pi-procedure-crystallizer
```

Enable or inspect the package with `pi config`. To load a checkout directly:

```bash
pi -e ./extensions/index.ts
```

The package requires Node.js 22 or newer and a current Pi installation. Pi
supplies the `@earendil-works/pi-coding-agent` and `typebox` peer packages.

## User workflow

Session tools are created and restored automatically when the lifecycle finds a
safe candidate. Inspect them with:

```text
/tools list
/tools review
/tools inspect <name>
/tools test <name>
```

To copy one into the separate global store, use `/tools promote <name>` and
confirm the action. There is no implicit promotion path.

## Development

```bash
npm install
npm run check
npm pack --dry-run
```

The repository contains the product specification and design notes under
`docs/`. The deterministic tests run without launching Pi; the lifecycle
adapter has also been exercised against Pi 0.84.4 and a real LookCam APK.

## Safety boundary

Generated artifacts are executable capabilities. This package therefore keeps
runtime classes deliberately narrow, validates names and workspace paths,
caps input/output, records provenance, and keeps session persistence separate
from global scope. Review `docs/SECURITY.md` before adding a new runtime.

## License

MIT
