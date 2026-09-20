# External references

These URLs were current when the bootstrap was generated (2026-09-20). Verify again during implementation.

- Pi Extensions: https://pi.dev/docs/latest/extensions
- Pi Compaction: https://pi.dev/docs/latest/compaction
- Pi Session File Format: https://pi.dev/docs/latest/session-format
- Pi package template: https://pi.dev/packages/pi-package-template
- pi-code-tool: https://pi.dev/packages/pi-code-tool
- pi-compaction-model: https://pi.dev/packages/pi-compaction-model
- Pi model catalog: https://pi.dev/models

Useful current facts to re-check locally:

- `session_before_compact` fires for manual and automatic compaction.
- `pi.registerTool()` may be called after startup and refreshes active tool availability.
- `pi.appendEntry()` stores extension state outside LLM context.
- Pi package TypeScript is normally loaded directly; a build step is not inherently required.
