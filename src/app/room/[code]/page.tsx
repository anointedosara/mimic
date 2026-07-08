"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useRoom, roomActions } from "@/hooks/use-room";
import { useGameStore } from "@/store/game-store";
import { RoomBar } from "@/components/game/room-bar";
import { VoiceBar } from "@/components/game/voice-bar";
import { Lobby } from "@/components/game/lobby";
import { RoleReveal } from "@/components/game/role-reveal";
import { Discussion } from "@/components/game/discussion";
import { Voting } from "@/components/game/voting";
import { Reveal } from "@/components/game/reveal";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const router = useRouter();
  const { status, data: session } = useSession();

  const { snapshot, role, status: connStatus, joinError } = useGameStore();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/room/${code}`)}`);
    }
  }, [status, router, code]);

  // Only connect once authenticated.
  useRoom(status === "authenticated" ? code : "");

  const selfId = session?.user?.id ?? "";

  function leave() {
    roomActions.leave(code);
    useGameStore.getState().reset();
    router.push("/");
  }

  // Auth loading / redirect state
  if (status !== "authenticated") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Join error (room full / not found / in progress)
  if (joinError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="glass-strong max-w-md space-y-5 rounded-3xl p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/20 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <Logo size="sm" />
          <p className="text-muted-foreground">{joinError}</p>
          <div className="flex justify-center gap-3">
            <Button variant="gradient" onClick={() => router.push("/join")}>
              Try another code
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="container max-w-5xl py-5">
        <RoomBar code={code} status={connStatus} onLeave={leave} />

        {snapshot && (
          <div className="mt-4">
            <VoiceBar code={code} selfId={selfId} />
          </div>
        )}

        <div className="mt-6">
          {!snapshot ? (
            <LoadingState />
          ) : (
            // No AnimatePresence "mode=wait" here: it can strand the incoming
            // phase if the outgoing exit animation never completes, leaving the
            // body blank until a manual refresh. A keyed motion.div re-mounts
            // (and re-animates) on every phase change and always renders. The
            // ErrorBoundary guards against a throwing phase blanking the screen
            // and auto-recovers when the next snapshot arrives.
            <ErrorBoundary resetKey={snapshot}>
              <motion.div
                key={snapshot.phase}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {snapshot.phase === "lobby" && <Lobby snapshot={snapshot} selfId={selfId} />}
                {snapshot.phase === "role" && <RoleReveal role={role} />}
                {snapshot.phase === "discussion" && (
                  <Discussion snapshot={snapshot} role={role} selfId={selfId} />
                )}
                {snapshot.phase === "voting" && <Voting snapshot={snapshot} selfId={selfId} />}
                {snapshot.phase === "reveal" && <Reveal snapshot={snapshot} selfId={selfId} />}
                {snapshot.phase === "ended" && (
                  <div className="glass grid h-64 place-items-center rounded-3xl text-muted-foreground">
                    This room has closed.
                  </div>
                )}
              </motion.div>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
