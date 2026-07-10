// ============================================================================
// Pure round engine for Survival Tournament. No I/O — reuses the shared role
// assignment + shuffle and the bundled word picker. Deterministic when an rng
// is injected (see engine.test.ts).
//
// The tournament differs from a one-shot round in three ways handled here:
//   1. Imposters are assigned ONCE (assignInitialImposters) and persist.
//   2. Each round eliminates exactly ONE player — the most-voted seat.
//   3. End conditions are checked after every elimination (evaluateEnd).
// ============================================================================

import type { PlayerRole } from "@/lib/game/types";
import { assignRoles } from "@/lib/game/engine";
import { pickWord } from "@/lib/passplay/engine";
import type {
  TournamentPlayer,
  TournamentRound,
  TournamentStatus,
  TournamentVote,
  VoteTally,
} from "./types";

/**
 * Choose the permanent imposters among ALL seats at the table. Called once at
 * the start of the tournament; the chosen ids stay imposters until eliminated.
 */
export function assignInitialImposters(
  players: TournamentPlayer[],
  imposterCount: number,
  rng: () => number = Math.random,
): string[] {
  const ids = players.map((p) => p.id);
  const count = Math.min(Math.max(1, imposterCount), Math.max(1, ids.length - 1));
  return assignRoles(ids, count, rng).imposterIds;
}

/**
 * Deal a round for the currently-active players: pick a fresh word and project
 * the permanent imposter set onto the seats still in play. Imposters are NOT
 * re-chosen — only ones still active are marked.
 */
export function dealRound(
  activePlayers: TournamentPlayer[],
  imposterIds: string[],
  exclude: string[] = [],
  rng: () => number = Math.random,
): TournamentRound {
  const picked = pickWord(exclude, rng);
  const imposterSet = new Set(imposterIds);
  const activeImposters = activePlayers.filter((p) => imposterSet.has(p.id)).map((p) => p.id);
  const roles: Record<string, PlayerRole> = {};
  for (const p of activePlayers) {
    roles[p.id] = imposterSet.has(p.id) ? "imposter" : "player";
  }
  return {
    word: picked.word,
    imposterHint: picked.imposterHint,
    category: picked.category,
    roles,
    imposterIds: activeImposters,
  };
}

/**
 * Tally a round's votes and pick the single eliminated seat: the player with
 * the most votes. Ties are broken at random (rng) for drama. Returns the id and
 * the full breakdown (most-voted first) for the reveal.
 */
export function tallyElimination(
  votes: TournamentVote[],
  activePlayers: TournamentPlayer[],
  rng: () => number = Math.random,
): { eliminatedId: string; voteBreakdown: VoteTally[] } {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);

  const nameOf = (id: string) => activePlayers.find((p) => p.id === id)?.name ?? "Unknown";
  const voteBreakdown: VoteTally[] = Array.from(counts.entries())
    .map(([targetId, count]) => ({ targetId, targetName: nameOf(targetId), votes: count }))
    .sort((a, b) => b.votes - a.votes);

  const maxVotes = voteBreakdown[0]?.votes ?? 0;
  const topTied = voteBreakdown.filter((b) => b.votes === maxVotes).map((b) => b.targetId);
  const eliminatedId = topTied.length
    ? topTied[Math.floor(rng() * topTied.length)]
    : (activePlayers[0]?.id ?? "");

  return { eliminatedId, voteBreakdown };
}

/**
 * Resolve the tournament status from the counts of imposters and normals still
 * active AFTER an elimination.
 *  - No imposters left  → players win (every imposter was caught).
 *  - Imposters ≥ normals → imposters win (they've reached parity).
 *  - Otherwise           → the tournament continues into another round.
 */
export function evaluateEnd(
  remainingImposters: number,
  remainingNormals: number,
): TournamentStatus {
  if (remainingImposters <= 0) return "players_win";
  if (remainingImposters >= remainingNormals) return "imposters_win";
  return "continue";
}
