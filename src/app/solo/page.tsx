"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteHeader } from "@/components/site-header";
import { Setup } from "@/components/solo/setup";
import { RoleReveal } from "@/components/solo/role-reveal";
import { Discussion } from "@/components/solo/discussion";
import { Voting } from "@/components/solo/voting";
import { Reveal } from "@/components/solo/reveal";
import { useSoloStore } from "@/store/solo-store";

export default function SoloPage() {
  const phase = useSoloStore((s) => s.phase);
  const settings = useSoloStore((s) => s.settings);
  const startGame = useSoloStore((s) => s.startGame);
  const reset = useSoloStore((s) => s.reset);

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
            key={phase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {phase === "setup" && <Setup onStart={startGame} initialSettings={settings} />}
            {phase === "role" && <RoleReveal />}
            {phase === "discussion" && <Discussion />}
            {phase === "voting" && <Voting />}
            {phase === "result" && <Reveal />}
          </motion.div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
