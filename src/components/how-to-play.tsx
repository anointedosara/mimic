"use client";

import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";

const STEPS = [
  { icon: "🚪", title: "Join a room", text: "Enter a room code or open an invite link to sit at the table." },
  { icon: "⏳", title: "Wait for players", text: "The host starts once everyone has arrived in the lobby." },
  { icon: "🃏", title: "Get your secret", text: "Everyone secretly receives the same word — privately, on their own screen." },
  { icon: "😈", title: "Imposters get a hint", text: "Hidden imposters only see a related hint. They never see the real word — or each other." },
  { icon: "💬", title: "Discuss", text: "Talk it out. Drop clues that prove you know the word — without giving it away." },
  { icon: "🗳️", title: "Vote", text: "When the timer ends (or someone calls it early), vote for who you think is faking." },
  { icon: "🎭", title: "Reveal", text: "Flip the cards! See who the imposters were and whether they were caught." },
  { icon: "🔁", title: "Play again", text: "Same crew, new word, freshly shuffled imposters. Go again!" },
];

export function HowToPlay({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-gradient">How to play MIMIC</DialogTitle>
          <DialogDescription>
            A social deduction word game. Blend in as an imposter — or expose the ones among you.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-4 rounded-xl bg-white/[0.03] p-3"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-2xl">
                {s.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/30 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{s.title}</h3>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-sm">
          <span className="font-semibold text-primary">Example</span> — Real word:{" "}
          <span className="font-bold">Pizza</span> · Imposter hint:{" "}
          <span className="font-bold">Cheese</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
