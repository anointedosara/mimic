import { authedAction, str } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return authedAction(req, (m, user, body) => {
    const replyTo = body.replyTo == null ? null : str(body.replyTo);
    return m.handleChat(code, user.id, str(body.text), replyTo);
  });
}
