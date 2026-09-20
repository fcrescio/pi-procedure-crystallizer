export interface ReflectionInput {
  reason: "manual" | "threshold" | "overflow" | string;
  sessionKey: string;
  signal?: AbortSignal;
}

export interface ReflectionEngine {
  maybeCrystallize(input: ReflectionInput): Promise<void>;
}

/** First milestone deliberately does no LLM work. */
export class NoopReflectionEngine implements ReflectionEngine {
  async maybeCrystallize(_input: ReflectionInput): Promise<void> {
    return;
  }
}
