// ============================================================================
// The eight AI personalities. Each entry bundles display metadata plus the
// behavioural knobs the chat + voting engines read:
//   - chattiness: how often this AI speaks in discussion (0..1)
//   - suspicionBias: how eager it is to accuse others (0..1)
//   - speed: [min,max] ms of "thinking" before a message posts (reaction speed)
//   - voteJitter: extra randomness added to its vote choice (0..1)
// Personalities are exaggerated in Chaos difficulty (see ai.ts).
// ============================================================================

import type { Personality } from "./types";

export interface PersonalityDef {
  id: Personality;
  label: string;
  emoji: string;
  /** One-line description shown in the how-to / setup. */
  blurb: string;
  chattiness: number;
  suspicionBias: number;
  /** [min, max] ms thinking delay before a message appears. */
  speed: [number, number];
  voteJitter: number;
}

export const PERSONALITIES: Record<Personality, PersonalityDef> = {
  logical: {
    id: "logical",
    label: "Logical",
    emoji: "🧠",
    blurb: "Weighs the evidence and reasons things out.",
    chattiness: 0.6,
    suspicionBias: 0.5,
    speed: [1400, 2800],
    voteJitter: 0.1,
  },
  quiet: {
    id: "quiet",
    label: "Quiet",
    emoji: "🤐",
    blurb: "Says little — and that's suspicious in itself.",
    chattiness: 0.25,
    suspicionBias: 0.3,
    speed: [2200, 4200],
    voteJitter: 0.3,
  },
  suspicious: {
    id: "suspicious",
    label: "Suspicious",
    emoji: "🕵️",
    blurb: "Trusts no one and questions everything.",
    chattiness: 0.75,
    suspicionBias: 0.9,
    speed: [1000, 2200],
    voteJitter: 0.2,
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive",
    emoji: "😤",
    blurb: "Comes out swinging with loud accusations.",
    chattiness: 0.85,
    suspicionBias: 0.85,
    speed: [700, 1600],
    voteJitter: 0.25,
  },
  random: {
    id: "random",
    label: "Random",
    emoji: "🎲",
    blurb: "Unpredictable — anything can happen.",
    chattiness: 0.6,
    suspicionBias: 0.5,
    speed: [500, 3500],
    voteJitter: 0.7,
  },
  overconfident: {
    id: "overconfident",
    label: "Overconfident",
    emoji: "😎",
    blurb: "Absolutely certain they've already cracked it.",
    chattiness: 0.8,
    suspicionBias: 0.75,
    speed: [800, 1800],
    voteJitter: 0.15,
  },
  funny: {
    id: "funny",
    label: "Funny",
    emoji: "😹",
    blurb: "Cracks jokes and derails with the best of intentions.",
    chattiness: 0.8,
    suspicionBias: 0.4,
    speed: [900, 2200],
    voteJitter: 0.35,
  },
  defensive: {
    id: "defensive",
    label: "Defensive",
    emoji: "🛡️",
    blurb: "Deflects heat and protests innocence loudly.",
    chattiness: 0.6,
    suspicionBias: 0.45,
    speed: [1200, 2600],
    voteJitter: 0.25,
  },
};

export const PERSONALITY_LIST: PersonalityDef[] = Object.values(PERSONALITIES);

export function getPersonality(id: Personality): PersonalityDef {
  return PERSONALITIES[id];
}
