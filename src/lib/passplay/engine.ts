// ============================================================================
// Pure offline game engine for Pass & Play. No I/O, no DB, no network.
// Reuses the shared pure engine (role assignment + shuffle) and the bundled
// word list so an offline round can be dealt entirely on-device.
// Deterministic when an rng is injected — see engine.test.ts.
// ============================================================================

import { WORDS, type WordEntry } from "@/lib/data/words";
import { assignRoles, shuffle } from "@/lib/game/engine";
import { clampImposters } from "@/lib/game/config";
import type { PassPlayer, PassRound, PassResult } from "./types";

/** Pick a random word, avoiding recently-used ones. Bundled data only. */
export function pickWord(exclude: string[] = [], rng: () => number = Math.random): WordEntry {
  const excludeSet = new Set(exclude.map((w) => w.toLowerCase()));
  const pool = WORDS.filter((w) => !excludeSet.has(w.word.toLowerCase()));
  const source = pool.length ? pool : WORDS;
  return source[Math.floor(rng() * source.length)];
}

/**
 * Deal a full round: pick a word, assign imposters, and randomise the order in
 * which players will view their secret role. `imposterCount` is clamped to a
 * valid range for the table size.
 */
export function buildRound(
  players: PassPlayer[],
  imposterCount: number,
  exclude: string[] = [],
  rng: () => number = Math.random,
): PassRound {
  const ids = players.map((p) => p.id);
  const picked = pickWord(exclude, rng);
  const count = clampImposters(imposterCount, ids.length);
  const { roles, imposterIds } = assignRoles(ids, count, rng);
  const viewOrder = shuffle(ids, rng);

  return {
    word: picked.word,
    imposterHint: picked.imposterHint,
    category: picked.category,
    roles,
    imposterIds,
    viewOrder,
  };
}

/**
 * Resolve a round from the group's accusations.
 *
 * Model: on a single device the group collectively votes out one suspect per
 * imposter (`accusedIds.length === imposterIds.length`). An imposter is
 * "caught" if they were accused. Players win only if EVERY imposter was caught;
 * otherwise at least one blended in and the imposters win.
 */
export function resolveRound(
  round: PassRound,
  players: PassPlayer[],
  accusedIds: string[],
): PassResult {
  const accused = new Set(accusedIds);
  const imposterSet = new Set(round.imposterIds);

  const imposters = players
    .filter((p) => imposterSet.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      caught: accused.has(p.id),
    }));

  const allCaught = imposters.length > 0 && imposters.every((i) => i.caught);

  return {
    realWord: round.word,
    imposterHint: round.imposterHint,
    category: round.category,
    imposters,
    accusedIds,
    winningSide: allCaught ? "players" : "imposters",
  };
}
