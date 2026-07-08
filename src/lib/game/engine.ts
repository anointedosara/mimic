// ============================================================================
// Pure game engine. No I/O, no DB, no sockets — deterministic & unit-testable.
// This is the SERVER-ONLY source of truth for roles. The functions here decide
// who is an imposter and how votes resolve; nothing here is ever sent whole to
// a client.
// ============================================================================

import type { PlayerRole, PublicVote, RevealResult } from "./types";

/** Fisher–Yates shuffle (returns a new array). Uses injected RNG for testing. */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface AssignedRoles {
  /** Map of userId -> role. Lives ONLY on the server. */
  roles: Record<string, PlayerRole>;
  /** The userIds chosen as imposters. Server-only. */
  imposterIds: string[];
}

/**
 * Randomly assign `imposterCount` imposters among the given userIds.
 * Every non-imposter is a normal "player". Server-only output.
 */
export function assignRoles(
  userIds: string[],
  imposterCount: number,
  rng: () => number = Math.random,
): AssignedRoles {
  const count = Math.min(Math.max(1, imposterCount), Math.max(1, userIds.length - 1));
  const shuffled = shuffle(userIds, rng);
  const imposterIds = shuffled.slice(0, count);
  const imposterSet = new Set(imposterIds);
  const roles: Record<string, PlayerRole> = {};
  for (const id of userIds) {
    roles[id] = imposterSet.has(id) ? "imposter" : "player";
  }
  return { roles, imposterIds };
}

/** Count votes per target from the live vote list. */
export function tallyVotes(votes: PublicVote[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Resolve a completed round into a reveal result.
 *
 * Rules:
 *  - An imposter is "caught" if the number of votes they received is at least
 *    the plurality threshold: they are among the top-voted AND received votes
 *    from at least half of the voters (rounded up). This keeps it decisive for
 *    small rooms while still requiring genuine group suspicion.
 *  - Players win if EVERY imposter was caught. Imposters win otherwise (at
 *    least one escaped).
 */
export function resolveRound(params: {
  votes: PublicVote[];
  imposterIds: string[];
  players: Array<{ userId: string; displayName: string; avatar: string }>;
  realWord: string;
  imposterHint: string;
  category: string;
  voterCount: number;
}): RevealResult {
  const { votes, imposterIds, players, realWord, imposterHint, category, voterCount } = params;

  const counts = tallyVotes(votes);
  const nameOf = (id: string) => players.find((p) => p.userId === id)?.displayName ?? "Unknown";

  // A player is "caught" if they received votes from at least half of voters.
  const catchThreshold = Math.max(1, Math.ceil(voterCount / 2));

  const imposterSet = new Set(imposterIds);

  const imposters = players
    .filter((p) => imposterSet.has(p.userId))
    .map((p) => {
      const votesReceived = counts.get(p.userId) ?? 0;
      return {
        userId: p.userId,
        displayName: p.displayName,
        avatar: p.avatar,
        votesReceived,
        caught: votesReceived >= catchThreshold,
      };
    });

  const voteBreakdown = Array.from(counts.entries())
    .map(([targetId, count]) => ({ targetId, targetName: nameOf(targetId), votes: count }))
    .sort((a, b) => b.votes - a.votes);

  const allCaught = imposters.length > 0 && imposters.every((i) => i.caught);
  const winningSide: "imposters" | "players" = allCaught ? "players" : "imposters";

  const winners = allCaught
    ? players.filter((p) => !imposterSet.has(p.userId)).map((p) => p.userId)
    : imposterIds;

  return {
    realWord,
    imposterHint,
    category,
    imposters,
    voteBreakdown,
    winners,
    winningSide,
  };
}
