"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Eye, RotateCw, Settings2, Home, Trophy, Bot } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { burstConfetti, evilConfetti } from "@/lib/confetti";
import { useSoloStore } from "@/store/solo-store";
import { StatsPanel } from "./stats-panel";
import { ChatPanel } from "./conversation";

/** Human-specific headline for the outcome. */
function humanHeadline(opts: { wasImposter: boolean; caught: boolean; won: boolean }) {
  const { wasImposter, caught, won } = opts;
  if (wasImposter && !caught) return { emoji: "😈", title: "You fooled everyone!", tone: "bad" as const };
  if (wasImposter && caught) return { emoji: "😔", title: "You were exposed!", tone: "good" as const };
  if (won) return { emoji: "🎉", title: "You identified the imposters!", tone: "good" as const };
  return { emoji: "😮‍💨", title: "The imposters slipped away…", tone: "bad" as const };
}

export function Reveal() {
  const router = useRouter();
  const result = useSoloStore((s) => s.result);
  const players = useSoloStore((s) => s.players);
  const humanId = useSoloStore((s) => s.humanId);
  const round = useSoloStore((s) => s.round);
  const clues = useSoloStore((s) => s.clues);
  const roundNumber = useSoloStore((s) => s.roundNumber);
  const playAgain = useSoloStore((s) => s.playAgain);
  const editSetup = useSoloStore((s) => s.editSetup);

  const [flipped, setFlipped] = useState(false);

  const playersWon = result?.winningSide === "players";
  const wasImposter = round ? round.roles[humanId] === "imposter" : false;
  const humanEntry = result?.imposters.find((i) => i.id === humanId);
  const humanCaught = !!humanEntry?.caught;
  const humanWon = result ? result.winners.includes(humanId) : false;

  useEffect(() => {
    if (!flipped || !result) return;
    if (humanWon) {
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
  const headline = humanHeadline({ wasImposter, caught: humanCaught, won: humanWon });

  // Pre-reveal suspense gate.
  if (!flipped) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
          <div className="text-6xl">🎭</div>
          <h2 className="mt-4 font-display text-3xl font-black">The votes are in</h2>
          <p className="mt-2 text-muted-foreground">Time to find out who was blending in.</p>
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
      {/* Human outcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "overflow-hidden rounded-3xl border p-6 text-center sm:p-8",
          headline.tone === "good"
            ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 to-indigo-950/50"
            : "border-rose-500/40 bg-gradient-to-br from-rose-950/60 to-purple-950/50",
        )}
      >
        <div className="text-5xl sm:text-6xl">{headline.emoji}</div>
        <h2
          className={cn(
            "mt-2 font-display text-3xl font-black sm:text-4xl",
            headline.tone === "good" ? "text-cyan-300" : "text-rose-300",
          )}
        >
          {headline.title}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {playersWon ? "The players caught every imposter." : "At least one imposter escaped the vote."}
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
            <Badge variant="outline" className="mt-2">{result.category}</Badge>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30">
          <CardContent className="p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              The imposter hint
            </div>
            <div className="mt-2 font-display text-3xl font-black text-rose-300">{result.imposterHint}</div>
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
          {result.imposters.map((imp, i) => {
            const isHuman = imp.id === humanId;
            return (
              <motion.div
                key={imp.id}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ delay: i * 0.2, type: "spring", stiffness: 60, damping: 12 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <Card className={cn("w-40 border-2 p-4 text-center", imp.caught ? "border-emerald-500/50" : "border-rose-500/60")}>
                  <div className="flex flex-col items-center gap-2">
                    <AvatarDisplay avatar={imp.avatar} size="lg" />
                    <div className="flex items-center gap-1 font-display font-bold">
                      {imp.name}
                      {isHuman ? (
                        <Badge variant="secondary" className="px-1.5 py-0">You</Badge>
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
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
            );
          })}
        </div>
      </div>

      {/* Vote breakdown */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-4 w-4" /> Vote breakdown
          </h3>
          <div className="space-y-2">
            {result.voteBreakdown.map((b) => {
              const wasImp = result.imposters.some((imp) => imp.id === b.targetId);
              return (
                <div
                  key={b.targetId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                >
                  <span className="flex items-center gap-2 truncate text-sm font-medium">
                    {nameOf(b.targetId)}
                    {wasImp && <Badge variant="destructive" className="px-1.5 py-0">Imposter 😈</Badge>}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {b.votes} vote{b.votes === 1 ? "" : "s"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Winners */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Winners · {playersWon ? "the players" : "the imposters"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.winners.map((id) => {
              const p = players.find((pl) => pl.id === id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 py-1 pl-1 pr-3">
                  <AvatarDisplay avatar={p.avatar} size="xs" />
                  <span className="text-sm font-medium">{p.id === humanId ? "You" : p.name}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Clue recap — the words each player gave */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            The clues
          </h3>
          <div className="space-y-2">
            {players.map((p) => {
              const said = clues.filter((c) => c.playerId === p.id);
              const wasImp = result.imposters.some((imp) => imp.id === p.id);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <AvatarDisplay avatar={p.avatar} size="xs" />
                  <span className="w-24 shrink-0 truncate text-sm font-semibold">
                    {p.id === humanId ? "You" : p.name}
                  </span>
                  {wasImp && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">imposter</Badge>}
                  <div className="flex flex-1 flex-wrap gap-1">
                    {said.map((c, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          wasImp ? "bg-rose-500/15 text-rose-200" : "bg-white/10",
                        )}
                      >
                        {c.word}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Table chat stays open after the reveal */}
      <ChatPanel />

      {/* Updated stats */}
      <StatsPanel refreshKey={roundNumber} />

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
            <RotateCw className="h-5 w-5" /> Play again
          </Button>
          <Button variant="outline" size="lg" onClick={editSetup}>
            <Settings2 className="h-5 w-5" /> Change setup
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/")}>
            <Home className="h-5 w-5" /> Home
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
