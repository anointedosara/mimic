// ============================================================================
// Thin helpers for the game API routes. Each action route: authenticate, parse
// the body, run a GameManager method inside withGame() (which flushes all Ably
// publishes + QStash schedules before returning), and reply with the AckResult.
// ============================================================================

import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { withGame } from "@/lib/game/runtime";
import type { GameManager } from "@/lib/game/server/manager";
import type { AckResult } from "@/lib/game/events";

type Action = (
  manager: GameManager,
  user: SessionUser,
  body: Record<string, unknown>,
) => Promise<AckResult | void>;

/** Authenticate, run the action with a flushing GameManager, return its ack. */
export async function authedAction(req: Request, action: Action): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // no/invalid body is fine for actions that don't need one
  }

  try {
    const res = await withGame((m) => action(m, user, body));
    return NextResponse.json(res ?? { ok: true });
  } catch (err) {
    console.error("[api] action failed", err);
    return NextResponse.json({ ok: false, error: "Something went wrong" }, { status: 500 });
  }
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}
