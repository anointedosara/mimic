"use client";

// ============================================================================
// Browser Ably client. Uses token auth (authUrl -> /api/ably/token) so the API
// key never reaches the browser. A single shared Realtime instance is reused
// across the app, mirroring the old getSocket() singleton.
// ============================================================================

import * as Ably from "ably";

let client: Ably.Realtime | null = null;

export function getAbly(): Ably.Realtime {
  if (client) return client;
  client = new Ably.Realtime({
    authUrl: "/api/ably/token",
    // Send the NextAuth session cookie with the token request.
    authMethod: "GET",
    echoMessages: false,
    // Recover/resume transparently across brief drops.
    disconnectedRetryTimeout: 2000,
    suspendedRetryTimeout: 4000,
  });
  return client;
}

/** Tear down the shared client (e.g. on sign-out). */
export function closeAbly() {
  if (client) {
    client.close();
    client = null;
  }
}
