"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Vote, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { PrivateRole, RoomSnapshot } from "@/lib/game/types";
import { RoleCard } from "./role-card";
import { TimerRing } from "./timer-ring";
import { PlayerTile } from "./player-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { roomActions } from "@/hooks/use-room";

export function Discussion({
  snapshot,
  role,
  selfId,
}: {
  snapshot: RoomSnapshot;
  role: PrivateRole | null;
  selfId: string;
}) {
  const [voting, setVoting] = useState(false);

  async function voteEarly() {
    setVoting(true);
    const res = await roomActions.voteEarly(snapshot.code);
    setVoting(false);
    if (!res.ok) toast.error(res.error ?? "Could not start voting");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
      {/* Left: players + status */}
      <div className="order-2 space-y-6 lg:order-1">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">Discussion in progress</div>
                <p className="text-sm text-muted-foreground">
                  Round {snapshot.round} · Drop clues, watch for bluffs.
                </p>
              </div>
            </div>
            <TimerRing endsAt={snapshot.timerEndsAt} total={snapshot.settings.durationSeconds} size={120} />
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Players ({snapshot.players.filter((p) => p.connected).length})
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {snapshot.players.map((p) => (
              <PlayerTile key={p.userId} player={p} isSelf={p.userId === selfId} />
            ))}
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button variant="gradient" size="lg" className="w-full" onClick={voteEarly} disabled={voting}>
            {voting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Vote className="h-5 w-5" />}
            Vote early
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Think you&apos;ve spotted the imposter? Skip straight to voting.
          </p>
        </motion.div>
      </div>

      {/* Right: personal role card */}
      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-24">
          {role ? (
            <RoleCard role={role} compact />
          ) : (
            <div className="glass grid h-64 place-items-center rounded-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
