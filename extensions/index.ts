import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { NoopReflectionEngine } from "../src/reflection.js";

/**
 * Bootstrap adapter only.
 *
 * Codex should verify the installed Pi API and implement the first vertical slice
 * described in BOOTSTRAP_PROMPT.md. Keeping this intentionally small avoids
 * cementing guessed session-path and dynamic-tool lifecycle semantics.
 */
export default function sessionToolsExtension(pi: ExtensionAPI) {
  const reflection = new NoopReflectionEngine();

  pi.registerCommand("tools", {
    description: "Review and manage session-scoped tools (bootstrap placeholder)",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        "pi-session-tools bootstrap loaded. Implement the v0 lifecycle from BOOTSTRAP_PROMPT.md.",
        "info",
      );
    },
  });

  pi.on("session_before_compact", async (event, ctx) => {
    try {
      const sessionFile = ctx.sessionManager.getSessionFile?.();
      await reflection.maybeCrystallize({
        reason: event.reason,
        sessionKey: sessionFile ?? "ephemeral",
        signal: event.signal,
      });
    } catch (error) {
      ctx.ui.notify(`Session-tool reflection skipped: ${String(error)}`, "warning");
    }
    // Intentionally return nothing: do not cancel or replace Pi compaction.
  });
}
