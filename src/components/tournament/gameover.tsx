"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RotateCw, Settings2, Home, Skull, Bot, Crown } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { burstConfetti, evilConfetti } from "@/lib/confetti";
import { useTournamentStore } from "@/store/tournament-store";
import { Progression } from "./progression";
import { Leaderboard } from "./leaderboard";

export function GameOver() {
  const router = useRouter();
  const outcome = useTournamentStore((s) => s.outcome);
  const players = useTournamentStore((s) => s.players);
  const humanId = useTournamentStore((s) => s.humanId);
  const imposterIds = useTournamentStore((s) => s.imposterIds);
  const eliminatedIds = useTournamentStore((s) => s.eliminatedIds);
  const history = useTournamentStore((s) => s.history);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const settings = useTournamentStore((s) => s.settings);
  const startTournament = useTournamentStore((s) => s.startTournament);
  const editSetup = useTournamentStore((s) => s.editSetup);

  const impostersWon = outcome === "imposters_win";
  const humanIsImposter = imposterIds.includes(humanId);
  const humanWon = impostersWon ? humanIsImposter : !humanIsImposter;

  const eliminated = useMemo(() => new Set(eliminatedIds), [eliminatedIds]);
  const imposters = useMemo(
    () => players.filter((p) => imposterIds.includes(p.id)),
    [players, imposterIds],
  );
  const survivors = useMemo(
    () => players.filter((p) => !eliminated.has(p.id)),
    [players, eliminated],
  );

  useEffect(() => {
    if (humanWon) {
      playSound("win");
      burstConfetti();
      setTimeout(burstConfetti, 500);
    } else {
      playSound("lose");
      evilConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playAgain() {
    const human = players.find((p) => p.id === humanId);
    if (!human) {
      editSetup();
      return;
    }
    playSound("start");
    // Fresh identity id each tournament, same name/avatar and settings.
    startTournament({ ...human, personality: null, isAI: false }, settings);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Winner banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "overflow-hidden rounded-3xl border p-8 text-center sm:p-10",
          impostersWon
            ? "border-rose-500/40 bg-gradient-to-br from-rose-950/70 to-purple-950/60"
            : "border-cyan-500/40 bg-gradient-to-br from-cyan-950/70 to-indigo-950/60",
        )}
      >
        <motion.div
          initial={{ scale: 0.3, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12 }}
          className="text-6xl sm:text-7xl"
        >
          {impostersWon ? "😈" : "🎉"}
        </motion.div>
        <h1
          className={cn(
            "mt-3 font-display text-4xl font-black sm:text-5xl",
            impostersWon ? "text-rose-300" : "text-cyan-300",
          )}
        >
          {impostersWon ? "Imposters Win" : "Players Win"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {impostersWon
            ? "The mimics reached parity and took over the game."
            : "Every imposter was hunted down and eliminated."}
        </p>
        <Badge
          variant={humanWon ? "success" : "destructive"}
          className="mt-4 px-3 py-1 text-sm"
        >
          {humanWon ? "🏆 You won!" : "☠️ You lost"}
        </Badge>
        <div className="mt-2 text-xs text-muted-foreground">
          {roundNumber} round{roundNumber === 1 ? "" : "s"} played
        </div>
      </motion.div>

      {/* Imposters revealed */}
      <div>
        <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          The imposters were…
        </h3>
        <div className="flex flex-wrap justify-center gap-4">
          {imposters.map((imp, i) => {
            const caught = eliminated.has(imp.id);
            const isHuman = imp.id === humanId;
            return (
              <motion.div
                key={imp.id}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 60, damping: 12 }}
              >
                <Card className={cn("w-40 border-2 p-4 text-center", caught ? "border-emerald-500/50" : "border-rose-500/60")}>
                  <div className="flex flex-col items-center gap-2">
                    <AvatarDisplay avatar={imp.avatar} size="lg" dimmed={caught} />
                    <div className="flex items-center gap-1 font-display font-bold">
                      {isHuman ? "You" : imp.name}
                      {!isHuman && imp.isAI && <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="text-3xl">{caught ? "😔" : "😈"}</div>
                    <Badge variant={caught ? "success" : "destructive"}>
                      {caught ? "Caught" : "Survived"}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Survivors */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Crown className="h-4 w-4 text-mimic-amber" /> Still standing
          </h3>
          {survivors.length ? (
            <div className="flex flex-wrap gap-2">
              {survivors.map((p) => {
                const isImp = imposterIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3",
                      isImp ? "bg-rose-500/10" : "bg-emerald-500/10",
                    )}
                  >
                    <AvatarDisplay avatar={p.avatar} size="xs" />
                    <span className="text-sm font-medium">{p.id === humanId ? "You" : p.name}</span>
                    {isImp && <Skull className="h-3 w-3 text-rose-300" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No one — mutual destruction!</p>
          )}
        </CardContent>
      </Card>

      {/* Full progression */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Elimination order
          </h3>
          <Progression history={history} />
        </CardContent>
      </Card>

      {/* Leaderboard (refreshes to include this tournament) */}
      <Leaderboard refreshKey={history.length + (impostersWon ? "i" : "p")} />

      {/* Actions */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-2 sm:flex-row">
        <Button variant="gradient" size="lg" className="flex-1 glow" onClick={playAgain}>
          <RotateCw className="h-5 w-5" /> New tournament
        </Button>
        <Button variant="outline" size="lg" onClick={editSetup}>
          <Settings2 className="h-5 w-5" /> Change setup
        </Button>
        <Button variant="outline" size="lg" onClick={() => router.push("/")}>
          <Home className="h-5 w-5" /> Home
        </Button>
      </div>
    </div>
  );
}
