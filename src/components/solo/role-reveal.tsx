"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Lock, MessageCircle } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { humanPlayer, useSoloStore } from "@/store/solo-store";

export function RoleReveal() {
  const round = useSoloStore((s) => s.round);
  const humanId = useSoloStore((s) => s.humanId);
  const roundNumber = useSoloStore((s) => s.roundNumber);
  const players = useSoloStore((s) => s.players);
  const human = useSoloStore(humanPlayer);
  const beginClues = useSoloStore((s) => s.beginClues);

  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) playSound("reveal");
  }, [revealed]);

  if (!round || !human) return null;

  const isImposter = round.roles[humanId] === "imposter";
  const imposterCount = round.imposterIds.length;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Round {roundNumber} · {players.length} players
      </p>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl">
        {/* Revealed role underneath */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border p-6 text-center",
            isImposter
              ? "border-rose-500/40 bg-gradient-to-br from-rose-950/70 via-fuchsia-950/50 to-purple-950/70"
              : "border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 via-indigo-950/50 to-violet-950/60",
          )}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-25 animated-gradient" />
          {revealed && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.12 } } }}
              className="flex flex-col items-center gap-3"
            >
              <Stagger>
                <AvatarDisplay avatar={human.avatar} size="xl" />
              </Stagger>
              <Stagger>
                <div className="font-display text-xl font-black">{human.name}</div>
              </Stagger>
              <Stagger>
                <div
                  className={cn(
                    "text-2xl font-black sm:text-3xl",
                    isImposter ? "text-rose-300" : "text-cyan-300",
                  )}
                >
                  {isImposter ? <>You ARE the Imposter 😈</> : <>You are NOT an Imposter</>}
                </div>
              </Stagger>
              <Stagger>
                <div className="mt-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {isImposter ? "Your hint" : "Secret word"}
                  </div>
                  <div
                    className={cn(
                      "font-display text-4xl font-black uppercase sm:text-5xl",
                      isImposter ? "text-rose-200" : "text-white",
                    )}
                  >
                    {isImposter ? round.imposterHint : round.word}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    Category · {round.category}
                  </div>
                </div>
              </Stagger>
              <Stagger>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  {isImposter
                    ? `You don't know the real word. Blend in, avoid suspicion, and don't get caught. ${
                        imposterCount > 1 ? "Other imposters exist — but you don't know who." : ""
                      }`
                    : "Prove you know it without saying it outright. Watch for the mimics."}
                </p>
              </Stagger>
            </motion.div>
          )}
        </div>

        {/* Cover */}
        <AnimatePresence>
          {!revealed && (
            <motion.button
              type="button"
              onClick={() => setRevealed(true)}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a1830] to-[#0d0b1a] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="pointer-events-none absolute inset-0 -z-10 opacity-20 animated-gradient" />
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <div className="font-display text-lg font-bold">Your secret role</div>
                <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
                  Only you can see this. The AI players each know only their own role.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2 font-display font-bold text-primary">
                <Eye className="h-5 w-5" /> Tap to reveal
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-5 w-full"
          >
            <Button
              variant="gradient"
              size="lg"
              className="w-full glow"
              onClick={() => {
                playSound("start");
                beginClues();
              }}
            >
              <MessageCircle className="h-5 w-5" /> Start giving clues
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stagger({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
      {children}
    </motion.div>
  );
}
