"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, Users, Skull, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn, formatTime } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  DURATION_PRESETS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  maxImposters,
  clampDuration,
} from "@/lib/game/config";
import { playSound } from "@/lib/sounds";

export default function CreateRoomPage() {
  const router = useRouter();
  const { status } = useSession();

  const [players, setPlayers] = useState(DEFAULT_SETTINGS.maxPlayers);
  const [imposters, setImposters] = useState(DEFAULT_SETTINGS.imposterCount);
  const [duration, setDuration] = useState(DEFAULT_SETTINGS.durationSeconds);
  const [customDuration, setCustomDuration] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/create-room");
  }, [status, router]);

  const impMax = useMemo(() => maxImposters(players), [players]);

  // Keep imposter count valid when player count changes.
  useEffect(() => {
    if (imposters > impMax) setImposters(impMax);
  }, [impMax, imposters]);

  async function handleCreate() {
    setLoading(true);
    const finalDuration = useCustom ? clampDuration(Number(customDuration) || duration) : duration;
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPlayers: players,
          imposterCount: imposters,
          durationSeconds: finalDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create room");
        setLoading(false);
        return;
      }
      playSound("start");
      router.push(`/room/${data.code}`);
    } catch {
      toast.error("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container max-w-2xl py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-black">Create a room</h1>
          <p className="mt-1 text-muted-foreground">Set the table, then invite your friends.</p>
        </motion.div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-mimic-cyan" /> Players
            </CardTitle>
            <CardDescription>
              How many can join this room? ({MIN_PLAYERS}–{MAX_PLAYERS})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Slider
                value={[players]}
                min={MIN_PLAYERS}
                max={MAX_PLAYERS}
                step={1}
                onValueChange={([v]) => setPlayers(v)}
              />
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 font-display text-xl font-bold text-primary">
                {players}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-mimic-fuchsia" /> Imposters
            </CardTitle>
            <CardDescription>1 to floor(players / 3) = up to {impMax} imposter{impMax > 1 ? "s" : ""}</CardDescription>
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
                      ? "bg-gradient-to-br from-mimic-fuchsia to-mimic-violet text-white shadow-lg scale-105"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-mimic-amber" /> Discussion time
            </CardTitle>
            <CardDescription>How long players discuss before voting.</CardDescription>
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
                  useCustom ? "bg-primary text-primary-foreground shadow-lg" : "bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <div className="flex items-center gap-2">
                <Label htmlFor="custom" className="shrink-0">
                  Seconds (30–900)
                </Label>
                <Input
                  id="custom"
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

        <div className="mt-6 flex items-center justify-between rounded-2xl glass p-4">
          <div className="text-sm text-muted-foreground">
            {players} players · {imposters} imposter{imposters > 1 ? "s" : ""} ·{" "}
            {formatTime(useCustom ? clampDuration(Number(customDuration) || duration) : duration)}
          </div>
          <Button variant="gradient" size="lg" onClick={handleCreate} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Create room
          </Button>
        </div>
      </main>
    </div>
  );
}
