"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronUp, Eye, ArrowRight, Lock } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { currentViewer, usePassPlayStore } from "@/store/passplay-store";

export function SecretReveal() {
  const round = usePassPlayStore((s) => s.round);
  const viewIndex = usePassPlayStore((s) => s.viewIndex);
  const revealed = usePassPlayStore((s) => s.revealed);
  const revealCurrent = usePassPlayStore((s) => s.revealCurrent);
  const nextViewer = usePassPlayStore((s) => s.nextViewer);
  const viewer = usePassPlayStore(currentViewer);

  const total = round?.viewOrder.length ?? 0;
  const isLast = viewIndex >= total - 1;
  const isImposter = viewer && round ? round.roles[viewer.id] === "imposter" : false;

  useEffect(() => {
    if (revealed) playSound("reveal");
  }, [revealed]);

  if (!round || !viewer) return null;

  function reveal() {
    if (!revealed) revealCurrent();
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y < -110 || info.velocity.y < -450) reveal();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      {/* Progress dots */}
      <div className="mb-5 flex items-center gap-1.5">
        {round.viewOrder.map((id, i) => (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i < viewIndex ? "w-1.5 bg-emerald-500" : i === viewIndex ? "w-6 bg-primary" : "w-1.5 bg-white/15",
            )}
          />
        ))}
      </div>

      {/* Header */}
      <div className="mb-5 text-center">
        {!revealed ? (
          <motion.div
            key="pass"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Player {viewIndex + 1} of {total}
            </p>
            <h2 className="mt-1 font-display text-2xl font-black sm:text-3xl">
              It&apos;s {viewer.name}&apos;s turn
            </h2>
            <p className="mt-1 text-muted-foreground">
              Pass the phone to <span className="font-semibold text-foreground">{viewer.name}</span>.
              Nobody else should look.
            </p>
          </motion.div>
        ) : (
          <motion.div key="peek" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {viewer.name}, this is your secret
            </p>
          </motion.div>
        )}
      </div>

      {/* The card — hidden role underneath, cover on top */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl">
        {/* Role content (revealed underneath the cover) */}
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
                <AvatarDisplay avatar={viewer.avatar} size="xl" />
              </Stagger>
              <Stagger>
                <div className="font-display text-xl font-black">{viewer.name}</div>
              </Stagger>
              <Stagger>
                <div
                  className={cn(
                    "text-2xl font-black sm:text-3xl",
                    isImposter ? "text-rose-300" : "text-cyan-300",
                  )}
                >
                  {isImposter ? (
                    <>You ARE the Imposter 😈</>
                  ) : (
                    <>You are NOT an Imposter</>
                  )}
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
                    ? "You don't know the real word. Blend in and don't get caught."
                    : "Prove you know it without saying it outright."}
                </p>
              </Stagger>
            </motion.div>
          )}
        </div>

        {/* Swipe-up cover */}
        <AnimatePresence>
          {!revealed && (
            <motion.div
              key={viewIndex}
              drag="y"
              dragConstraints={{ top: -600, bottom: 0 }}
              dragElastic={0.15}
              dragSnapToOrigin
              onDragEnd={onDragEnd}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  reveal();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Swipe up to reveal ${viewer.name}'s secret role`}
              initial={{ y: "-110%" }}
              animate={{ y: 0 }}
              exit={{ y: "-110%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="absolute inset-0 flex cursor-grab touch-none select-none flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a1830] to-[#0d0b1a] shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            >
              <div className="pointer-events-none absolute inset-0 -z-10 opacity-20 animated-gradient" />
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-3xl">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <div className="font-display text-lg font-bold">Hidden</div>
                <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
                  Your word and role are concealed until you swipe.
                </p>
              </div>

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex flex-col items-center text-primary"
              >
                <ChevronUp className="h-7 w-7" />
                <ChevronUp className="-mt-4 h-7 w-7 opacity-60" />
                <span className="mt-1 font-display text-base font-bold tracking-wide">
                  Swipe up to reveal
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reminder + Next (only once revealed) */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 w-full"
          >
            <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Remember your word and your role.</p>
              <p className="mt-1">Do not show anyone else. When you&apos;re ready, pass the phone.</p>
            </div>
            <Button
              variant="gradient"
              size="lg"
              className="mt-3 w-full glow"
              onClick={() => {
                playSound("click");
                nextViewer();
              }}
            >
              {isLast ? (
                <>
                  <Eye className="h-5 w-5" /> Done — everyone&apos;s seen it
                </>
              ) : (
                <>
                  Next player <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              The card locks again the moment you press this.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stagger({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
    >
      {children}
    </motion.div>
  );
}
