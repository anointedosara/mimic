import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function getAuthSession() {
  return getServerSession(authOptions);
}

export interface SessionUser {
  id: string;
  displayName: string;
  avatar: string;
}

/** Resolve the authenticated user for an API route, or null if unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    displayName: session.user.displayName ?? session.user.name ?? "Player",
    avatar: session.user.avatar ?? "fox",
  };
}
