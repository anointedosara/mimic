// ============================================================================
// Solo Mode lifetime statistics, persisted to localStorage. SSR-safe.
// Namespaced under "mimic:solo:stats". Everything here is client-only.
// ============================================================================

import type { Difficulty } from "./types";

const STATS_KEY = "mimic:solo:stats";

export interface SoloStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** Rounds the human was dealt the imposter role. */
  timesAsImposter: number;
  /** Times the human's own vote correctly landed on a real imposter. */
  impostersCaught: number;
  /** Rounds the human was an imposter and slipped away uncaught. */
  escapes: number;
  /** Current consecutive win streak. */
  winStreak: number;
  /** Best win streak ever reached. */
  bestStreak: number;
  /** Hardest difficulty the human has ever won on. */
  highestDifficultyBeaten: Difficulty | null;
}

export const EMPTY_STATS: SoloStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  timesAsImposter: 0,
  impostersCaught: 0,
  escapes: 0,
  winStreak: 0,
  bestStreak: 0,
  highestDifficultyBeaten: null,
};

/** Ordered difficulty rank for "highest beaten" comparisons. */
export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  chaos: 3,
};

/** Escape rate as a 0..1 fraction (0 when never an imposter). */
export function escapeRate(s: SoloStats): number {
  return s.timesAsImposter > 0 ? s.escapes / s.timesAsImposter : 0;
}

export function loadStats(): SoloStats {
  if (typeof window === "undefined") return { ...EMPTY_STATS };
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<SoloStats>) } : { ...EMPTY_STATS };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function save(stats: SoloStats): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

/** The per-game facts the store hands to `recordGame`. */
export interface GameOutcome {
  won: boolean;
  wasImposter: boolean;
  /** Human was an imposter and escaped uncaught. */
  escaped: boolean;
  /** How many genuine imposters the human's own ballot landed on. */
  caughtImposters: number;
  difficulty: Difficulty;
}

/** Fold a finished game into the stored stats and persist. Returns the new stats. */
export function recordGame(outcome: GameOutcome): SoloStats {
  const prev = loadStats();
  const winStreak = outcome.won ? prev.winStreak + 1 : 0;

  const higherBeaten =
    outcome.won &&
    (prev.highestDifficultyBeaten === null ||
      DIFFICULTY_RANK[outcome.difficulty] > DIFFICULTY_RANK[prev.highestDifficultyBeaten]);

  const next: SoloStats = {
    gamesPlayed: prev.gamesPlayed + 1,
    wins: prev.wins + (outcome.won ? 1 : 0),
    losses: prev.losses + (outcome.won ? 0 : 1),
    timesAsImposter: prev.timesAsImposter + (outcome.wasImposter ? 1 : 0),
    impostersCaught: prev.impostersCaught + Math.max(0, outcome.caughtImposters),
    escapes: prev.escapes + (outcome.escaped ? 1 : 0),
    winStreak,
    bestStreak: Math.max(prev.bestStreak, winStreak),
    highestDifficultyBeaten: higherBeaten ? outcome.difficulty : prev.highestDifficultyBeaten,
  };
  save(next);
  return next;
}

export function resetStats(): SoloStats {
  save({ ...EMPTY_STATS });
  return { ...EMPTY_STATS };
}
