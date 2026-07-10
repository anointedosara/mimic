"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Vote, Check, Gavel, Loader2, Bot, Eye } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { useTournamentStore, selectActivePlayers, selectHumanActive } from "@/store/tournament-store";
import { ChatPanel } from "./conversation";

export function Voting() {
  const players = useTournamentStore((s) => s.players);
  const humanId = useTournamentStore((s) => s.humanId);
  const humanVote = useTournamentStore((s) => s.humanVote);
  const aiBallots = useTournamentStore((s) => s.aiBallots);
  const revealedBallots = useTournamentStore((s) => s.revealedBallots);
  const clues = useTournamentStore((s) => s.clues);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const submitHumanVote = useTournamentStore((s) => s.submitHumanVote);
  const active = useTournamentStore(useShallow(selectActivePlayers));
  const humanActive = useTournamentStore(selectHumanActive);

  const [selected, setSelected] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const cluesByPlayer = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of clues) m.set(c.playerId, [...(m.get(c.playerId) ?? []), c.word]);
    return m;
  }, [clues]);

  const hasVoted = humanVote !== null;
  const totalVoters = active.length;
  const votesIn = revealedBallots + (hasVoted ? 1 : 0);

  const feed = useMemo(() => {
    const list = aiBallots.slice(0, revealedBallots).map((b) => ({ voterId: b.voterId, targetId: b.targetId }));
    if (humanVote) list.push({ voterId: humanId, targetId: humanVote });
    return list.reverse();
  }, [aiBallots, revealedBallots, humanVote, humanId]);

  function confirmVote() {
    if (selected) submitHumanVote(selected);
    setReviewOpen(false);
    setSelected(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Gavel className="h-5 w-5 text-primary" /> Round {roundNumber} · Vote to eliminate
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {votesIn}/{totalVoters} voted
            </span>
          </div>
          <Progress className="mt-3" value={(votesIn / Math.max(1, totalVoters)) * 100} />
          <p className="mt-3 text-sm text-muted-foreground">
            {!humanActive
              ? "You're spectating. The remaining players are casting their votes…"
              : hasVoted
                ? "Your vote is locked. The table is finishing up…"
                : "The most-voted player is eliminated. Choose who looks like a mimic."}
          </p>
        </CardContent>
      </Card>

      {humanActive && !hasVoted && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {active
              .filter((p) => p.id !== humanId)
              .map((p) => {
                const said = cluesByPlayer.get(p.id) ?? [];
                const isSel = selected === p.id;
                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                      isSel
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-white/5 glass hover:-translate-y-0.5 hover:border-primary/50",
                    )}
                  >
                    <div className="relative">
                      <AvatarDisplay avatar={p.avatar} size="sm" />
                      {isSel && (
                        <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-white shadow">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{p.name}</span>
                        {p.isAI && (
                          <Badge variant="outline" className="gap-0.5 px-1.5 py-0 text-[10px]">
                            <Bot className="h-2.5 w-2.5" /> AI
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {said.length ? (
                          said.map((w, i) => (
                            <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">
                              {w}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground/60">no clue given</span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
          </div>

          <Button
            variant="gradient"
            size="lg"
            className="w-full glow"
            disabled={!selected}
            onClick={() => setReviewOpen(true)}
          >
            <Vote className="h-5 w-5" /> {selected ? "Submit vote" : "Pick a suspect"}
          </Button>
        </>
      )}

      {humanActive && hasVoted && (
        <div className="flex items-center justify-center gap-2 rounded-2xl glass p-4 text-center text-sm">
          <Check className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>
            You voted for <span className="font-bold text-primary">{byId.get(humanVote)?.name ?? "?"}</span>
          </span>
          {votesIn < totalVoters && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {!humanActive && (
        <div className="flex items-center justify-center gap-2 rounded-2xl glass p-4 text-center text-sm text-muted-foreground">
          <Eye className="h-5 w-5 shrink-0" /> Spectating the vote
          {votesIn < totalVoters && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {/* Live vote feed */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Votes coming in
        </h3>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {feed.length === 0 && (
              <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-sm text-muted-foreground">
                Waiting for the first vote…
              </p>
            )}
            {feed.map((b) => {
              const voter = byId.get(b.voterId);
              const isHuman = b.voterId === humanId;
              return (
                <motion.div
                  key={b.voterId}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                >
                  {voter && <AvatarDisplay avatar={voter.avatar} size="xs" />}
                  <span className="font-semibold">{isHuman ? "You" : voter?.name}</span>
                  <span className="text-muted-foreground">voted for</span>
                  <span className="font-semibold text-primary">{byId.get(b.targetId)?.name ?? "?"}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <ChatPanel />

      <Dialog open={reviewOpen} onOpenChange={(o) => !o && setReviewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle>Confirm your vote</DialogTitle>
            <DialogDescription>This cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            {selected && byId.get(selected) && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-3">
                <AvatarDisplay avatar={byId.get(selected)!.avatar} size="xs" />
                <span className="text-sm font-semibold">{byId.get(selected)!.name}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={confirmVote}>
              <Vote className="h-4 w-4" /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
