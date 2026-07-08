"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { PrivateRole } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function RoleCard({ role, compact = false }: { role: PrivateRole; compact?: boolean }) {
  const isImposter = role.role === "imposter";
  const [hidden, setHidden] = useState(false);

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 90, damping: 14 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 text-center shadow-2xl",
        compact ? "" : "sm:p-10",
        isImposter
          ? "border-rose-500/40 bg-gradient-to-br from-rose-950/60 via-fuchsia-950/40 to-purple-950/60 shadow-rose-500/20"
          : "border-cyan-500/40 bg-gradient-to-br from-cyan-950/50 via-indigo-950/40 to-violet-950/50 shadow-cyan-500/20",
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 animated-gradient" />

      <div className="text-5xl sm:text-6xl">{isImposter ? "😈" : "🕵️"}</div>
      <h2 className={cn("mt-3 font-display text-2xl font-black sm:text-3xl", isImposter ? "text-rose-300" : "text-cyan-300")}>
        {isImposter ? "You are an Imposter" : "You are a Player"}
      </h2>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
        Category · {role.category}
      </p>

      <div className="relative mt-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {isImposter ? "Your hint" : "Secret word"}
        </div>
        <div
          className={cn(
            "mt-1 select-none font-display text-4xl font-black transition-all sm:text-5xl",
            hidden && "blur-md",
            isImposter ? "text-rose-200" : "text-white",
          )}
        >
          {isImposter ? role.hint : role.word}
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-xs text-sm text-muted-foreground">
        {isImposter
          ? "Blend in. You don't know the real word — bluff your way through and don't get caught."
          : "Prove you know the word without saying it outright. Find the imposters."}
      </p>

      <Button
        variant="ghost"
        size="sm"
        className="mt-4"
        onClick={() => setHidden((h) => !h)}
        aria-label={hidden ? "Show" : "Hide for privacy"}
      >
        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {hidden ? "Reveal" : "Hide"}
      </Button>
    </motion.div>
  );
}
