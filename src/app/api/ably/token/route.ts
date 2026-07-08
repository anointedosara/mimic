// ============================================================================
// Ably token endpoint. Replaces the Socket.IO `io.use` auth middleware.
//
// The browser never holds the Ably API key — it calls this route, we verify the
// NextAuth session, and mint a short-lived token scoped to exactly what this
// player may do:
//   - room:*            subscribe + presence  (public room state + roster)
//   - user:{me}:*       subscribe             (ONLY my own private role)
//   - voice:*           publish/subscribe/presence  (WebRTC signaling)
// ============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ablyRest } from "@/lib/ably/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capability = {
    "room:*": ["subscribe", "presence"],
    [`user:${userId}:*`]: ["subscribe"],
    "voice:*": ["publish", "subscribe", "presence"],
  };

  try {
    const tokenRequest = await ablyRest().auth.createTokenRequest({
      clientId: userId,
      capability: JSON.stringify(capability),
    });
    return NextResponse.json(tokenRequest);
  } catch (err) {
    console.error("[ably/token]", err);
    return NextResponse.json({ error: "Could not mint token" }, { status: 500 });
  }
}
