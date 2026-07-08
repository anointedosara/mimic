// ============================================================================
// Server-side Ably (REST). Used only by API routes to (a) publish game events
// and (b) mint scoped tokens for browsers. The API key never leaves the server.
// ============================================================================

import Ably from "ably";
import type { FlushableEmitter, PendingMessage } from "@/lib/game/emitter";
import { roomChannel, userChannel } from "./channels";

let rest: Ably.Rest | null = null;

export function ablyRest(): Ably.Rest {
  if (rest) return rest;
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("ABLY_API_KEY is not set — add it to .env.local / Vercel env.");
  rest = new Ably.Rest({ key });
  return rest;
}

/**
 * A buffering emitter. GameManager writes to it synchronously; the API route
 * awaits flush() before responding so no publish is lost when the serverless
 * function freezes.
 */
export function createEmitter(): FlushableEmitter {
  const pending: PendingMessage[] = [];
  return {
    toRoom(code, event, data) {
      pending.push({ channel: roomChannel(code), event, data });
    },
    toUser(code, userId, event, data) {
      pending.push({ channel: userChannel(code, userId), event, data });
    },
    async flush() {
      if (pending.length === 0) return;
      const client = ablyRest();
      const byChannel = new Map<string, PendingMessage[]>();
      for (const m of pending) {
        const arr = byChannel.get(m.channel) ?? [];
        arr.push(m);
        byChannel.set(m.channel, arr);
      }
      pending.length = 0;
      await Promise.all(
        [...byChannel.entries()].map(([channel, msgs]) =>
          client.channels.get(channel).publish(msgs.map((m) => ({ name: m.event, data: m.data }))),
        ),
      );
    },
  };
}
