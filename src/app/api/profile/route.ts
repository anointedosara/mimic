import { NextResponse, type NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/User";
import { updateProfileSchema } from "@/lib/validation";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = user.statistics;
  const winRate = s.gamesPlayed ? Math.round((s.wins / s.gamesPlayed) * 100) : 0;
  return NextResponse.json({
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    avatar: user.avatar,
    statistics: { ...s, winRate },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findByIdAndUpdate(session.user.id, parsed.data, { new: true });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ displayName: user.displayName, avatar: user.avatar });
}
