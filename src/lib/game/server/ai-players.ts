// ============================================================================
// Server-side AI players for online rooms (Hybrid mode + "fill with AI").
//
// AI seats are ordinary RoomPlayer subdocuments with `isAI: true` and a
// synthetic `ai_*` userId (no account). They are always "connected", never
// host, and are skipped when writing lifetime user statistics. Their clues,
// votes and chat reuse the local Solo engine so behaviour matches Solo Mode.
// ============================================================================

import { AVATARS } from "@/lib/avatars";
import { shuffle } from "@/lib/game/engine";
import { AI_NAMES } from "@/lib/solo/names";
import { PERSONALITY_LIST, getPersonality } from "@/lib/solo/personalities";
import { generateClue } from "@/lib/solo/clues";
import { computeAIVotes } from "@/lib/solo/ai";
import type { RoomDoc, RoomPlayer } from "@/lib/db/models/Room";
import type { Personality, SoloPlayer, SoloRound } from "@/lib/solo/types";

let seq = 0;
function aiId(): string {
  return `ai_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** True for any AI-controlled userId (they never map to a real account). */
export function isAIUserId(userId: string): boolean {
  return userId.startsWith("ai_");
}

/**
 * Build `count` fresh AI player subdocuments, avoiding names/avatars already
 * taken in the room. Each gets a distinct personality where the pool allows.
 */
export function buildAIPlayers(room: RoomDoc, count: number): RoomPlayer[] {
  const takenNames = new Set(room.players.map((p) => p.displayName.toLowerCase()));
  const takenAvatars = new Set(room.players.map((p) => p.avatar));
  const names = shuffle(AI_NAMES.filter((n) => !takenNames.has(n.toLowerCase())));
  const avatars = shuffle(AVATARS.map((a) => a.id).filter((id) => !takenAvatars.has(id)));
  const personas = shuffle(PERSONALITY_LIST.map((p) => p.id));

  const out: RoomPlayer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      userId: aiId(),
      displayName: names[i] ?? `Bot ${i + 1}`,
      avatar: avatars[i] ?? AVATARS[i % AVATARS.length].id,
      isHost: false,
      connected: true,
      disconnectedAt: null,
      joinedAt: new Date(),
      roundsWon: 0,
      isAI: true,
      personality: personas[i % personas.length],
      role: null,
      word: null,
      hint: null,
      hasVoted: false,
      votedFor: [],
    } as RoomPlayer);
  }
  return out;
}

/** Map the current round's participants into the Solo engine's shapes. */
function toSoloRound(room: RoomDoc): { round: SoloRound; players: SoloPlayer[] } {
  const participants = room.players.filter((p) => p.role !== null && p.connected);
  const players: SoloPlayer[] = participants.map((p) => ({
    id: p.userId,
    name: p.displayName,
    avatar: p.avatar,
    isAI: p.isAI ?? false,
    personality: (p.personality as Personality | null) ?? null,
  }));
  const roles: Record<string, "player" | "imposter"> = {};
  for (const p of participants) roles[p.userId] = p.role as "player" | "imposter";
  const imposterIds = participants.filter((p) => p.role === "imposter").map((p) => p.userId);
  const round: SoloRound = {
    word: participants.find((p) => p.role === "player")?.word ?? "",
    imposterHint: participants.find((p) => p.role === "imposter")?.hint ?? "",
    category: room.currentCategory ?? "",
    roles,
    imposterIds,
  };
  return { round, players };
}

/**
 * Compute each AI participant's ballot (one target per imposter). Returns a map
 * of aiUserId -> targetIds. Grounded in hidden roles (medium difficulty), so AI
 * converge on real imposters reasonably often without being perfect.
 */
export function computeRoomAIBallots(room: RoomDoc, quota: number): Map<string, string[]> {
  const { round, players } = toSoloRound(room);
  if (players.length === 0) return new Map();
  const flat = computeAIVotes(round, players, "medium", {}, Math.max(1, quota));
  const byVoter = new Map<string, string[]>();
  for (const v of flat) byVoter.set(v.voterId, [...(byVoter.get(v.voterId) ?? []), v.targetId]);
  return byVoter;
}

// --- AI discussion chat ------------------------------------------------------

const OPENERS = [
  "mine's kind of {word} if that helps",
  "I'm getting {word} vibes",
  "ok so... something {word}?",
  "for me it's very {word}",
  "hmm, I'd say {word}",
  "thinking {word} tbh",
  "{word} is what comes to mind",
  "not gonna lie, mine screams {word}",
];

/** One short, clue-flavoured opening line for an AI participant. */
export function aiOpeningLine(params: {
  isImposter: boolean;
  category: string;
  used: string[];
}): { text: string; word: string } {
  const { word } = generateClue({
    isImposter: params.isImposter,
    category: params.category,
    difficulty: "medium",
    used: params.used,
  });
  const tmpl = OPENERS[Math.floor(Math.random() * OPENERS.length)];
  return { text: tmpl.replace("{word}", word), word };
}

// --- ongoing AI discussion banter -------------------------------------------

const AGREE = ["yeah {name}, i'm with you", "same read as {name} tbh", "ok {name}, that tracks", "{name} makes sense to me", "with {name} on this one", "fair point {name}"];
const DOUBT = ["idk about {name} ngl", "{name} feels a bit off to me", "not sure {name} really knows it", "{name}'s being kinda vague", "hmm… {name}?", "{name} isn't convincing me"];
const QUESTION = ["what's everyone leaning?", "anyone actually confident?", "who feels solid about their word?", "so who are we thinking?", "{name}, what makes you say that?", "we got a read on anyone yet?"];
const ACCUSE = ["starting to think {name}'s the mimic", "my money's on {name}", "{name} is sus to me", "keep an eye on {name}", "i don't trust {name} rn", "{name} has been way too quiet"];
const DEFEND = ["i swear i'm not the imposter", "why's everyone looking at me 😅", "it's not me, promise", "don't pin this on me", "i actually know the word, relax"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface AITurn {
  userId: string;
  name: string;
  avatar: string;
  text: string;
}

/**
 * Produce one contextual discussion line from an AI participant: a fresh clue,
 * a reaction to the last speaker, a question, an accusation, or (if recently
 * accused) a defence. Personality tunes who talks and how suspicious they are.
 * Returns null if there are no AI participants to speak.
 */
export function aiDiscussionTurn(room: RoomDoc): AITurn | null {
  const ais = room.players.filter((p) => p.isAI && p.role !== null && p.connected);
  if (ais.length === 0) return null;

  const recent = (room.messages ?? []).filter((m) => m.scope === "table" && m.round === room.round);
  const lastAuthorId = recent[recent.length - 1]?.userId;

  // Weight speakers by chattiness; avoid speaking twice in a row when possible.
  const pool = ais.filter((p) => p.userId !== lastAuthorId);
  const speakers = pool.length ? pool : ais;
  const weighted: RoomPlayer[] = [];
  for (const p of speakers) {
    const w = Math.max(1, Math.round(getPersonality((p.personality as Personality) ?? "random").chattiness * 5));
    for (let i = 0; i < w; i++) weighted.push(p);
  }
  const speaker = pick(weighted);
  const pdef = getPersonality((speaker.personality as Personality) ?? "random");

  // The most recent line from someone else, to react to.
  const lastOther = [...recent].reverse().find((m) => m.userId !== speaker.userId) ?? null;
  const otherName = lastOther?.name;

  // A suspect to accuse — prefer someone who has spoken this round.
  const spokenIds = new Set(recent.map((m) => m.userId));
  const suspects = room.players.filter(
    (p) => p.userId !== speaker.userId && p.role !== null && p.connected,
  );
  const suspect =
    suspects.filter((p) => spokenIds.has(p.userId))[0] ??
    (suspects.length ? pick(suspects) : null);

  // Was the speaker just accused? Then they might defend themselves.
  const accusedMe = recent
    .slice(-3)
    .some((m) => m.userId !== speaker.userId && m.text.toLowerCase().includes(speaker.displayName.toLowerCase()));

  type Kind = "clue" | "agree" | "doubt" | "question" | "accuse" | "defend";
  const weights: [Kind, number][] = [
    ["clue", 3],
    ["question", 2],
    ["agree", otherName ? 2 : 0],
    ["doubt", otherName ? 1 + Math.round(pdef.suspicionBias * 3) : 0],
    ["accuse", suspect ? Math.round(pdef.suspicionBias * 3) : 0],
    ["defend", accusedMe ? 4 : 0],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  let kind: Kind = "clue";
  for (const [k, w] of weights) {
    roll -= w;
    if (roll <= 0) {
      kind = k;
      break;
    }
  }

  let text: string;
  switch (kind) {
    case "agree":
      text = pick(AGREE).replace("{name}", otherName ?? "you");
      break;
    case "doubt":
      text = pick(DOUBT).replace("{name}", otherName ?? "that");
      break;
    case "question":
      text = pick(QUESTION).replace("{name}", otherName ?? "you");
      break;
    case "accuse":
      text = pick(ACCUSE).replace("{name}", suspect?.displayName ?? otherName ?? "someone");
      break;
    case "defend":
      text = pick(DEFEND);
      break;
    default: {
      const { word } = generateClue({
        isImposter: speaker.role === "imposter",
        category: room.currentCategory ?? "",
        difficulty: "medium",
        used: recent.map((m) => m.text.toLowerCase()),
      });
      text = pick(OPENERS).replace("{word}", word);
    }
  }

  return { userId: speaker.userId, name: speaker.displayName, avatar: speaker.avatar, text };
}
