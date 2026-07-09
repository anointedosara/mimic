"use client";

import { useEffect, useState } from "react";
import { BarChart3, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EMPTY_STATS,
  escapeRate,
  loadStats,
  resetStats,
  type SoloStats,
} from "@/lib/solo/stats";

/** Read live stats from localStorage on mount (and whenever `refreshKey` changes). */
function useStats(refreshKey?: unknown): [SoloStats, () => void] {
  const [stats, setStats] = useState<SoloStats>(EMPTY_STATS);
  useEffect(() => {
    setStats(loadStats());
  }, [refreshKey]);
  return [stats, () => setStats(resetStats())];
}

const DIFF_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  chaos: "Chaos",
};

export function StatsPanel({ refreshKey }: { refreshKey?: unknown }) {
  const [stats, reset] = useStats(refreshKey);

  const winRate = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const escPct = Math.round(escapeRate(stats) * 100);

  const tiles: Array<{ label: string; value: string | number }> = [
    { label: "Games", value: stats.gamesPlayed },
    { label: "Wins", value: stats.wins },
    { label: "Losses", value: stats.losses },
    { label: "Win rate", value: `${winRate}%` },
    { label: "As imposter", value: stats.timesAsImposter },
    { label: "Imposters caught", value: stats.impostersCaught },
    { label: "Escape rate", value: `${escPct}%` },
    { label: "Win streak", value: stats.winStreak },
    { label: "Best streak", value: stats.bestStreak },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-mimic-cyan" /> Your stats
            </CardTitle>
            <CardDescription>Saved on this device across every solo game.</CardDescription>
          </div>
          {stats.gamesPlayed > 0 && (
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
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white/[0.03] p-3 text-center">
              <div className="font-display text-2xl font-black tabular-nums">{t.value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.label}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
          <span className="text-sm text-muted-foreground">Highest difficulty beaten</span>
          {stats.highestDifficultyBeaten ? (
            <Badge variant="gold">{DIFF_LABEL[stats.highestDifficultyBeaten]}</Badge>
          ) : (
            <Badge variant="outline">None yet</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
