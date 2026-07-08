// Transient-disconnect beacon (refresh / backgrounded tab / flaky network).
// Marks the player disconnected but keeps them in the room and keeps their host
// crown — unlike /leave, which is an explicit, permanent exit.

import { authedAction } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, async (m, user) => {
    await m.handleDisconnect(code, user.id);
  });
}
