// ============================================================================
// Emitter — transport-agnostic broadcast interface used by GameManager.
//
// The manager never talks to Ably (or Socket.IO) directly; it calls toRoom /
// toUser. In serverless we can't fire-and-forget: the function may be frozen
// the instant the HTTP response is sent, killing any in-flight publish. So the
// concrete emitter BUFFERS messages synchronously and the API route awaits
// flush() before returning — guaranteeing every publish actually leaves.
// ============================================================================

export interface Emitter {
  /** Publish to everyone in a room (public state, notices, closed). */
  toRoom(code: string, event: string, payload: unknown): void;
  /** Publish to a single player's private channel (their secret role). */
  toUser(code: string, userId: string, event: string, payload: unknown): void;
}

/** A buffered message awaiting flush. */
export interface PendingMessage {
  channel: string;
  event: string;
  data: unknown;
}

/** An Emitter that also exposes flush() to drain its buffer to the transport. */
export interface FlushableEmitter extends Emitter {
  flush(): Promise<void>;
}
