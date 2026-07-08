// ============================================================================
// OPTIONAL production hardening. Ably can POST presence events here via an
// Integration Rule (dashboard: Integrations -> new rule -> "Presence", channel
// filter ^room:, URL = https://<your-app>/api/ably/presence). When a player's
// connection drops without a clean leave (crash, network loss), Ably emits a
// "leave"/"absent" presence event and we mark them disconnected — the same
// thing the old socket "disconnect" handler did.
//
// Not required for the game to work: an explicit Leave and the pagehide beacon
// already cover normal exits. Without this rule, a hard crash just leaves a
// player shown as connected until the room empties.
// ============================================================================

import { NextResponse } from "next/server";
import { withGame } from "@/lib/game/runtime";

export const dynamic = "force-dynamic";

const LEAVE_ACTIONS = new Set(["leave", "absent", "3", "0"]);

function codeFromChannel(channel: unknown): string | null {
  if (typeof channel !== "string") return null;
  const m = /^room:([A-Za-z0-9]+)$/.exec(channel);
  return m ? m[1].toUpperCase() : null;
}

/** Best-effort extraction of {channel, action, clientId} from Ably's envelope. */
function extractPresence(body: unknown): { code: string; userId: string }[] {
  const out: { code: string; userId: string }[] = [];
  const items = (body as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return out;

  for (const item of items) {
    const rec = item as Record<string, unknown>;
    const channel = rec.channel;
    // Presence payload can live under `data`, `presence`, or inline.
    const presences = (rec.presence ?? rec.data ?? rec) as Record<string, unknown> | Record<string, unknown>[];
    const list = Array.isArray(presences) ? presences : [presences];
    for (const p of list) {
      const action = String(p.action ?? "");
      if (!LEAVE_ACTIONS.has(action)) continue;
      const code = codeFromChannel(channel ?? p.channel);
      const userId = typeof p.clientId === "string" ? p.clientId : "";
      if (code && userId) out.push({ code, userId });
    }
  }
  return out;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed payloads, don't retry-storm
  }

  const leaves = extractPresence(body);
  if (leaves.length > 0) {
    await withGame(async (m) => {
      for (const { code, userId } of leaves) {
        await m.handleDisconnect(code, userId).catch((e) => console.error("[presence]", e));
      }
    });
  }
  return NextResponse.json({ ok: true });
}
