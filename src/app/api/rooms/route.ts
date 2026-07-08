import { NextResponse, type NextRequest } from "next/server";
import { customAlphabet } from "nanoid";
import { getAuthSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Room } from "@/lib/db/models/Room";
import { createRoomSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, clampImposters } from "@/lib/game/config";

const genCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    const exists = await Room.exists({ code });
    if (!exists) return code;
  }
  // Extremely unlikely fallback.
  return genCode() + genCode().slice(0, 2);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`create-room:${session.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Slow down — too many rooms created." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const settings = {
    ...parsed.data,
    imposterCount: clampImposters(parsed.data.imposterCount, parsed.data.maxPlayers),
  };

  try {
    await connectToDatabase();
    const code = await uniqueCode();
    await Room.create({
      code,
      hostId: session.user.id,
      phase: "lobby",
      round: 0,
      settings,
      players: [
        {
          userId: session.user.id,
          displayName: session.user.displayName,
          avatar: session.user.avatar,
          isHost: true,
          connected: false, // becomes true once their socket joins
        },
      ],
    });

    return NextResponse.json({ code }, { status: 201 });
  } catch (err) {
    console.error("[create-room]", err);
    return NextResponse.json({ error: "Could not create room" }, { status: 500 });
  }
}
