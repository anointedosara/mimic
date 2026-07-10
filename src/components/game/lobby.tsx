"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Loader2, Users, Skull, Clock, Settings2, Bot } from "lucide-react";
import { toast } from "sonner";
import type { RoomSnapshot } from "@/lib/game/types";
import { PlayerTile } from "./player-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { roomActions } from "@/hooks/use-room";
import { DURATION_PRESETS, maxImposters } from "@/lib/game/config";
import { formatTime, cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

export function Lobby({ snapshot, selfId }: { snapshot: RoomSnapshot; selfId: string }) {
  const isHost = snapshot.hostId === selfId;
  const [starting, setStarting] = useState(false);
  const [filling, setFilling] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);

  const players = snapshot.players;
  const filled = players.length;
  const cap = snapshot.settings.maxPlayers;
  const canStart = filled >= 3;
  const openSlots = Math.max(0, cap - filled);
  const humanCount = players.filter((p) => !p.isAI).length;
  const aiCount = filled - humanCount;
  const impMax = maxImposters(cap);

  async function start() {
    setStarting(true);
    const res = await roomActions.start(snapshot.code);
    setStarting(false);
    if (!res.ok) toast.error(res.error ?? "Could not start");
  }

  async function fillWithAI() {
    setFilling(true);
    playSound("click");
    const res = await roomActions.fillWithAI(snapshot.code);
    setFilling(false);
    if (!res.ok) toast.error(res.error ?? "Could not add AI players");
  }

  async function updateSetting(patch: Record<string, number>) {
    setSavingSetting(true);
    playSound("click");
    const res = await roomActions.updateSettings(snapshot.code, patch);
    setSavingSetting(false);
    if (!res.ok) toast.error(res.error ?? "Could not update settings");
  }

  async function kick(userId: string, name: string) {
    const res = await roomActions.kick(snapshot.code, userId);
    if (!res.ok) toast.error(res.error ?? `Could not remove ${name}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-mimic-cyan" /> Lobby
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {filled === cap ? "Room full" : "Waiting for players…"}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">
                {filled} / {cap} joined
                {aiCount > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({humanCount} human{humanCount === 1 ? "" : "s"} · {aiCount} AI)
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">Min 3 to start</span>
            </div>
            <Progress value={(filled / cap) * 100} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            <AnimatePresence mode="popLayout">
              {players.map((p) => (
                <PlayerTile
                  key={p.userId}
                  player={p}
                  isSelf={p.userId === selfId}
                  onKick={isHost && p.userId !== selfId ? () => kick(p.userId, p.displayName) : undefined}
                />
              ))}
              {Array.from({ length: Math.max(0, cap - filled) }).slice(0, 12).map((_, i) => (
                <motion.div
                  key={`empty-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-white/10 text-2xl text-white/20"
                >
                  ?
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Host settings */}
      {isHost && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" /> Game settings
              {savingSetting && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Skull className="h-4 w-4 text-mimic-fuchsia" /> Imposters
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: impMax }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => updateSetting({ imposterCount: n })}
                    className={cn(
                      "h-10 w-10 rounded-xl font-display font-bold transition-all",
                      snapshot.settings.imposterCount === n
                        ? "bg-gradient-to-br from-mimic-fuchsia to-mimic-violet text-white scale-105"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4 text-mimic-amber" /> Discussion time
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => updateSetting({ durationSeconds: d })}
                    className={cn(
                      "h-10 rounded-xl px-3 text-sm font-semibold transition-all",
                      snapshot.settings.durationSeconds === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10",
                    )}
                  >
                    {formatTime(d)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-4 z-10">
        {isHost ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="gradient"
              size="lg"
              className="flex-1 glow"
              disabled={!canStart || starting}
              onClick={start}
            >
              {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {canStart
                ? openSlots > 0
                  ? "Start now"
                  : "Start game"
                : `Need ${3 - filled} more player${3 - filled === 1 ? "" : "s"}`}
            </Button>
            {openSlots > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                disabled={filling}
                onClick={fillWithAI}
              >
                {filling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bot className="h-5 w-5" />}
                Fill {openSlots} spot{openSlots === 1 ? "" : "s"} with AI
              </Button>
            )}
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}
