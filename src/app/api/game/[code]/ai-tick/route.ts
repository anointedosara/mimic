// ============================================================================
// AI discussion-turn callback. In production this is invoked by QStash after the
// scheduled delay; we verify the Upstash signature so only QStash can trigger
// it. aiChatTick() is self-guarding (no-op outside the discussion phase) and
// re-arms itself, so the AI banter chain runs for the length of the discussion.
// In dev the scheduler calls runAITick() in-process and this route isn't used.
// ============================================================================

import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { runAITick } from "@/lib/game/runtime";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.text();

  const cur = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (cur && next) {
    const signature = req.headers.get("upstash-signature") ?? "";
    const receiver = new Receiver({ currentSigningKey: cur, nextSigningKey: next });
    const valid = await receiver.verify({ signature, body }).catch(() => false);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Scheduler not configured" }, { status: 503 });
  }

  await runAITick(code);
  return NextResponse.json({ ok: true });
}
