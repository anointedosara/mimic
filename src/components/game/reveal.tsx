"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCw, Loader2, Trophy, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoomSnapshot } from "@/lib/game/types";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { roomActions } from "@/hooks/use-room";
import { burstConfetti, evilConfetti } from "@/lib/confetti";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export function Reveal({ snapshot, selfId }: { snapshot: RoomSnapshot; selfId: string }) {
  const router = useRouter();
  const reveal = snapshot.reveal;
  const isHost = snapshot.hostId === selfId;
  const [flipped, setFlipped] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const playersWon = reveal?.winningSide === "players";
  const selfWon = reveal?.winners.includes(selfId);

  useEffect(() => {
    if (!reveal) return;
    // Auto-flip after a short beat for drama.
    const t = setTimeout(() => setFlipped(true), 400);
    return () => clearTimeout(t);
  }, [reveal]);

  useEffect(() => {
    if (!flipped || !reveal) return;
    if (selfWon) {
      playSound("win");
      burstConfetti();
    } else {
      playSound("lose");
      if (reveal.winningSide === "imposters") evilConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  async function playAgain() {
    setRestarting(true);
    const res = await roomActions.playAgain(snapshot.code);
    setRestarting(false);
    if (!res.ok) toast.error(res.error ?? "Could not restart");
  }

  if (!reveal) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "overflow-hidden rounded-3xl border p-6 text-center sm:p-8",
          playersWon
            ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 to-indigo-950/50"
            : "border-rose-500/40 bg-gradient-to-br from-rose-950/60 to-purple-950/50",
        )}
      >
        <div className="text-5xl sm:text-6xl">{playersWon ? "🕵️" : "😈"}</div>
        <h2
          className={cn(
            "mt-2 font-display text-3xl font-black sm:text-4xl",
            playersWon ? "text-cyan-300" : "text-rose-300",
          )}
        >
          {playersWon ? "Players win!" : "Imposters win!"}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {selfWon ? "You were on the winning side! 🎉" : "Better luck next round."}
        </p>
      </motion.div>

      {/* Word & hint reveal */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-cyan-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              The real word
            </div>
            <div className="mt-2 font-display text-3xl font-black text-white">{reveal.realWord}</div>
            <Badge variant="outline" className="mt-2">
              {reveal.category}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              The imposter hint
            </div>
            <div className="mt-2 font-display text-3xl font-black text-rose-300">{reveal.imposterHint}</div>
            <Badge variant="outline" className="mt-2">
              {reveal.imposters.length} imposter{reveal.imposters.length > 1 ? "s" : ""}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Imposter cards — flip animation */}
      <div>
        <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          The imposters were…
        </h3>
        <div className="flex flex-wrap justify-center gap-4">
          {reveal.imposters.map((imp, i) => (
            <motion.div
              key={imp.userId}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: flipped ? 0 : 180 }}
              transition={{ delay: i * 0.2, type: "spring", stiffness: 60, damping: 12 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative"
            >
              <Card
                className={cn(
                  "w-40 border-2 p-4 text-center",
                  imp.caught ? "border-emerald-500/50" : "border-rose-500/60",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <AvatarDisplay avatar={imp.avatar} size="lg" />
                  <div className="font-display font-bold">{imp.displayName}</div>
                  <div className="text-3xl">{imp.caught ? "😔" : "😈"}</div>
                  <Badge variant={imp.caught ? "success" : "destructive"}>
                    {imp.caught ? "Caught!" : "Escaped!"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {imp.votesReceived} vote{imp.votesReceived === 1 ? "" : "s"}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {flipped && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 text-center font-display text-lg font-bold"
            >
              {reveal.imposters.every((i) => i.caught)
                ? "Every imposter was caught! 🎯"
                : reveal.imposters.some((i) => i.caught)
                  ? "Some slipped through the cracks…"
                  : "The imposters escaped! 😈"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Vote breakdown */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4" /> Vote breakdown
          </h3>
          <div className="space-y-2">
            {reveal.voteBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">No votes were cast.</p>
            )}
            {reveal.voteBreakdown.map((row) => {
              const wasImposter = reveal.imposters.some((i) => i.userId === row.targetId);
              const max = reveal.voteBreakdown[0]?.votes || 1;
              return (
                <div key={row.targetId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium">{row.targetName}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.votes / max) * 100}%` }}
                      transition={{ delay: 0.3 }}
                      className={cn("h-full rounded-full", wasImposter ? "bg-rose-500" : "bg-primary")}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-bold tabular-nums">{row.votes}</span>
                  {wasImposter && <span title="Was an imposter">😈</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-2 sm:flex-row">
        {isHost ? (
          <Button variant="gradient" size="lg" className="flex-1 glow" onClick={playAgain} disabled={restarting}>
            {restarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCw className="h-5 w-5" />}
            Play again
          </Button>
        ) : (
          <div className="glass flex-1 rounded-2xl p-4 text-center text-sm text-muted-foreground">
            Waiting for the host to start a new round…
          </div>
        )}
        <Button variant="outline" size="lg" onClick={() => router.push("/")}>
          <Home className="h-5 w-5" /> Home
        </Button>
      </div>
    </div>
  );
}
