"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Vote, Check, Gavel } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
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
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { usePassPlayStore } from "@/store/passplay-store";
import type { PassPlayer } from "@/lib/passplay/types";

export function Voting() {
  const players = usePassPlayStore((s) => s.players);
  const round = usePassPlayStore((s) => s.round);
  const accusedIds = usePassPlayStore((s) => s.accusedIds);
  const accuse = usePassPlayStore((s) => s.accuse);

  const [target, setTarget] = useState<PassPlayer | null>(null);

  const target_ = round?.imposterIds.length ?? 1;
  const voteNo = accusedIds.length + 1;
  const accusedSet = new Set(accusedIds);
  const multi = target_ > 1;

  function confirmVote() {
    if (!target) return;
    playSound("vote");
    accuse(target.id);
    setTarget(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Gavel className="h-5 w-5 text-primary" /> Who is the imposter?
            </div>
            {multi && (
              <span className="text-sm font-semibold">
                Vote {voteNo} of {target_}
              </span>
            )}
          </div>
          <Progress className="mt-3" value={(accusedIds.length / target_) * 100} />
          <p className="mt-3 text-sm text-muted-foreground">
            {multi
              ? `As a group, vote out ${target_} suspects — one at a time. Votes are final.`
              : "As a group, decide who to vote out. The vote is final."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {players.map((p) => {
          const done = accusedSet.has(p.id);
          return (
            <motion.button
              key={p.id}
              type="button"
              layout
              whileTap={{ scale: done ? 1 : 0.95 }}
              disabled={done}
              onClick={() => !done && setTarget(p)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all glass",
                done
                  ? "opacity-60"
                  : "cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20",
              )}
            >
              <div className="relative">
                <AvatarDisplay avatar={p.avatar} size="md" dimmed={done} />
                {done && (
                  <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow-lg">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
              <span className="max-w-full truncate text-sm font-semibold">{p.name}</span>
              {done && (
                <span className="text-[10px] uppercase tracking-wider text-rose-400">Voted out</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Confirm vote modal */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center">
            <DialogTitle>Confirm your vote</DialogTitle>
            <DialogDescription>This cannot be changed afterwards.</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="flex flex-col items-center gap-3 py-2">
              <AvatarDisplay avatar={target.avatar} size="lg" />
              <p className="text-center">
                Are you sure you want to vote for{" "}
                <span className="font-bold text-primary">{target.name}</span>?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={confirmVote}>
              <Vote className="h-4 w-4" /> Confirm vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
