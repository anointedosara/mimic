"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserPlus,
  Users,
  Skull,
  Clock,
  Shuffle,
  Trash2,
  Play,
  Save,
  BookmarkPlus,
  FolderOpen,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AVATARS, getAvatar } from "@/lib/avatars";
import {
  DURATION_PRESETS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  clampDuration,
  maxImposters,
} from "@/lib/game/config";
import { shuffle } from "@/lib/game/engine";
import { cn, formatTime } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import {
  deleteTemplate,
  loadRoster,
  loadTemplates,
  makeId,
  saveTemplate,
  type PlayerTemplate,
} from "@/lib/passplay/storage";
import type { PassPlayer, PassSettings } from "@/lib/passplay/types";

const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

/** First avatar not already taken by another player (wraps if all used). */
function nextFreeAvatar(taken: string[]): string {
  const free = AVATARS.find((a) => !taken.includes(a.id));
  return (free ?? AVATARS[taken.length % AVATARS.length]).id;
}

function makePlayer(name: string, taken: string[]): PassPlayer {
  return { id: makeId(), name, avatar: nextFreeAvatar(taken) };
}

function seedPlayers(): PassPlayer[] {
  const players: PassPlayer[] = [];
  for (const name of DEFAULT_NAMES) {
    players.push(makePlayer(name, players.map((p) => p.avatar)));
  }
  return players;
}

export function Setup({
  onStart,
  initialPlayers,
  initialSettings,
}: {
  onStart: (players: PassPlayer[], settings: PassSettings) => void;
  initialPlayers?: PassPlayer[];
  initialSettings?: PassSettings;
}) {
  const [players, setPlayers] = useState<PassPlayer[]>(
    () => initialPlayers && initialPlayers.length >= MIN_PLAYERS ? initialPlayers : seedPlayers(),
  );
  const [imposters, setImposters] = useState(initialSettings?.imposterCount ?? 1);
  const [duration, setDuration] = useState(initialSettings?.durationSeconds ?? 120);
  const [useCustom, setUseCustom] = useState(
    () => !!initialSettings && !DURATION_PRESETS.includes(initialSettings.durationSeconds as never),
  );
  const [customDuration, setCustomDuration] = useState(
    () => (initialSettings && isCustomDuration(initialSettings.durationSeconds) ? String(initialSettings.durationSeconds) : ""),
  );

  const [templates, setTemplates] = useState<PlayerTemplate[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Load saved roster/templates on mount (client only). Only prefill the roster
  // when the caller didn't hand us one (e.g. first visit, not "edit players").
  useEffect(() => {
    setTemplates(loadTemplates());
    if (!initialPlayers) {
      const saved = loadRoster();
      if (saved.length >= MIN_PLAYERS) setPlayers(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const impMax = useMemo(() => maxImposters(players.length), [players.length]);
  useEffect(() => {
    if (imposters > impMax) setImposters(impMax);
  }, [impMax, imposters]);

  const canAdd = players.length < MAX_PLAYERS;
  const canRemove = players.length > MIN_PLAYERS;
  const tooFew = players.length < MIN_PLAYERS;
  const finalDuration = useCustom ? clampDuration(Number(customDuration) || duration) : duration;

  function addPlayer() {
    if (!canAdd) return;
    playSound("join");
    setPlayers((prev) => [...prev, makePlayer(`Player ${prev.length + 1}`, prev.map((p) => p.avatar))]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => (prev.length > MIN_PLAYERS ? prev.filter((p) => p.id !== id) : prev));
  }

  function renamePlayer(id: string, name: string) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  function cycleAvatar(id: string) {
    playSound("click");
    setPlayers((prev) => {
      const taken = prev.map((p) => p.avatar);
      return prev.map((p) => {
        if (p.id !== id) return p;
        const idx = AVATARS.findIndex((a) => a.id === p.avatar);
        // Advance to the next avatar that isn't taken by someone else.
        for (let step = 1; step <= AVATARS.length; step++) {
          const cand = AVATARS[(idx + step) % AVATARS.length];
          if (cand.id === p.avatar || !taken.includes(cand.id)) {
            return { ...p, avatar: cand.id };
          }
        }
        return p;
      });
    });
  }

  function randomizeOrder() {
    playSound("click");
    setPlayers((prev) => shuffle(prev));
  }

  function doSaveTemplate() {
    const next = saveTemplate(templateName, players);
    setTemplates(next);
    setSaveOpen(false);
    setTemplateName("");
    playSound("start");
  }

  function applyTemplate(t: PlayerTemplate) {
    // Fresh ids so editing this roster never mutates the saved template.
    setPlayers(t.players.map((p) => ({ ...p, id: makeId() })));
    setLoadOpen(false);
    playSound("join");
  }

  function removeTemplate(id: string) {
    setTemplates(deleteTemplate(id));
  }

  function start() {
    if (tooFew) return;
    const cleaned = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Player ${i + 1}`,
    }));
    onStart(cleaned, { imposterCount: imposters, durationSeconds: finalDuration });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-black sm:text-4xl">Pass &amp; Play</h1>
        <p className="mt-1 text-muted-foreground">
          One phone, passed around the circle. No internet, no accounts — just your friends.
        </p>
      </motion.div>

      {/* Players */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-mimic-cyan" /> Players
              <span className="text-sm font-normal text-muted-foreground">
                ({players.length}/{MAX_PLAYERS})
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLoadOpen(true)}>
                <FolderOpen className="h-4 w-4" /> Load
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSaveOpen(true)}>
                <BookmarkPlus className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
          <CardDescription>
            Tap an avatar to change it. Names are saved on this device for next time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence initial={false}>
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center gap-3"
              >
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => cycleAvatar(p.id)}
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl shadow-lg ring-2 ring-white/20 transition-transform hover:scale-105 active:scale-95",
                    getAvatar(p.avatar).gradient,
                  )}
                  aria-label={`Change ${p.name}'s avatar`}
                  title="Tap to change avatar"
                >
                  {getAvatar(p.avatar).emoji}
                </button>
                <Input
                  value={p.name}
                  onChange={(e) => renamePlayer(p.id, e.target.value)}
                  maxLength={24}
                  placeholder={`Player ${i + 1}`}
                  className="h-11"
                  aria-label={`Name for player ${i + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePlayer(p.id)}
                  disabled={!canRemove}
                  aria-label={`Remove ${p.name}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={addPlayer} disabled={!canAdd}>
              <UserPlus className="h-4 w-4" /> Add player
            </Button>
            <Button variant="outline" className="flex-1" onClick={randomizeOrder}>
              <Shuffle className="h-4 w-4" /> Randomize order
            </Button>
          </div>
          {tooFew && (
            <p className="pt-1 text-center text-sm text-rose-400">
              Add at least {MIN_PLAYERS} players to start.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Imposters */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-mimic-fuchsia" /> Imposters
          </CardTitle>
          <CardDescription>
            1 to {impMax} imposter{impMax > 1 ? "s" : ""} for {players.length} players.
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

      {/* Duration */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-mimic-amber" /> Discussion time
          </CardTitle>
          <CardDescription>How long the group talks before voting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDuration(d);
                  setUseCustom(false);
                  playSound("click");
                }}
                className={cn(
                  "h-11 rounded-xl px-4 font-semibold transition-all",
                  !useCustom && duration === d
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                {d / 60} min
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={cn(
                "h-11 rounded-xl px-4 font-semibold transition-all",
                useCustom
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10",
              )}
            >
              Custom
            </button>
          </div>
          {useCustom && (
            <div className="flex items-center gap-2">
              <Label htmlFor="pp-custom" className="shrink-0">
                Seconds (30–900)
              </Label>
              <Input
                id="pp-custom"
                type="number"
                min={30}
                max={900}
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                placeholder="e.g. 240"
                className="max-w-[10rem]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start bar */}
      <div className="sticky bottom-4 z-10 mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl glass-strong p-4 sm:flex-row">
        <div className="text-sm text-muted-foreground">
          {players.length} players · {imposters} imposter{imposters > 1 ? "s" : ""} ·{" "}
          {formatTime(finalDuration)}
        </div>
        <Button
          variant="gradient"
          size="lg"
          className="w-full glow sm:w-auto"
          onClick={start}
          disabled={tooFew}
        >
          <Play className="h-5 w-5" /> Start game
        </Button>
      </div>

      {/* Save template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save player list</DialogTitle>
            <DialogDescription>
              Store this group of {players.length} so you can reuse it next time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Friday Crew"
              maxLength={30}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && doSaveTemplate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={doSaveTemplate} disabled={!templateName.trim()}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load template dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Saved player lists</DialogTitle>
            <DialogDescription>Load a group you saved earlier.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {templates.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No saved lists yet. Save one from the Players card.
              </p>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-3"
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <div className="flex -space-x-2">
                    {t.players.slice(0, 5).map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-sm ring-2 ring-background",
                          getAvatar(p.avatar).gradient,
                        )}
                      >
                        {getAvatar(p.avatar).emoji}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.players.length} players</div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTemplate(t.id)}
                  aria-label={`Delete ${t.name}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isCustomDuration(seconds: number): boolean {
  return !DURATION_PRESETS.includes(seconds as never);
}
