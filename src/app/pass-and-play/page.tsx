"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Setup } from "@/components/passplay/setup";
import { SecretReveal } from "@/components/passplay/secret-reveal";
import { Discussion } from "@/components/passplay/discussion";
import { Voting } from "@/components/passplay/voting";
import { Result } from "@/components/passplay/result";
import { usePassPlayStore } from "@/store/passplay-store";
import { playSound } from "@/lib/sounds";

export default function PassAndPlayPage() {
  const phase = usePassPlayStore((s) => s.phase);
  const players = usePassPlayStore((s) => s.players);
  const settings = usePassPlayStore((s) => s.settings);
  const startGame = usePassPlayStore((s) => s.startGame);
  const startDiscussion = usePassPlayStore((s) => s.startDiscussion);
  const reset = usePassPlayStore((s) => s.reset);

  // Start each visit from a clean setup so a stale in-memory round never leaks.
  useEffect(() => {
    if (phase !== "setup") reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container py-8 sm:py-10">
        <ErrorBoundary resetKey={phase}>
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {phase === "setup" && (
              <Setup
                onStart={startGame}
                initialPlayers={players.length ? players : undefined}
                initialSettings={players.length ? settings : undefined}
              />
            )}

            {phase === "reveal" && <SecretReveal />}

            {phase === "ready" && (
              <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
                <div>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary/15 text-primary"
                  >
                    <PartyPopper className="h-10 w-10" />
                  </motion.div>
                  <h2 className="mt-5 font-display text-3xl font-black">Everyone has seen their role</h2>
                  <p className="mt-2 text-muted-foreground">
                    Put the phone down in the middle and begin discussing. Find the imposters.
                  </p>
                  <Button
                    variant="gradient"
                    size="lg"
                    className="mt-8 w-full glow"
                    onClick={() => {
                      playSound("start");
                      startDiscussion();
                    }}
                  >
                    Start game
                  </Button>
                </div>
              </div>
            )}

            {phase === "discussion" && <Discussion />}
            {phase === "voting" && <Voting />}
            {phase === "result" && <Result />}
          </motion.div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
