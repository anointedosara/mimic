"use client";

import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Skull, Flame, Crosshair, Target, Ghost, Gamepad2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EMPTY_TOURNAMENT_STATS,
  loadTournamentStats,
  resetTournamentStats,
  type TournamentStats,
} from "@/lib/tournament/stats";

function useStats(refreshKey?: unknown): [TournamentStats, () => void] {
  const [stats, setStats] = useState<TournamentStats>(EMPTY_TOURNAMENT_STATS);
  useEffect(() => {
    setStats(loadTournamentStats());
  }, [refreshKey]);
  return [stats, () => setStats(resetTournamentStats())];
}

export function Leaderboard({ refreshKey }: { refreshKey?: unknown }) {
  const [stats, reset] = useStats(refreshKey);
  const accuracy = Math.round(stats.bestVoteAccuracy * 100);

  const tiles: Array<{ icon: typeof Trophy; label: string; value: string | number; tint: string }> = [
    { icon: Gamepad2, label: "Games played", value: stats.tournamentsPlayed, tint: "text-mimic-cyan" },
    { icon: Trophy, label: "Tournament wins", value: stats.tournamentWins, tint: "text-mimic-amber" },
    { icon: Skull, label: "Imposter wins", value: stats.imposterWins, tint: "text-mimic-fuchsia" },
    { icon: Flame, label: "Longest survival", value: `${stats.longestSurvivalStreak}R`, tint: "text-orange-400" },
    { icon: Crosshair, label: "Most caught (1 game)", value: stats.mostImpostersCaught, tint: "text-emerald-400" },
    { icon: Target, label: "Best vote accuracy", value: `${accuracy}%`, tint: "text-mimic-cyan" },
    { icon: Ghost, label: "Escapes as imposter", value: stats.totalEscapes, tint: "text-mimic-violet" },
    { icon: Crosshair, label: "Total caught", value: stats.totalImpostersCaught, tint: "text-emerald-400" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-mimic-amber" /> Leaderboard
            </CardTitle>
            <CardDescription>Your tournament records, saved on this device.</CardDescription>
          </div>
          {stats.tournamentsPlayed > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white/[0.03] p-3 text-center">
              <t.icon className={`mx-auto h-4 w-4 ${t.tint}`} />
              <div className="mt-1 font-display text-2xl font-black tabular-nums">{t.value}</div>
              <div className="mt-0.5 text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
