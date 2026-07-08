import { authedAction } from "@/lib/api/route-helpers";
import type { RoomSettings } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, (m, user, body) =>
    m.handleUpdateSettings(code, user.id, (body.settings ?? {}) as Partial<RoomSettings>),
  );
}
