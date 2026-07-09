"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Vote, Eye, EyeOff, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { playSound } from "@/lib/sounds";
import { useSoloStore } from "@/store/solo-store";
import { ConversationFeed, ChatComposer } from "./conversation";

export function Discussion() {
  const players = useSoloStore((s) => s.players);
  const humanId = useSoloStore((s) => s.humanId);
  const roundNumber = useSoloStore((s) => s.roundNumber);
  const round = useSoloStore((s) => s.round);
  const clues = useSoloStore((s) => s.clues);
  const turnIndex = useSoloStore((s) => s.turnIndex);
  const totalClueRounds = useSoloStore((s) => s.totalClueRounds);
  const awaitingHuman = useSoloStore((s) => s.awaitingHuman);
  const submitHumanClue = useSoloStore((s) => s.submitHumanClue);
  const startVoting = useSoloStore((s) => s.startVoting);

  const [draft, setDraft] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const totalTurns = players.length * totalClueRounds;
  const currentRound = Math.min(totalClueRounds, Math.floor(turnIndex / Math.max(1, players.length)) + 1);
  const currentPlayer = turnIndex < totalTurns ? players[turnIndex % players.length] : null;
  const isImposter = round && round.roles[humanId] === "imposter";

  function submit() {
    const w = draft.trim();
    if (!w) return;
    submitHumanClue(w);
    setDraft("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="rounded-2xl glass p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Lightbulb className="h-5 w-5 text-mimic-amber" /> Clue phase
            </div>
            <p className="text-sm text-muted-foreground">
              Round {roundNumber} · Pass {currentRound}/{totalClueRounds} ·{" "}
              {currentPlayer
                ? currentPlayer.id === humanId
                  ? "your turn"
                  : `${currentPlayer.name} is up`
                : "wrapping up…"}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {clues.length}/{totalTurns}
          </span>
        </div>
        <Progress className="mt-3" value={(clues.length / Math.max(1, totalTurns)) * 100} />

        {round && (
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/10"
          >
            {showSecret ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showSecret ? (
              isImposter ? (
                <>Imposter · hint: <span className="font-bold text-rose-300">{round.imposterHint}</span></>
              ) : (
                <>Your word: <span className="font-bold text-cyan-300">{round.word}</span></>
              )
            ) : (
              <>Tap to peek at your secret</>
            )}
          </button>
        )}
      </div>

      {/* Conversation feed */}
      <ConversationFeed />

      {/* Human clue input — only on the human's turn */}
      <AnimatePresence>
        {awaitingHuman && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-primary/40 bg-primary/5 p-4"
          >
            <div className="mb-2 text-sm font-semibold">
              {isImposter
                ? "Your turn — give a one-word clue that blends in (you only have the hint)."
                : "Your turn — give a one-word clue about your word (don't say it outright)."}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={20}
                autoFocus
                placeholder="one word…"
                aria-label="Your clue"
                className="h-11"
              />
              <Button variant="gradient" className="h-11 shrink-0" onClick={submit} disabled={!draft.trim()}>
                <Send className="h-4 w-4" /> Give clue
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent chat — join the discussion any time */}
      <ChatComposer />

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => {
          playSound("start");
          startVoting();
        }}
      >
        <Vote className="h-5 w-5" /> Skip to voting
      </Button>
    </div>
  );
}
