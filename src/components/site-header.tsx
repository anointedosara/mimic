"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { LogOut, User, Volume2, VolumeX } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar-display";
import { isMuted, setMuted, playSound } from "@/lib/sounds";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const [muted, setMutedState] = useState(false);

  useEffect(() => setMutedState(isMuted()), []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playSound("click");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>

          {status === "authenticated" && session?.user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-white/5"
              >
                <AvatarDisplay avatar={session.user.avatar} size="xs" />
                <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:block">
                  {session.user.displayName}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : status === "loading" ? (
            <div className="h-9 w-24 skeleton" />
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">
                <User className="h-4 w-4" /> Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
