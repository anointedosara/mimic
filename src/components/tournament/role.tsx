"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Play, Users, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { useShallow } from "zustand/react/shallow";
import { useTournamentStore, selectActivePlayers, selectHumanActive } from "@/store/tournament-store";

/**
 * Cinematic round intro + private secret reveal. Shows "Round N · X remaining",
 * then the human's own word (or the imposter hint). Spectators just get a
 * "watch the round" prompt.
 */
export function RoleReveal() {
  const round = useTournamentStore((s) => s.round);
  const humanId = useTournamentStore((s) => s.humanId);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const settings = useTournamentStore((s) => s.settings);
  const active = useTournamentStore(useShallow(selectActivePlayers));
  const humanActive = useTournamentStore(selectHumanActive);
  const beginDiscussion = useTournamentStore((s) => s.beginDiscussion);

  const [peeked, setPeeked] = useState(false);
  const isImposter = round ? round.roles[humanId] === "imposter" : false;

  if (!round) return null;

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full text-center"
      >
        {/* Round banner */}
        <motion.div
          initial={{ letterSpacing: "0.5em", opacity: 0 }}
          animate={{ letterSpacing: "0.25em", opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-xs font-bold uppercase text-mimic-amber"
        >
          ━━━ Round {roundNumber} ━━━
        </motion.div>
        <div className="mt-2 flex items-center justify-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            {active.length} player{active.length === 1 ? "" : "s"} remaining
          </span>
        </div>

        <Badge variant="outline" className="mt-4 gap-1">
          <Sparkles className="h-3 w-3" /> {round.category}
        </Badge>

        {humanActive ? (
          <>
            {/* Secret card — tap to peek */}
            <motion.button
              type="button"
              onClick={() => {
                setPeeked(true);
                playSound("reveal");
              }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "mt-6 grid w-full place-items-center rounded-3xl border-2 p-8 transition-all",
                isImposter ? "border-rose-500/50 bg-rose-950/30" : "border-cyan-500/50 bg-cyan-950/30",
              )}
            >
              {peeked ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {isImposter ? (
                      <>
                        <ShieldAlert className="h-4 w-4 text-rose-400" /> You are the imposter
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 text-cyan-400" /> Your secret word
                      </>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-2 font-display text-4xl font-black",
                      isImposter ? "text-rose-300" : "text-cyan-200",
                    )}
                  >
                    {isImposter ? round.imposterHint : round.word}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {isImposter
                      ? "You only get a hint. Blend in — don't get voted out."
                      : "Everyone else has this word too — except the imposters. Give clues, catch them."}
                  </p>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <EyeOff className="h-8 w-8" />
                  <span className="text-sm font-semibold">Tap to reveal your secret</span>
                </div>
              )}
            </motion.button>

            <Button
              variant="gradient"
              size="lg"
              className="mt-6 w-full glow"
              disabled={!peeked}
              onClick={() => {
                playSound("start");
                beginDiscussion();
              }}
            >
              <Play className="h-5 w-5" /> {peeked ? "Begin discussion" : "Peek first"}
            </Button>
          </>
        ) : (
          <>
            {/* Spectator */}
            <div className="mt-6 rounded-3xl border-2 border-white/10 bg-white/[0.03] p-8">
              <div className="text-5xl">👁️</div>
              <h2 className="mt-3 font-display text-2xl font-black">You&apos;re spectating</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You were voted out — but the drama continues. Watch the remaining players fight it out,
                and cheer (or heckle) in spectator chat.
              </p>
            </div>
            <Button
              variant="gradient"
              size="lg"
              className="mt-6 w-full glow"
              onClick={() => {
                playSound("start");
                beginDiscussion();
              }}
            >
              <Eye className="h-5 w-5" /> Watch round {roundNumber}
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
