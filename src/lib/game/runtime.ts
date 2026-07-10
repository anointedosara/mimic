// ============================================================================
// Runtime factory — builds a GameManager wired to the Ably emitter and the
// QStash/dev scheduler. Each API request creates a fresh instance (serverless
// has no shared long-lived state) and MUST await flush() before responding so
// every buffered publish/schedule actually leaves before the function freezes.
// ============================================================================

import { GameManager } from "@/lib/game/server/manager";
import { createEmitter } from "@/lib/ably/server";
import { createScheduler } from "@/lib/schedule/scheduler";

export function createGame() {
  const emitter = createEmitter();
  const scheduler = createScheduler();
  const manager = new GameManager(emitter, scheduler);
  const flush = async () => {
    await emitter.flush();
    await scheduler.flush();
  };
  return { manager, flush };
}

/** Run a handler with a manager, then flush all side effects. */
export async function withGame<T>(fn: (m: GameManager) => Promise<T>): Promise<T> {
  const { manager, flush } = createGame();
  try {
    return await fn(manager);
  } finally {
    await flush();
  }
}

/** Idempotent phase-advance, invoked by the scheduler callback (QStash / dev). */
export async function advanceRoom(code: string): Promise<void> {
  await withGame((m) => m.advancePhase(code));
}

/** One AI discussion turn, invoked by the scheduler callback (QStash / dev). */
export async function runAITick(code: string): Promise<void> {
  await withGame((m) => m.aiChatTick(code));
}
