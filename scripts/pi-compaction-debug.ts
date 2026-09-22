import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const logPath = process.env.PI_COMPACTION_DEBUG_LOG ?? "/tmp/pi-compaction-debug.jsonl";

function write(record: Record<string, unknown>): void {
  appendFileSync(logPath, `${JSON.stringify({
    at: new Date().toISOString(),
    ...record,
  })}\n`);
}

export default function register(pi: ExtensionAPI): void {
  pi.on("agent_end", (event, ctx) => {
    const assistants = event.messages.filter((message) => message.role === "assistant");
    const message = assistants.at(-1);
    write({
      event: "agent_end",
      assistant: message
        ? {
            provider: message.provider,
            model: message.model,
            stopReason: message.stopReason,
            usage: message.usage,
            timestamp: message.timestamp,
          }
        : null,
      runtimeModel: ctx.model
        ? {
            provider: ctx.model.provider,
            id: ctx.model.id,
            contextWindow: ctx.model.contextWindow,
            maxTokens: ctx.model.maxTokens,
          }
        : null,
      contextUsage: ctx.getContextUsage?.() ?? null,
      hasPendingMessages: ctx.hasPendingMessages(),
    });
  });

  pi.on("session_before_compact", (event) => {
    write({
      event: "session_before_compact",
      reason: event.reason,
      tokensBefore: event.preparation.tokensBefore,
      messagesToSummarize: event.preparation.messagesToSummarize.length,
      turnPrefixMessages: event.preparation.turnPrefixMessages.length,
      branchEntries: event.branchEntries.length,
    });
  });
}
