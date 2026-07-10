"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Skull, ShieldCheck, ArrowRight, Trophy, X } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { burstConfetti, evilConfetti } from "@/lib/confetti";
import { useTournamentStore } from "@/store/tournament-store";
import { Progression } from "./progression";

/** Stages of the cinematic: build suspense → reveal → aftermath/countdown. */
type Stage = "suspense" | "revealed" | "aftermath";

export function Elimination() {
  const last = useTournamentStore((s) => s.lastElimination);
  const history = useTournamentStore((s) => s.history);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const humanId = useTournamentStore((s) => s.humanId);
  const nextRound = useTournamentStore((s) => s.nextRound);
  const finishTournament = useTournamentStore((s) => s.finishTournament);

  const [stage, setStage] = useState<Stage>("suspense");
  const [countdown, setCountdown] = useState<number | null>(null);
  const firedFx = useRef(false);

  const isContinue = last?.status === "continue";
  const wasImposter = !!last?.eliminatedWasImposter;
  const isHuman = last?.eliminatedId === humanId;

  // Drive the suspense → reveal → aftermath sequence.
  useEffect(() => {
    if (!last) return;
    const t1 = setTimeout(() => {
      setStage("revealed");
      playSound(wasImposter ? "reveal" : "lose");
    }, 1800);
    const t2 = setTimeout(() => setStage("aftermath"), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [last, wasImposter]);

  // Particle burst on reveal (once).
  useEffect(() => {
    if (stage !== "revealed" || firedFx.current) return;
    firedFx.current = true;
    if (wasImposter) burstConfetti();
    else evilConfetti();
  }, [stage, wasImposter]);

  // Countdown → auto-advance to the next round (continue only).
  useEffect(() => {
    if (stage !== "aftermath" || !isContinue) return;
    setCountdown(3);
    playSound("tick");
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearInterval(iv);
          return 0;
        }
        playSound("tick");
        return c - 1;
      });
    }, 1000);
    const done = setTimeout(() => {
      playSound("start");
      nextRound();
    }, 3200);
    return () => {
      clearInterval(iv);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isContinue]);

  if (!last) return null;

  return (
    <div className="mx-auto grid min-h-[75vh] max-w-lg place-items-center overflow-hidden">
      <div className="w-full">
        <AnimatePresence mode="wait">
          {/* --- Suspense: the votes are being counted ------------------- */}
          {stage === "suspense" && (
            <motion.div
              key="suspense"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-6xl"
              >
                ⚖️
              </motion.div>
              <h2 className="mt-4 font-display text-2xl font-black">Counting the votes…</h2>
              <p className="mt-1 text-sm text-muted-foreground">One player is about to go home.</p>
              <div className="mx-auto mt-6 max-w-xs space-y-2">
                {last.voteBreakdown.slice(0, 4).map((b, i) => {
                  const max = last.voteBreakdown[0]?.votes || 1;
                  return (
                    <motion.div
                      key={b.targetId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.15 }}
                      className="flex items-center gap-2"
                    >
                      <span className="w-20 shrink-0 truncate text-right text-xs font-medium">
                        {b.targetName}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.votes / max) * 100}%` }}
                          transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
                          className="h-full rounded-full bg-gradient-to-r from-mimic-fuchsia to-mimic-violet"
                        />
                      </div>
                      <span className="w-5 shrink-0 text-xs font-bold tabular-nums">{b.votes}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* --- Reveal + aftermath ------------------------------------- */}
          {(stage === "revealed" || stage === "aftermath") && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              {/* ❌ Name Eliminated */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-rose-400"
              >
                <X className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" strokeWidth={3} />
                <span className="break-words font-display text-xl font-black leading-tight sm:text-3xl">
                  {isHuman ? "You were" : last.eliminatedName} eliminated
                </span>
              </motion.div>

              {/* Avatar sliding off the board */}
              <div className="relative mt-6 grid h-32 place-items-center">
                <motion.div
                  initial={{ y: 0, opacity: 1, rotate: 0 }}
                  animate={
                    stage === "aftermath"
                      ? { x: 260, y: 40, opacity: 0, rotate: 25 }
                      : { y: [0, -6, 0] }
                  }
                  transition={
                    stage === "aftermath"
                      ? { duration: 0.9, ease: "easeIn" }
                      : { duration: 1.4, repeat: Infinity }
                  }
                >
                  <AvatarDisplay avatar={last.eliminatedAvatar} size="xl" dimmed={stage === "aftermath"} />
                </motion.div>
              </div>

              <Badge
                variant={wasImposter ? "destructive" : "outline"}
                className="gap-1 px-3 py-1 text-sm"
              >
                {wasImposter ? (
                  <>
                    <Skull className="h-4 w-4" /> They were an imposter!
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> They were innocent
                  </>
                )}
              </Badge>

              {/* Remaining + next */}
              <AnimatePresence>
                {stage === "aftermath" && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    <div className="font-display text-4xl font-black tabular-nums">{last.remaining}</div>
                    <div className="text-sm uppercase tracking-widest text-muted-foreground">
                      players remaining
                    </div>

                    {isContinue ? (
                      <div className="mt-6">
                        <p className="text-sm text-muted-foreground">Prepare for Round {roundNumber + 1}…</p>
                        <motion.div
                          key={countdown ?? "go"}
                          initial={{ scale: 1.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={cn(
                            "mx-auto mt-2 font-display text-6xl font-black",
                            countdown === 0 ? "text-emerald-400" : "text-mimic-cyan",
                          )}
                        >
                          {countdown === 0 ? "GO" : countdown ?? ""}
                        </motion.div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-4 text-muted-foreground"
                          onClick={() => {
                            playSound("start");
                            nextRound();
                          }}
                        >
                          Skip <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="gradient"
                        size="lg"
                        className="mt-6 w-full glow"
                        onClick={() => {
                          playSound("reveal");
                          finishTournament();
                        }}
                      >
                        <Trophy className="h-5 w-5" /> See final results
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progression so far */}
        {history.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tournament so far
            </h3>
            <Progression history={history} />
          </div>
        )}
      </div>
    </div>
  );
}
