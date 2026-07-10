"use client";

import { motion } from "framer-motion";
import { Skull, ShieldCheck } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { cn } from "@/lib/utils";
import type { RoundHistory } from "@/lib/tournament/types";

/**
 * The cinematic progression timeline — one row per elimination round, showing
 * who left and how many remained. Used on the elimination and game-over screens.
 */
export function Progression({ history, className }: { history: RoundHistory[]; className?: string }) {
  if (history.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {history.map((h, i) => (
        <motion.div
          key={h.round}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 font-display text-sm font-black text-muted-foreground">
            {h.round}
          </div>
          <AvatarDisplay avatar={h.eliminatedAvatar} size="xs" dimmed ring={false} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="truncate font-semibold line-through decoration-rose-400/60">
                {h.eliminatedName}
              </span>
              {h.wasImposter ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-rose-300">
                  <Skull className="h-3 w-3" /> imposter
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> innocent
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {h.remaining} left
          </span>
        </motion.div>
      ))}
    </div>
  );
}
