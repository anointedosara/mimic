// ============================================================================
// Pure round engine for Solo Mode. No I/O — reuses the shared role-assignment
// engine and the bundled word list, and the Pass & Play word picker. The AI's
// behaviour lives in ai.ts / chat.ts; this file only deals the round and score
// the votes. Deterministic when an rng is injected (see engine.test.ts).
// ============================================================================

import { assignRoles } from "@/lib/game/engine";
import { clampImposters } from "@/lib/game/config";
import { pickWord } from "@/lib/passplay/engine";
import type { SoloPlayer, SoloRound, SoloResult, SoloVote } from "./types";

/** Deal a round: pick a word and assign imposters among all seats. */
export function buildRound(
  players: SoloPlayer[],
  imposterCount: number,
  exclude: string[] = [],
  rng: () => number = Math.random,
): SoloRound {
  const ids = players.map((p) => p.id);
  const picked = pickWord(exclude, rng);
  const count = clampImposters(imposterCount, ids.length);
  const { roles, imposterIds } = assignRoles(ids, count, rng);

  return {
    word: picked.word,
    imposterHint: picked.imposterHint,
    category: picked.category,
    roles,
    imposterIds,
  };
}

/**
 * Resolve a round from everyone's votes.
 *
 * An imposter is "caught" if they received votes from at least half the voters
 * (rounded up) — the same decisive threshold the online game uses. Players win
 * only when EVERY imposter is caught; otherwise the imposters win.
 */
export function resolveRound(
  round: SoloRound,
  players: SoloPlayer[],
  votes: SoloVote[],
): SoloResult {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown";
  const imposterSet = new Set(round.imposterIds);
  const catchThreshold = Math.max(1, Math.ceil(players.length / 2));

  const imposters = players
    .filter((p) => imposterSet.has(p.id))
    .map((p) => {
      const votesReceived = counts.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isAI: p.isAI,
        votesReceived,
        caught: votesReceived >= catchThreshold,
      };
    });

  const voteBreakdown = Array.from(counts.entries())
    .map(([targetId, count]) => ({ targetId, targetName: nameOf(targetId), votes: count }))
    .sort((a, b) => b.votes - a.votes);

  const allCaught = imposters.length > 0 && imposters.every((i) => i.caught);
  const winningSide: "players" | "imposters" = allCaught ? "players" : "imposters";
  const winners = allCaught
    ? players.filter((p) => !imposterSet.has(p.id)).map((p) => p.id)
    : round.imposterIds;

  return {
    realWord: round.word,
    imposterHint: round.imposterHint,
    category: round.category,
    imposters,
    voteBreakdown,
    votes,
    winners,
    winningSide,
  };
}
