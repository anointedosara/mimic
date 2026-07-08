// ============================================================================
// Client-driven phase-advance fallback. Unlike the QStash-signed /advance route,
// this is called by a room participant's browser (the host) when the scheduled
// callback doesn't arrive — e.g. QStash can't reach the app's URL, or a frozen
// serverless function never ran the timer. handleClientAdvance only advances
// when genuinely due (and is lock/phase-guarded), so it's a safe no-op if the
// scheduler already did the work.
// ============================================================================

import { authedAction } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, (m, user) => m.handleClientAdvance(code, user.id));
}
