"use client";

import type { AckResult } from "@/lib/game/events";

/**
 * POST a game action to an API route and return its AckResult. Replaces the old
 * Socket.IO emit-with-ack. Network/parse failures resolve to a soft error so
 * callers never throw on a dropped request.
 */
export async function postAction<T = AckResult>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
    });
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: "Network error" } as unknown as T;
  }
}

/** Fire-and-forget action that survives page unload (uses sendBeacon). */
export function beaconAction(path: string, body?: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(body ?? {})], { type: "application/json" });
    if (navigator.sendBeacon(path, blob)) return;
  } catch {
    /* fall through */
  }
  void postAction(path, body);
}
