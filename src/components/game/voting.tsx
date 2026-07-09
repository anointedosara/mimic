"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Vote, Loader2, ArrowRight, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { RoomSnapshot } from "@/lib/game/types";
import { PlayerTile } from "./player-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvatar } from "@/lib/avatars";
import { roomActions } from "@/hooks/use-room";
import { playSound } from "@/lib/sounds";

export function Voting({ snapshot, selfId }: { snapshot: RoomSnapshot; selfId: string }) {
  const isHost = snapshot.hostId === selfId;
  const self = snapshot.players.find((p) => p.userId === selfId);
  const hasVoted = !!self?.hasVoted;
  const quota = Math.max(1, snapshot.voteQuota);

  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const votables = snapshot.players.filter((p) => p.connected && p.userId !== selfId);
  const allVoted = snapshot.votesCast >= snapshot.votesTotal && snapshot.votesTotal > 0;

  const myVotes = useMemo(() => {
    const ids = snapshot.votes.filter((v) => v.voterId === selfId).map((v) => v.targetId);
    return ids
      .map((id) => snapshot.players.find((p) => p.userId === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [snapshot.votes, snapshot.players, selfId]);

  function toggle(userId: string) {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= quota) {
        // Replace the oldest pick when at capacity (keeps selection fluid).
        return quota === 1 ? [userId] : [...prev.slice(1), userId];
      }
      return [...prev, userId];
    });
  }

  async function submitBallot() {
    if (selected.length !== quota) return;
    setConfirming(true);
    const res = await roomActions.castVote(snapshot.code, selected);
    setConfirming(false);
    setReviewOpen(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not cast vote");
    } else {
      playSound("vote");
    }
  }

  async function reveal() {
    setRevealing(true);
    const res = await roomActions.reveal(snapshot.code);
    setRevealing(false);
    if (!res.ok) toast.error(res.error ?? "Could not reveal");
  }

  const selectedNames = selected
    .map((id) => snapshot.players.find((p) => p.userId === id)?.displayName ?? "?")
    .join(", ");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
      {/* Voting grid */}
      <div className="space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-lg font-bold">
                <Vote className="h-5 w-5 text-primary" />
                {quota > 1 ? `Vote out ${quota} imposters` : "Cast your vote"}
              </div>
              <span className="text-sm font-semibold">
                {snapshot.votesCast} of {snapshot.votesTotal} voted
              </span>
            </div>
            <Progress className="mt-3" value={snapshot.votesTotal ? (snapshot.votesCast / snapshot.votesTotal) * 100 : 0} />
            {hasVoted && myVotes.length > 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> You voted for{" "}
                <span className="font-bold">{myVotes.map((p) => p.displayName).join(", ")}</span>. Votes
                are final.
              </p>
            )}
          </CardContent>
        </Card>

        {hasVoted ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {snapshot.players.map((p) => (
              <PlayerTile key={p.userId} player={p} isSelf={p.userId === selfId} showVoted />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {quota > 1
                ? `Tap the ${quota} players you suspect are imposters (${selected.length}/${quota} picked).`
                : "Tap a player you suspect is an imposter."}
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {votables.map((p) => (
                <PlayerTile
                  key={p.userId}
                  player={p}
                  selectable
                  selected={selected.includes(p.userId)}
                  onClick={() => toggle(p.userId)}
                />
              ))}
            </div>
            <Button
              variant="gradient"
              size="lg"
              className="w-full glow"
              disabled={selected.length !== quota}
              onClick={() => setReviewOpen(true)}
            >
              <Vote className="h-5 w-5" />
              {selected.length === quota
                ? `Submit ${quota > 1 ? `${quota} votes` : "vote"}`
                : `Pick ${quota - selected.length} more`}
            </Button>
          </>
        )}
      </div>

      {/* Live vote feed */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Live votes
            </h3>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {snapshot.votes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No votes yet…</p>
                )}
                {snapshot.votes.map((v) => (
                  <motion.div
                    key={`${v.voterId}-${v.targetId}`}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="text-lg">{getAvatar(voterAvatar(snapshot, v.voterId)).emoji}</span>
                    <span className="font-semibold">{v.voterName}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-primary">{v.targetName}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {isHost && (
          <div className="lg:sticky lg:top-24">
            <Button
              variant="gradient"
              size="lg"
              className="w-full glow"
              disabled={!allVoted || revealing}
              onClick={reveal}
            >
              {revealing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
              {allVoted ? "Reveal imposters" : "Waiting for all votes…"}
            </Button>
            {!allVoted && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Reveal unlocks once everyone has voted.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirm ballot modal */}
      <Dialog open={reviewOpen} onOpenChange={(o) => !o && setReviewOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle>Confirm your {quota > 1 ? "votes" : "vote"}</DialogTitle>
            <DialogDescription>This cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-center gap-2 py-2">
            {selected.map((id) => {
              const p = snapshot.players.find((x) => x.userId === id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-3">
                  <span className="text-lg">{getAvatar(p.avatar).emoji}</span>
                  <span className="text-sm font-semibold">{p.displayName}</span>
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Vote out <span className="font-bold text-primary">{selectedNames}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={confirming}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={submitBallot} disabled={confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function voterAvatar(snapshot: RoomSnapshot, userId: string): string {
  return snapshot.players.find((p) => p.userId === userId)?.avatar ?? "fox";
}
