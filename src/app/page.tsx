"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Play, PlusCircle, LogIn, HelpCircle, Shield, Zap, Users, Eye, Smartphone, Wifi, Bot } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HowToPlay } from "@/components/how-to-play";
import { AVATARS } from "@/lib/avatars";
import { playSound } from "@/lib/sounds";

const FEATURES = [
  { icon: Eye, title: "Hidden imposters", text: "Imposters never see the real word — or even each other. Pure deduction." },
  { icon: Zap, title: "Real-time play", text: "Instant sync across every device. Votes and reveals happen live." },
  { icon: Shield, title: "Server-authoritative", text: "Roles live only on the server. No peeking at network traffic." },
  { icon: Users, title: "3–20 players", text: "Scale from a tight trio to a chaotic crowd, with up to 6 imposters." },
];

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();

  const go = (path: string) => {
    playSound("click");
    if (status === "authenticated") router.push(path);
    else router.push(`/login?callbackUrl=${encodeURIComponent(path)}`);
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {/* Hero */}
      <section className="container relative flex flex-col items-center pt-16 text-center sm:pt-24">
        <div className="pointer-events-none absolute inset-0 -z-10 flex justify-center">
          <div className="h-72 w-72 rounded-full bg-primary/25 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Logo size="lg" showTagline />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 max-w-xl text-balance text-muted-foreground sm:text-lg"
        >
          Everyone gets the secret word — except the imposters, who only get a hint. Discuss, deduce,
          and vote out the mimics before they blend in and win.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
        >
          <Button variant="gradient" size="lg" className="w-full sm:w-auto" onClick={() => go("/create-room")}>
            <Play className="h-5 w-5" /> Play now
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => go("/create-room")}>
            <PlusCircle className="h-5 w-5" /> Create room
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => go("/join")}>
            <LogIn className="h-5 w-5" /> Join room
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              playSound("click");
              router.push("/pass-and-play");
            }}
          >
            <Smartphone className="h-5 w-5" /> Pass &amp; Play
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              playSound("click");
              router.push("/solo");
            }}
          >
            <Bot className="h-5 w-5" /> Solo vs AI
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4"
        >
          <HowToPlay>
            <Button variant="ghost" size="sm">
              <HelpCircle className="h-4 w-4" /> How to play
            </Button>
          </HowToPlay>
        </motion.div>

        {/* Floating avatar row */}
        <div className="mt-14 flex flex-wrap justify-center gap-3">
          {AVATARS.slice(0, 12).map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.05 }}
              className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-2xl shadow-lg ${a.gradient} animate-float`}
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              {a.emoji}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Game modes */}
      <section className="container mt-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-black sm:text-4xl">Three ways to play</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Online with friends, passed around one phone, or solo against AI.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass card-hover flex flex-col rounded-2xl p-6"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-mimic-cyan/15 text-mimic-cyan">
              <Wifi className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold">Online</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Private room links and codes, real-time multiplayer across every device, with logins
              and saved stats.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="gradient" className="flex-1" onClick={() => go("/create-room")}>
                <PlusCircle className="h-4 w-4" /> Create room
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => go("/join")}>
                <LogIn className="h-4 w-4" /> Join
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="glass card-hover flex flex-col rounded-2xl p-6"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-mimic-fuchsia/15 text-mimic-fuchsia">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold">Pass &amp; Play</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Completely offline on one phone — no internet, no accounts. Pass the device around the
              circle and blend in.
            </p>
            <div className="mt-4">
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => {
                  playSound("click");
                  router.push("/pass-and-play");
                }}
              >
                <Play className="h-4 w-4" /> Play on this device
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="glass card-hover flex flex-col rounded-2xl p-6"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-mimic-amber/15 text-mimic-amber">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold">Solo vs AI</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              No friends around? Fill the table with AI players — each with their own personality,
              clues and voting style. Pick a difficulty and see if you can blend in.
            </p>
            <div className="mt-4">
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => {
                  playSound("click");
                  router.push("/solo");
                }}
              >
                <Play className="h-4 w-4" /> Play against AI
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="glass card-hover rounded-2xl p-6"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </motion.div>
        ))}
      </section>

      {/* CTA */}
      <section className="container my-24">
        <div className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
          <div className="animated-gradient pointer-events-none absolute inset-0 -z-10 opacity-20" />
          <h2 className="font-display text-3xl font-black sm:text-4xl">Ready to find the imposter?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Gather your friends, pick your poison, and see who can keep a straight face.
          </p>
          <Button variant="gradient" size="lg" className="mt-8" onClick={() => go("/create-room")}>
            <Play className="h-5 w-5" /> Start a game
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-muted-foreground">
        <p>
          MIMIC · Built with Next.js, Socket.IO &amp; MongoDB
          {status === "authenticated" ? (
            <>
              {" · "}
              <Link href="/profile" className="text-primary hover:underline">
                Your profile
              </Link>
            </>
          ) : status === "unauthenticated" ? (
            <>
              {" · "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </>
          ) : null}
        </p>
      </footer>
    </div>
  );
}
