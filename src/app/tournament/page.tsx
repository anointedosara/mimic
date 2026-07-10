"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteHeader } from "@/components/site-header";
import { Setup } from "@/components/tournament/setup";
import { RoleReveal } from "@/components/tournament/role";
import { Discussion } from "@/components/tournament/discussion";
import { Voting } from "@/components/tournament/voting";
import { Elimination } from "@/components/tournament/elimination";
import { GameOver } from "@/components/tournament/gameover";
import { useTournamentStore } from "@/store/tournament-store";

export default function TournamentPage() {
  const phase = useTournamentStore((s) => s.phase);
  const settings = useTournamentStore((s) => s.settings);
  const startTournament = useTournamentStore((s) => s.startTournament);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const reset = useTournamentStore((s) => s.reset);

  // Start each visit from a clean setup so a stale in-memory game never leaks.
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
            key={`${phase}-${roundNumber}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {phase === "setup" && <Setup onStart={startTournament} initialSettings={settings} />}
            {phase === "role" && <RoleReveal />}
            {phase === "discussion" && <Discussion />}
            {phase === "voting" && <Voting />}
            {phase === "elimination" && <Elimination />}
            {phase === "gameover" && <GameOver />}
          </motion.div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
