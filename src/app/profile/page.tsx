"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Save, Trophy, Skull, Target, Percent, Gamepad2, Frown } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

interface ProfileData {
  id: string;
  displayName: string;
  email: string;
  avatar: string;
  statistics: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    timesAsImposter: number;
    timesCaught: number;
    winRate: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { status, update } = useSession();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("fox");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/profile");
  }, [status, router]);

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (data) {
      setName(data.displayName);
      setAvatar(data.avatar);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: { displayName: string; avatar: string }) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      return res.json();
    },
    onSuccess: async (res) => {
      toast.success("Profile updated");
      playSound("join");
      await update({ displayName: res.displayName, avatar: res.avatar });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = data?.statistics;
  const dirty = data && (name !== data.displayName || avatar !== data.avatar);

  const STAT_CARDS = stats
    ? [
        { icon: Gamepad2, label: "Games", value: stats.gamesPlayed, color: "text-mimic-cyan" },
        { icon: Trophy, label: "Wins", value: stats.wins, color: "text-emerald-400" },
        { icon: Frown, label: "Losses", value: stats.losses, color: "text-rose-400" },
        { icon: Percent, label: "Win rate", value: `${stats.winRate}%`, color: "text-mimic-amber" },
        { icon: Skull, label: "As imposter", value: stats.timesAsImposter, color: "text-mimic-fuchsia" },
        { icon: Target, label: "Times caught", value: stats.timesCaught, color: "text-orange-400" },
      ]
    : [];

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container max-w-4xl py-10">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-black"
        >
          Your profile
        </motion.h1>

        {/* Statistics */}
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {isLoading || !stats
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : STAT_CARDS.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass card-hover rounded-2xl p-4"
                  >
                    <s.icon className={cn("h-5 w-5", s.color)} />
                    <div className="mt-2 font-display text-3xl font-black">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </motion.div>
                ))}
          </div>
        </section>

        {/* Edit profile */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={name}
                minLength={2}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAvatar(a.id);
                      playSound("click");
                    }}
                    aria-label={a.label}
                    aria-pressed={avatar === a.id}
                    className={cn(
                      "grid aspect-square place-items-center rounded-lg bg-gradient-to-br text-xl transition-all",
                      a.gradient,
                      avatar === a.id ? "ring-2 ring-white scale-105" : "opacity-70 hover:opacity-100",
                    )}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="gradient"
              disabled={!dirty || mutation.isPending}
              onClick={() => mutation.mutate({ displayName: name, avatar })}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
