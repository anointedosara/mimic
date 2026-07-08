"use client";

import { motion } from "framer-motion";
import type { PrivateRole } from "@/lib/game/types";
import { RoleCard } from "./role-card";
import { Loader2 } from "lucide-react";

export function RoleReveal({ role }: { role: PrivateRole | null }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md space-y-6">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center font-display text-lg font-bold uppercase tracking-widest text-muted-foreground"
        >
          Your secret role
        </motion.p>

        {role ? (
          <RoleCard role={role} />
        ) : (
          <div className="glass grid h-72 place-items-center rounded-3xl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Discussion begins in a moment…
        </motion.div>
      </div>
    </div>
  );
}
