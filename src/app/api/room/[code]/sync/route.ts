import { authedAction } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, async (m, user) => {
    await m.syncTo(code, user.id);
  });
}
