"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Eye, RotateCw, Users, Home, Trophy } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { burstConfetti, evilConfetti } from "@/lib/confetti";
import { usePassPlayStore } from "@/store/passplay-store";

export function Result() {
  const router = useRouter();
  const result = usePassPlayStore((s) => s.result);
  const players = usePassPlayStore((s) => s.players);
  const playAgain = usePassPlayStore((s) => s.playAgainSameTable);
  const editPlayers = usePassPlayStore((s) => s.editPlayers);

  const [flipped, setFlipped] = useState(false);

  const playersWon = result?.winningSide === "players";

  useEffect(() => {
    if (!flipped || !result) return;
    if (playersWon) {
      playSound("win");
      burstConfetti();
    } else {
      playSound("lose");
      evilConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  if (!result) return null;

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown";

  // Pre-reveal suspense gate.
  if (!flipped) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center"
        >
          <div className="text-6xl">🎭</div>
          <h2 className="mt-4 font-display text-3xl font-black">The votes are in</h2>
          <p className="mt-2 text-muted-foreground">
            Gather round — time to find out who was blending in.
          </p>
          <Button
            variant="gradient"
            size="lg"
            className="mt-8 w-full glow"
            onClick={() => {
              playSound("reveal");
              setFlipped(true);
            }}
          >
            <Eye className="h-5 w-5" /> Reveal imposters
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
          {playersWon
            ? "Every imposter was sniffed out. 🎉"
            : "At least one imposter blended in and escaped."}
        </p>
      </motion.div>

      {/* Word & hint */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-cyan-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              The real word
            </div>
            <div className="mt-2 font-display text-3xl font-black text-white">{result.realWord}</div>
            <Badge variant="outline" className="mt-2">
              {result.category}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              The imposter hint
            </div>
            <div className="mt-2 font-display text-3xl font-black text-rose-300">
              {result.imposterHint}
            </div>
            <Badge variant="outline" className="mt-2">
              {result.imposters.length} imposter{result.imposters.length > 1 ? "s" : ""}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Imposter flip cards */}
      <div>
        <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          The imposters were…
        </h3>
        <div className="flex flex-wrap justify-center gap-4">
          {result.imposters.map((imp, i) => (
            <motion.div
              key={imp.id}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: i * 0.2, type: "spring", stiffness: 60, damping: 12 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <Card
                className={cn(
                  "w-40 border-2 p-4 text-center",
                  imp.caught ? "border-emerald-500/50" : "border-rose-500/60",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <AvatarDisplay avatar={imp.avatar} size="lg" />
                  <div className="font-display font-bold">{imp.name}</div>
                  <div className="text-3xl">{imp.caught ? "😔" : "😈"}</div>
                  <Badge variant={imp.caught ? "success" : "destructive"}>
                    {imp.caught ? "Caught!" : "Escaped!"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {imp.caught ? "The imposter was caught" : "The imposter escaped"}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Vote breakdown — who the group voted out */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4" /> The group voted out
          </h3>
          <div className="space-y-2">
            {result.accusedIds.map((id) => {
              const wasImposter = result.imposters.some((imp) => imp.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                >
                  <span className="truncate text-sm font-medium">{nameOf(id)}</span>
                  {wasImposter ? (
                    <Badge variant="success">Imposter 😈</Badge>
                  ) : (
                    <Badge variant="outline">Innocent</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="sticky bottom-4 z-10 flex flex-col gap-2 sm:flex-row"
        >
          <Button
            variant="gradient"
            size="lg"
            className="flex-1 glow"
            onClick={() => {
              playSound("start");
              playAgain();
            }}
          >
            <RotateCw className="h-5 w-5" /> Play again · same players
          </Button>
          <Button variant="outline" size="lg" onClick={editPlayers}>
            <Users className="h-5 w-5" /> Edit players
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/")}>
            <Home className="h-5 w-5" /> Home
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
