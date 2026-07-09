// ============================================================================
// Short AI reactions to the clue that was just given. These are the little
// "conversations about the last person's clue" that happen before the next
// player is asked to speak. Personality-flavoured; never reveal roles.
//
// Placeholders: {name} = the player who gave the clue, {word} = their clue word.
// ============================================================================

import type { Personality, SoloPlayer } from "./types";

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const APPROVE = [
  "Nice one, {name}.",
  "Ok {name}, that tracks.",
  "“{word}”... yeah, I can see it.",
  "Solid clue, honestly.",
  "That makes sense to me.",
  "Fair enough, {name}.",
];

const DOUBT = [
  "Hmm, “{word}”? Not sure about that.",
  "That feels a bit vague, {name}.",
  "“{word}” could mean anything though.",
  "Eh, {name} might be reaching.",
  "Kinda generic, {name}, ngl.",
  "I'd want more than “{word}”.",
];

const SUSPICIOUS = [
  "“{word}”? That's a little sus, {name}.",
  "Why “{word}” specifically, {name}?",
  "Not convinced by {name} at all.",
  "I'm side-eyeing {name} after that one.",
  "{name}, that clue is doing a lot of work to say nothing.",
];

const JOKE = [
  "“{word}”, bold move 😅",
  "{name} said “{word}” and just vibed.",
  "my guy really said “{word}” 💀",
  "“{word}” is a choice, {name}.",
];

type Stance = "approve" | "doubt" | "suspicious" | "joke";
const BANKS: Record<Stance, string[]> = {
  approve: APPROVE,
  doubt: DOUBT,
  suspicious: SUSPICIOUS,
  joke: JOKE,
};

/** Personality → relative weights over reaction stances. */
const STANCE_WEIGHTS: Record<Personality, Partial<Record<Stance, number>>> = {
  logical: { approve: 3, doubt: 3, suspicious: 1 },
  quiet: { approve: 2, doubt: 2 },
  suspicious: { suspicious: 4, doubt: 3, approve: 1 },
  aggressive: { suspicious: 4, doubt: 2, joke: 1 },
  random: { approve: 1, doubt: 1, suspicious: 1, joke: 1 },
  overconfident: { approve: 2, suspicious: 3, doubt: 1 },
  funny: { joke: 5, approve: 1, doubt: 1 },
  defensive: { approve: 3, doubt: 2 },
};

function chooseStance(personality: Personality, rng: () => number): Stance {
  const weights = STANCE_WEIGHTS[personality];
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [Stance, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [stance, w] of entries) {
    roll -= w;
    if (roll <= 0) return stance;
  }
  return entries[0]?.[0] ?? "approve";
}

/** Generate one reaction line from `reactor` about `giverName`'s clue `word`. */
export function generateReaction(params: {
  reactor: SoloPlayer;
  giverName: string;
  word: string;
  rng?: () => number;
}): string {
  const { reactor, giverName, word, rng = Math.random } = params;
  const stance = chooseStance(reactor.personality ?? "random", rng);
  return pick(BANKS[stance], rng)
    .replaceAll("{name}", giverName)
    .replaceAll("{word}", word);
}

// ---------------------------------------------------------------------------
// Vote reasoning — an AI explaining why it's voting for `targetName` (during
// the voting phase). {word} is the target's own clue (blank → falls back).
// ---------------------------------------------------------------------------
const VOTE_REASONS = [
  "{target}'s clue was too vague for me.",
  "Going with {target} — “{word}” felt off.",
  "{target} didn't sound like they really knew it.",
  "“{word}”? That's a stretch — {target} for me.",
  "{target} gave me nothing solid.",
  "“{word}” just doesn't sit right, {target}.",
  "My gut says {target}.",
  "{target} was reaching with “{word}”.",
];
const VOTE_REASONS_NOWORD = [
  "{target}'s clue was too vague for me.",
  "{target} gave me nothing solid.",
  "My gut says {target}.",
  "{target} barely committed to anything.",
];
const VOTE_REASONS_FUNNY = [
  "{target} said “{word}” and I felt that in my soul. Sus.",
  "not to be dramatic but {target} is 100% guilty 😤",
  "{target}, “{word}”? couldn't be me.",
];

export function generateVoteReason(params: {
  reactor: SoloPlayer;
  targetName: string;
  targetWord?: string;
  rng?: () => number;
}): string {
  const { reactor, targetName, targetWord, rng = Math.random } = params;
  const word = targetWord ?? "that";
  const persona = reactor.personality ?? "random";
  const bank =
    persona === "funny" && rng() < 0.5
      ? VOTE_REASONS_FUNNY
      : targetWord
        ? VOTE_REASONS
        : VOTE_REASONS_NOWORD;
  return pick(bank, rng).replaceAll("{target}", targetName).replaceAll("{word}", word);
}

// ---------------------------------------------------------------------------
// Result discussion — AIs reacting to the reveal. {imp} = an imposter's name.
// ---------------------------------------------------------------------------
const RESULT_WON = [
  "Called it 😎",
  "Good read, team.",
  "The clues gave {imp} away.",
  "Knew {imp} was off.",
  "Clean — we got them.",
  "Solid round, everyone.",
];
const RESULT_LOST = [
  "Wow, totally fooled.",
  "{imp} played that perfectly.",
  "Didn't see {imp} coming at all.",
  "GG, they got us.",
  "We really whiffed that one.",
  "Respect, {imp} — well hidden.",
];

export function generateResultComment(params: {
  speaker: SoloPlayer;
  playersWon: boolean;
  imposterNames: string[];
  rng?: () => number;
}): string {
  const { playersWon, imposterNames, rng = Math.random } = params;
  const bank = playersWon ? RESULT_WON : RESULT_LOST;
  const imp = imposterNames.length ? pick(imposterNames, rng) : "them";
  return pick(bank, rng).replaceAll("{imp}", imp);
}
