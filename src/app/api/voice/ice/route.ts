// ============================================================================
// ICE server endpoint for WebRTC voice. Session-gated so TURN credentials are
// only handed to authenticated players. The client fetches this on join and
// feeds the result into each RTCPeerConnection.
// ============================================================================

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getIceServers, hasTurn } from "@/lib/voice/ice";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ iceServers: await getIceServers(), relay: hasTurn() });
}
