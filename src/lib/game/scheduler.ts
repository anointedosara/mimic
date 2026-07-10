// ============================================================================
// Scheduler — transport-agnostic phase-timer interface used by GameManager.
//
// The old server used setTimeout to auto-advance phases. Serverless has no
// long-lived process, so instead we ask the scheduler to "advance this room's
// phase in N ms". The concrete impl schedules a delayed HTTP callback (QStash
// in prod; in-process setTimeout in dev). The advance is idempotent: it re-reads
// the room and only transitions if the phase/deadline still warrants it, so a
// stale or duplicate callback is a safe no-op.
// ============================================================================

export interface Scheduler {
  /** Schedule an idempotent phase-advance for a room after delayMs. */
  armAdvance(code: string, delayMs: number): void;
  /**
   * Schedule the next AI discussion "turn" for a room after delayMs. The tick
   * posts one AI chat line and re-arms itself, so AI banter continues through
   * the discussion. Self-guarding: a tick outside the discussion phase is a
   * no-op and stops the chain.
   */
  armAI(code: string, delayMs: number): void;
  /** Best-effort cancel. Safe to no-op — advance() guards itself anyway. */
  cancel(code: string): void;
}

/** A Scheduler that batches its scheduling calls and flushes them on demand. */
export interface FlushableScheduler extends Scheduler {
  flush(): Promise<void>;
}
