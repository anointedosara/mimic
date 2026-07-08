import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Room } from "@/lib/db/models/Room";

// Public, non-secret room summary — used by the /join page to validate a code.
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const normalized = code.toUpperCase();

  await connectToDatabase();
  const room = await Room.findOne({ code: normalized })
    .select("code phase settings players.userId players.displayName")
    .lean();

  if (!room) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }

  return NextResponse.json({
    exists: true,
    code: room.code,
    phase: room.phase,
    playerCount: room.players.length,
    maxPlayers: room.settings.maxPlayers,
    joinable: room.phase === "lobby" && room.players.length < room.settings.maxPlayers,
  });
}
