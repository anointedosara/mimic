import { authedAction, strArray } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, (m, user, body) =>
    m.handleCastVote(code, user.id, strArray(body.targetIds)),
  );
}
