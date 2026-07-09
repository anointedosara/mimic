"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Vote, Check, Gavel, Loader2, Bot } from "lucide-react";
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
import { useSoloStore } from "@/store/solo-store";
import { ChatPanel } from "./conversation";

export function Voting() {
  const players = useSoloStore((s) => s.players);
  const humanId = useSoloStore((s) => s.humanId);
  const humanVotes = useSoloStore((s) => s.humanVotes);
  const voteQuota = useSoloStore((s) => s.voteQuota);
  const aiBallots = useSoloStore((s) => s.aiBallots);
  const revealedBallots = useSoloStore((s) => s.revealedBallots);
  const clues = useSoloStore((s) => s.clues);
  const submitHumanBallot = useSoloStore((s) => s.submitHumanBallot);

  const [selected, setSelected] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const cluesByPlayer = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of clues) m.set(c.playerId, [...(m.get(c.playerId) ?? []), c.word]);
    return m;
  }, [clues]);

  const hasVoted = humanVotes.length > 0;
  const totalVoters = players.length;
  const votesIn = revealedBallots + (hasVoted ? 1 : 0);

  // Ballots revealed so far (newest first for the feed).
  const feed = useMemo(() => {
    const list = [...aiBallots.slice(0, revealedBallots)];
    if (hasVoted) list.push({ voterId: humanId, targetIds: humanVotes });
    return list.reverse();
  }, [aiBallots, revealedBallots, hasVoted, humanId, humanVotes]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= voteQuota) return voteQuota === 1 ? [id] : [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function confirmBallot() {
    submitHumanBallot(selected);
    setReviewOpen(false);
    setSelected([]);
  }

  const multi = voteQuota > 1;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Gavel className="h-5 w-5 text-primary" />
              {multi ? `Vote out ${voteQuota} imposters` : "Who is the imposter?"}
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {votesIn}/{totalVoters} voted
            </span>
          </div>
          <Progress className="mt-3" value={(votesIn / totalVoters) * 100} />
          <p className="mt-3 text-sm text-muted-foreground">
            {hasVoted
              ? "Your ballot is locked. The table is finishing up…"
              : multi
                ? `Pick ${voteQuota} suspects based on their clues (${selected.length}/${voteQuota}).`
                : "Cast your vote based on the clues. The AI players are deciding in real time."}
          </p>
        </CardContent>
      </Card>

      {/* Candidate list with clues (hidden once the human has voted) */}
      {!hasVoted && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {players
              .filter((p) => p.id !== humanId)
              .map((p) => {
                const said = cluesByPlayer.get(p.id) ?? [];
                const isSel = selected.includes(p.id);
                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                      isSel
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-white/5 glass hover:-translate-y-0.5 hover:border-primary/50",
                    )}
                  >
                    <div className="relative">
                      <AvatarDisplay avatar={p.avatar} size="sm" dimmed={false} />
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
            disabled={selected.length !== voteQuota}
            onClick={() => setReviewOpen(true)}
          >
            <Vote className="h-5 w-5" />
            {selected.length === voteQuota
              ? `Submit ${multi ? `${voteQuota} votes` : "vote"}`
              : `Pick ${voteQuota - selected.length} more`}
          </Button>
        </>
      )}

      {hasVoted && (
        <div className="flex items-center justify-center gap-2 rounded-2xl glass p-4 text-center text-sm">
          <Check className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>
            You voted for{" "}
            <span className="font-bold text-primary">
              {humanVotes.map((id) => byId.get(id)?.name ?? "?").join(", ")}
            </span>
          </span>
          {votesIn < totalVoters && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* Live vote feed — one row per ballot */}
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
                  <span className="font-semibold text-primary">
                    {b.targetIds.map((id) => byId.get(id)?.name ?? "?").join(", ")}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Table chat stays open during voting */}
      <ChatPanel />

      {/* Confirm ballot modal */}
      <Dialog open={reviewOpen} onOpenChange={(o) => !o && setReviewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle>Confirm your {multi ? "votes" : "vote"}</DialogTitle>
            <DialogDescription>This cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-center gap-2 py-2">
            {selected.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-3">
                  <AvatarDisplay avatar={p.avatar} size="xs" />
                  <span className="text-sm font-semibold">{p.name}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={confirmBallot}>
              <Vote className="h-4 w-4" /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
