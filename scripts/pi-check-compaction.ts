import { appendFileSync } from "node:fs";
import {
  AgentSession,
  calculateContextTokens,
  estimateContextTokens,
  isContextOverflow,
  isRecoverableLength,
  shouldCompact,
} from "@earendil-works/pi-coding-agent";

const logPath = process.env.PI_CHECK_COMPACTION_LOG ?? "/tmp/pi-check-compaction.jsonl";

function log(record: Record<string, unknown>): void {
  try {
    appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`);
  } catch {
    // Diagnostics must never affect Pi.
  }
}

export default function register(): void {
  const prototype = AgentSession.prototype as AgentSession & {
    _checkCompaction?: (message: any, skipAbortedCheck?: boolean) => Promise<boolean>;
  };
  const original = prototype._checkCompaction;
  if (!original || (original as unknown as { __instrumented?: boolean }).__instrumented) return;

  const wrapped = async function (this: any, message: any, skipAbortedCheck = true): Promise<boolean> {
    const model = this.model;
    const settings = this.settingsManager.getCompactionSettings();
    const contextWindow = model?.contextWindow ?? 0;
    const sameModel = Boolean(model && message.provider === model.provider && message.model === model.id);
    const contextOverflow = sameModel && isContextOverflow(message, contextWindow);
    const recoverableLength = sameModel && isRecoverableLength(message, model?.maxTokens ?? 0);
    const directContextTokens = message.usage ? calculateContextTokens(message.usage) : 0;
    const estimate = directContextTokens === 0 || message.stopReason === "error"
      ? estimateContextTokens(this.agent.state.messages)
      : null;
    const contextTokens = estimate ? estimate.tokens : directContextTokens;
    log({
      event: "check_start",
      skipAbortedCheck,
      assistant: { provider: message.provider, model: message.model, stopReason: message.stopReason, usage: message.usage, timestamp: message.timestamp },
      runtimeModel: model ? { provider: model.provider, id: model.id, contextWindow: model.contextWindow, maxTokens: model.maxTokens } : null,
      settings,
      sameModel,
      contextOverflow,
      recoverableLength,
      directContextTokens,
      estimatedContextTokens: estimate?.tokens ?? null,
      estimateLastUsageIndex: estimate?.lastUsageIndex ?? null,
      threshold: contextWindow - settings.reserveTokens,
      shouldCompact: shouldCompact(contextTokens, contextWindow, settings),
    });
    let result: boolean;
    try {
      result = await original.call(this, message, skipAbortedCheck);
    } catch (error) {
      log({ event: "check_throw", error: String(error) });
      throw error;
    }
    log({ event: "check_result", result });
    return result;
  };
  (wrapped as unknown as { __instrumented?: boolean }).__instrumented = true;
  prototype._checkCompaction = wrapped;
}
