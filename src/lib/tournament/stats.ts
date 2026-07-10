// ============================================================================
// Survival Tournament leaderboard, persisted to localStorage. SSR-safe and
// namespaced under "mimic:tournament:stats". Everything here is client-only.
//
// A "game" is one full tournament (many rounds). We track lifetime totals plus
// a few personal records (best single-tournament figures) for the leaderboard.
// ============================================================================

export interface TournamentStats {
  /** Total tournaments finished. */
  tournamentsPlayed: number;
  /** Tournaments the human ended on the winning side. */
  tournamentWins: number;
  /** Tournaments won while the human was an imposter. */
  imposterWins: number;
  /** Record: most rounds survived in a single tournament. */
  longestSurvivalStreak: number;
  /** Record: most imposters the human's votes caught in a single tournament. */
  mostImpostersCaught: number;
  /** Record: best round-vote accuracy in a tournament (0..1). */
  bestVoteAccuracy: number;
  /** Lifetime rounds the human (as imposter) survived a vote uncaught. */
  totalEscapes: number;
  /** Lifetime imposters the human's votes helped eliminate. */
  totalImpostersCaught: number;
}

const STATS_KEY = "mimic:tournament:stats";

export const EMPTY_TOURNAMENT_STATS: TournamentStats = {
  tournamentsPlayed: 0,
  tournamentWins: 0,
  imposterWins: 0,
  longestSurvivalStreak: 0,
  mostImpostersCaught: 0,
  bestVoteAccuracy: 0,
  totalEscapes: 0,
  totalImpostersCaught: 0,
};

export function loadTournamentStats(): TournamentStats {
  if (typeof window === "undefined") return { ...EMPTY_TOURNAMENT_STATS };
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    return raw
      ? { ...EMPTY_TOURNAMENT_STATS, ...(JSON.parse(raw) as Partial<TournamentStats>) }
      : { ...EMPTY_TOURNAMENT_STATS };
  } catch {
    return { ...EMPTY_TOURNAMENT_STATS };
  }
}

function save(stats: TournamentStats): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

/** The per-tournament facts the store hands to `recordTournament`. */
export interface TournamentOutcome {
  won: boolean;
  /** Was the human an imposter this tournament? */
  wasImposter: boolean;
  /** Rounds the human survived before elimination (or to the end). */
  roundsSurvived: number;
  /** Imposters the human's votes eliminated this tournament. */
  impostersCaught: number;
  /** Rounds the human (as imposter) escaped a vote this tournament. */
  escapes: number;
  /** Votes the human cast this tournament (for accuracy). */
  votesCast: number;
  /** Of those, how many landed on an actual imposter. */
  correctVotes: number;
}

/** Fold a finished tournament into the stored stats and persist. */
export function recordTournament(outcome: TournamentOutcome): TournamentStats {
  const prev = loadTournamentStats();
  const accuracy = outcome.votesCast > 0 ? outcome.correctVotes / outcome.votesCast : 0;

  const next: TournamentStats = {
    tournamentsPlayed: prev.tournamentsPlayed + 1,
    tournamentWins: prev.tournamentWins + (outcome.won ? 1 : 0),
    imposterWins: prev.imposterWins + (outcome.won && outcome.wasImposter ? 1 : 0),
    longestSurvivalStreak: Math.max(prev.longestSurvivalStreak, outcome.roundsSurvived),
    mostImpostersCaught: Math.max(prev.mostImpostersCaught, outcome.impostersCaught),
    bestVoteAccuracy: Math.max(prev.bestVoteAccuracy, accuracy),
    totalEscapes: prev.totalEscapes + Math.max(0, outcome.escapes),
    totalImpostersCaught: prev.totalImpostersCaught + Math.max(0, outcome.impostersCaught),
  };
  save(next);
  return next;
}

export function resetTournamentStats(): TournamentStats {
  save({ ...EMPTY_TOURNAMENT_STATS });
  return { ...EMPTY_TOURNAMENT_STATS };
}
