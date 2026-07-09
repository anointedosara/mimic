"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, Skull, MessagesSquare, Play, Bot, Sparkles, Gauge, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { AvatarDisplay } from "@/components/avatar-display";
import { AVATARS, getAvatar } from "@/lib/avatars";
import { MAX_PLAYERS, MIN_PLAYERS, maxImposters } from "@/lib/game/config";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { makeId } from "@/lib/passplay/storage";
import { AI_NAMES } from "@/lib/solo/names";
import type { Difficulty, SoloPlayer, SoloSettings } from "@/lib/solo/types";
import { StatsPanel } from "./stats-panel";

const HUMAN_KEY = "mimic:solo:human";

const DIFFICULTIES: Array<{ id: Difficulty; label: string; emoji: string; blurb: string }> = [
  { id: "easy", label: "Easy", emoji: "🌱", blurb: "Makes mistakes, votes randomly, gives obvious clues." },
  { id: "medium", label: "Medium", emoji: "⚖️", blurb: "Usually reasonable — but occasionally gets tricked." },
  { id: "hard", label: "Hard", emoji: "🔥", blurb: "Remembers statements, spots contradictions, accuses smartly." },
  { id: "chaos", label: "Chaos", emoji: "🌀", blurb: "Exaggerated personalities, unexpected alliances, wild games." },
];

function loadHuman(): { name: string; avatar: string } {
  if (typeof window === "undefined") return { name: "", avatar: "fox" };
  try {
    const raw = window.localStorage.getItem(HUMAN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { name: "", avatar: "fox" };
}

function saveHuman(name: string, avatar: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HUMAN_KEY, JSON.stringify({ name, avatar }));
  } catch {
    /* ignore */
  }
}

export function Setup({
  onStart,
  initialSettings,
}: {
  onStart: (human: SoloPlayer, settings: SoloSettings) => void;
  initialSettings?: SoloSettings;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("fox");
  const [total, setTotal] = useState(initialSettings?.totalPlayers ?? 6);
  const [imposters, setImposters] = useState(initialSettings?.imposterCount ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialSettings?.difficulty ?? "medium");
  const [clueRounds, setClueRounds] = useState(initialSettings?.clueRounds ?? 2);

  useEffect(() => {
    const saved = loadHuman();
    setName(saved.name);
    setAvatar(saved.avatar);
  }, []);

  const impMax = useMemo(() => maxImposters(total), [total]);
  useEffect(() => {
    if (imposters > impMax) setImposters(impMax);
  }, [impMax, imposters]);

  // Illustrative AI roster preview (names/avatars are re-rolled at game start).
  const preview = useMemo(() => {
    const taken = new Set([avatar]);
    const out: Array<{ name: string; avatar: string }> = [];
    let ai = 0;
    for (let i = 0; i < total - 1 && ai < AI_NAMES.length; i++) {
      const av = AVATARS.find((a) => !taken.has(a.id)) ?? AVATARS[i % AVATARS.length];
      taken.add(av.id);
      out.push({ name: AI_NAMES[ai++], avatar: av.id });
    }
    return out;
  }, [total, avatar]);

  const trimmedName = name.trim();
  const canStart = trimmedName.length > 0;

  function start() {
    if (!canStart) return;
    saveHuman(trimmedName, avatar);
    const human: SoloPlayer = { id: makeId(), name: trimmedName, avatar, isAI: false, personality: null };
    onStart(human, {
      totalPlayers: total,
      imposterCount: imposters,
      clueRounds,
      difficulty,
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-black sm:text-4xl">Solo Mode</h1>
          <Badge variant="gold" className="gap-1">
            <Sparkles className="h-3 w-3" /> vs AI
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          No friends around? Play against AI opponents — each with their own personality, clues and
          voting style. Blend in, or root out the mimics.
        </p>
      </motion.div>

      {/* Your identity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-mimic-cyan" /> You
          </CardTitle>
          <CardDescription>Pick your name and avatar. The rest of the table is AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <AvatarDisplay avatar={avatar} size="lg" />
            <div className="flex-1">
              <Label htmlFor="solo-name">Your name</Label>
              <Input
                id="solo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Enter your name"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAvatar(a.id);
                  playSound("click");
                }}
                aria-label={a.label}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-xl shadow transition-transform hover:scale-105 active:scale-95",
                  a.gradient,
                  avatar === a.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70",
                )}
              >
                {a.emoji}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table size */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-mimic-cyan" /> Total players
            <span className="text-sm font-normal text-muted-foreground">({total})</span>
          </CardTitle>
          <CardDescription>You plus {total - 1} AI player{total - 1 === 1 ? "" : "s"}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-muted-foreground">{MIN_PLAYERS}</span>
            <Slider
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              step={1}
              value={[total]}
              onValueChange={([v]) => setTotal(v)}
              aria-label="Total players"
            />
            <span className="text-xs font-bold text-muted-foreground">{MAX_PLAYERS}</span>
          </div>

          {/* Roster preview */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-primary/15 py-1 pl-1 pr-3 text-sm">
              <AvatarDisplay avatar={avatar} size="xs" />
              <span className="font-semibold">{trimmedName || "You"}</span>
              <Badge variant="secondary" className="ml-0.5">You</Badge>
            </div>
            {preview.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.04] py-1 pl-1 pr-3 text-sm"
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-base",
                    getAvatar(p.avatar).gradient,
                  )}
                >
                  {getAvatar(p.avatar).emoji}
                </span>
                <span className="font-medium text-muted-foreground">{p.name}</span>
                <Badge variant="outline" className="ml-0.5 gap-0.5">
                  <Bot className="h-3 w-3" /> AI
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            AI names, avatars and personalities are re-rolled every game.
          </p>
        </CardContent>
      </Card>

      {/* Imposters */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-mimic-fuchsia" /> Imposters
          </CardTitle>
          <CardDescription>
            1 to {impMax} imposter{impMax > 1 ? "s" : ""} for {total} players.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: impMax }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => {
                  setImposters(n);
                  playSound("click");
                }}
                className={cn(
                  "h-12 w-12 rounded-xl font-display text-lg font-bold transition-all",
                  imposters === n
                    ? "scale-105 bg-gradient-to-br from-mimic-fuchsia to-mimic-violet text-white shadow-lg"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Difficulty */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-mimic-amber" /> AI difficulty
          </CardTitle>
          <CardDescription>How sharp — and how wild — your opponents play.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDifficulty(d.id);
                playSound("click");
              }}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                difficulty === d.id
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-center gap-2 font-display font-bold">
                <span className="text-lg">{d.emoji}</span> {d.label}
              </div>
              <span className="text-xs text-muted-foreground">{d.blurb}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Clue rounds */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-mimic-amber" /> Clue rounds
          </CardTitle>
          <CardDescription>
            How many times the table goes around giving clues before the vote. More rounds means more
            to go on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setClueRounds(n);
                  playSound("click");
                }}
                className={cn(
                  "h-11 rounded-xl px-5 font-semibold transition-all",
                  clueRounds === n
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                {n} round{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mt-4">
        <StatsPanel />
      </div>

      {/* Start bar */}
      <div className="sticky bottom-4 z-10 mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl glass-strong p-4 sm:flex-row">
        <div className="text-sm text-muted-foreground">
          {total} players · {imposters} imposter{imposters > 1 ? "s" : ""} · {difficulty} ·{" "}
          {clueRounds} clue round{clueRounds > 1 ? "s" : ""}
        </div>
        <Button
          variant="gradient"
          size="lg"
          className="w-full glow sm:w-auto"
          onClick={start}
          disabled={!canStart}
        >
          <Play className="h-5 w-5" /> {canStart ? "Start game" : "Enter your name"}
        </Button>
      </div>
    </div>
  );
}
