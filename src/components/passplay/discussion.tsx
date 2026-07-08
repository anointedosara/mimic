"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Vote, EyeOff } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimerRing } from "@/components/game/timer-ring";
import { useCountdown } from "@/hooks/use-countdown";
import { usePassPlayStore } from "@/store/passplay-store";
import { playSound } from "@/lib/sounds";

export function Discussion() {
  const players = usePassPlayStore((s) => s.players);
  const roundNumber = usePassPlayStore((s) => s.roundNumber);
  const endsAt = usePassPlayStore((s) => s.discussionEndsAt);
  const total = usePassPlayStore((s) => s.settings.durationSeconds);
  const startVoting = usePassPlayStore((s) => s.startVoting);

  const remaining = useCountdown(endsAt);
  const fired = useRef(false);

  // Auto-advance to voting when the timer runs out.
  useEffect(() => {
    if (endsAt && remaining === 0 && !fired.current) {
      fired.current = true;
      playSound("start");
      startVoting();
    }
  }, [remaining, endsAt, startVoting]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-bold">Discussion in progress</div>
              <p className="text-sm text-muted-foreground">
                Round {roundNumber} · Talk it out, watch for bluffs.
              </p>
            </div>
          </div>
          <TimerRing endsAt={endsAt} total={total} size={120} />
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          At the table ({players.length})
        </h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {players.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="glass flex flex-col items-center gap-2 rounded-2xl p-3 text-center"
            >
              <AvatarDisplay avatar={p.avatar} size="md" />
              <span className="max-w-full truncate text-sm font-semibold">{p.name}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] px-4 py-2 text-xs text-muted-foreground">
        <EyeOff className="h-4 w-4" /> No words, hints or roles are shown here — talk it out loud.
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          onClick={() => {
            playSound("start");
            startVoting();
          }}
        >
          <Vote className="h-5 w-5" /> Vote early
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Ready to accuse? Skip straight to the vote.
        </p>
      </motion.div>
    </div>
  );
}
