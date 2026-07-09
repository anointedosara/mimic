// ============================================================================
// AI behaviour: seat generation + voting. Pure & deterministic when an rng is
// injected (see ai.test.ts). Voting uses hidden role knowledge, gated by
// difficulty, to *simulate* intelligence: harder AIs converge on real imposters
// far more often. Personality jitter and Chaos difficulty add unpredictability.
// ============================================================================

import { AVATARS } from "@/lib/avatars";
import { shuffle } from "@/lib/game/engine";
import { makeId } from "@/lib/passplay/storage";
import { AI_NAMES } from "./names";
import { PERSONALITY_LIST, getPersonality } from "./personalities";
import type { Difficulty, Personality, SoloPlayer, SoloRound, SoloVote } from "./types";

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Build the AI opponents to sit alongside the human. Names, avatars and
 * personalities are all distinct where the pools allow.
 */
export function generateAIPlayers(
  count: number,
  takenAvatars: string[],
  rng: () => number = Math.random,
): SoloPlayer[] {
  const names = shuffle(AI_NAMES, rng);
  const avatarPool = shuffle(
    AVATARS.map((a) => a.id).filter((id) => !takenAvatars.includes(id)),
    rng,
  );
  // Shuffle the 8 personalities and cycle through them for variety.
  const personalities = shuffle(PERSONALITY_LIST.map((p) => p.id), rng);

  const out: SoloPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const avatar = avatarPool[i] ?? pick(AVATARS, rng).id;
    out.push({
      id: makeId(),
      name: names[i] ?? `Bot ${i + 1}`,
      avatar,
      isAI: true,
      personality: personalities[i % personalities.length] as Personality,
    });
  }
  return out;
}

/** Baseline detection skill per difficulty — how much a hidden imposter "tell"
 *  weighs into suspicion even when they clued cleanly. */
function detectionSkill(difficulty: Difficulty, rng: () => number): number {
  switch (difficulty) {
    case "easy":
      return 0.35;
    case "medium":
      return 0.6;
    case "hard":
      return 0.9;
    case "chaos":
      return 0.2 + rng() * 0.7; // wildly variable round to round
  }
}

/**
 * Score every player by how suspicious their CLUES made them look. Visible
 * whiffs (vague/off clue words, in `suspicion`) dominate; a smaller
 * difficulty-gated term represents the table "sensing" a clean-blending
 * imposter. This grounds votes in the clues on screen.
 */
function suspicionScores(
  round: SoloRound,
  players: SoloPlayer[],
  difficulty: Difficulty,
  suspicion: Record<string, number>,
  rng: () => number,
): Record<string, number> {
  const skill = detectionSkill(difficulty, rng);
  const chaos = difficulty === "chaos";
  const imposterSet = new Set(round.imposterIds);
  const scores: Record<string, number> = {};
  for (const p of players) {
    let s = (suspicion[p.id] ?? 0) * 2; // visible whiffs weigh most
    if (imposterSet.has(p.id)) s += skill * 1.3; // hidden tell (incl. human imposter)
    s += rng() * (chaos ? 2.5 : 0.8); // noise / personality spread
    scores[p.id] = s;
  }
  return scores;
}

/**
 * Compute every AI player's ballot from the clue-based suspicion scores. Each
 * AI casts `quota` distinct votes (one per imposter), favouring the most
 * suspicious players; personality jitter — amplified in Chaos — swaps some picks
 * for rogue ones. An AI never votes for itself. Returns a flat voter→target list.
 */
export function computeAIVotes(
  round: SoloRound,
  players: SoloPlayer[],
  difficulty: Difficulty,
  suspicion: Record<string, number> = {},
  quota = 1,
  rng: () => number = Math.random,
): SoloVote[] {
  const scores = suspicionScores(round, players, difficulty, suspicion, rng);
  const chaos = difficulty === "chaos";
  const out: SoloVote[] = [];

  for (const voter of players.filter((p) => p.isAI)) {
    const pdef = getPersonality(voter.personality ?? "random");
    const jitter = Math.min(0.95, pdef.voteJitter + (chaos ? 0.25 : 0));
    const others = players.filter((p) => p.id !== voter.id);
    const k = Math.min(quota, others.length);

    // Start from the k most-suspicious others, then jitter-swap some picks.
    const ranked = [...others].sort((a, b) => scores[b.id] - scores[a.id]);
    const chosen = new Set(ranked.slice(0, k).map((p) => p.id));
    for (const id of [...chosen]) {
      if (rng() < jitter) {
        const cand = pick(others, rng).id;
        if (!chosen.has(cand)) {
          chosen.delete(id);
          chosen.add(cand);
        }
      }
    }
    for (const targetId of chosen) out.push({ voterId: voter.id, targetId });
  }
  return out;
}
