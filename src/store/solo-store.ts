"use client";

// ============================================================================
// Zustand store driving Solo Mode. Everything — roles, the clue round, votes —
// lives here in memory on the single device.
//
// The clue phase plays like word-association: the table goes around seat by
// seat and each player gives ONE clue word tied to their secret. AIs generate
// clues locally (see clues.ts); the human types a word on their turn. When the
// configured number of rounds is done, voting opens and AIs vote based on how
// suspicious each player's clues looked (whiffs), gated by difficulty.
// ============================================================================

import { create } from "zustand";
import { playSound } from "@/lib/sounds";
import { getPersonality } from "@/lib/solo/personalities";
import { generateClue } from "@/lib/solo/clues";
import { generateReaction, generateVoteReason, generateResultComment } from "@/lib/solo/reactions";
import { computeAIVotes, generateAIPlayers } from "@/lib/solo/ai";
import { buildRound, resolveRound } from "@/lib/solo/engine";
import { recordGame, type SoloStats } from "@/lib/solo/stats";
import { makeId } from "@/lib/passplay/storage";
import { shuffle } from "@/lib/game/engine";
import type {
  Clue,
  FeedItem,
  SoloPhase,
  SoloPlayer,
  SoloResult,
  SoloRound,
  SoloSettings,
  SoloVote,
} from "@/lib/solo/types";

// ---- timer registry (module scope; timers only ever run client-side) -------
let timers: ReturnType<typeof setTimeout>[] = [];
function later(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}
function clearTimers() {
  for (const id of timers) clearTimeout(id);
  timers = [];
}
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface SoloState {
  phase: SoloPhase;
  players: SoloPlayer[];
  humanId: string;
  settings: SoloSettings;
  round: SoloRound | null;
  roundNumber: number;

  // clue phase
  clues: Clue[];
  /** Chronological discussion feed: clue announcements + AI reactions. */
  feed: FeedItem[];
  /** Lowercased words already said, to reduce duplicate clues. */
  usedWords: string[];
  /** Index into the seat order for whose turn it is (across all rounds). */
  turnIndex: number;
  totalClueRounds: number;
  /** True while it's the human's turn to type a clue. */
  awaitingHuman: boolean;
  /** AI ids currently showing a "thinking / typing" indicator. */
  typingIds: string[];
  /** Hidden per-player suspicion accrued from clue whiffs (drives AI votes). */
  suspicion: Record<string, number>;

  // voting — each player casts a ballot of `voteQuota` (= imposter count) votes
  voteQuota: number;
  /** Each AI's full ballot; revealed one at a time for drama. */
  aiBallots: Ballot[];
  revealedBallots: number;
  /** The human's ballot (targets they voted out). */
  humanVotes: string[];

  result: SoloResult | null;
  stats: SoloStats | null;
  recentWords: string[];

  // ---- actions ----
  startGame: (human: SoloPlayer, settings: SoloSettings) => void;
  beginClues: () => void;
  submitHumanClue: (word: string) => void;
  /** Post a free-form message from the human into the discussion feed. */
  sendHumanMessage: (text: string) => void;
  startVoting: () => void;
  submitHumanBallot: (targetIds: string[]) => void;
  playAgain: () => void;
  editSetup: () => void;
  reset: () => void;
}

interface Ballot {
  voterId: string;
  targetIds: string[];
}

const DEFAULT_SETTINGS: SoloSettings = {
  totalPlayers: 6,
  imposterCount: 1,
  clueRounds: 2,
  difficulty: "medium",
};

export const useSoloStore = create<SoloState>((set, get) => {
  // -- clue phase (turn by turn, around the table) --------------------------

  function processTurn() {
    const st = get();
    if (st.phase !== "discussion" || !st.round) return;

    const totalTurns = st.players.length * st.totalClueRounds;
    if (st.turnIndex >= totalTurns) {
      goToVoting();
      return;
    }

    const player = st.players[st.turnIndex % st.players.length];

    // The human types their own clue — pause and wait for submitHumanClue.
    if (!player.isAI) {
      set({ awaitingHuman: true, typingIds: [] });
      return;
    }

    // Slower, deliberate pacing: a settle beat before they even start thinking.
    const readGap = rand(1400, 2600);
    later(() => {
      const s1 = get();
      if (s1.phase !== "discussion" || !s1.round) return;

      set({ typingIds: [player.id] });
      const pdef = getPersonality(player.personality ?? "random");
      const think = rand(pdef.speed[0], pdef.speed[1]); // full "thinking" time

      later(() => {
        const s2 = get();
        if (s2.phase !== "discussion" || !s2.round) {
          set({ typingIds: [] });
          return;
        }
        const isImposter = s2.round.roles[player.id] === "imposter";
        const round = Math.floor(s2.turnIndex / s2.players.length) + 1;
        const { word, whiff } = generateClue({
          isImposter,
          category: s2.round.category,
          difficulty: s2.settings.difficulty,
          used: s2.usedWords,
        });
        playSound("click");
        const suspicion = whiff
          ? { ...s2.suspicion, [player.id]: (s2.suspicion[player.id] ?? 0) + 1 }
          : s2.suspicion;
        set({
          clues: [...s2.clues, { playerId: player.id, word, round }],
          feed: [...s2.feed, { id: makeId(), playerId: player.id, kind: "clue", text: word }],
          usedWords: [...s2.usedWords, word.toLowerCase()],
          typingIds: [],
          turnIndex: s2.turnIndex + 1,
          suspicion,
        });
        // Let a couple of players chat about that clue before the next turn.
        scheduleReactions(player.id, word, processTurn);
      }, think);
    }, readGap);
  }

  /**
   * Schedule 0–2 AIs to briefly react to the clue that was just given, one at a
   * time (with typing delays), then call `done` to move to the next turn.
   */
  function scheduleReactions(giverId: string, word: string, done: () => void) {
    const st = get();
    if (st.phase !== "discussion") return;
    const ais = st.players.filter((p) => p.isAI && p.id !== giverId);
    const giverName = st.players.find((p) => p.id === giverId)?.name ?? "they";
    const maxR = st.players.length > 8 ? 1 : 2;
    const r = Math.random();
    const count = maxR >= 2 ? (r < 0.25 ? 0 : r < 0.75 ? 1 : 2) : r < 0.4 ? 0 : 1;
    const reactors = shuffle(ais).slice(0, Math.min(count, ais.length));

    let i = 0;
    const step = () => {
      const s = get();
      if (s.phase !== "discussion") return;
      if (i >= reactors.length) {
        done();
        return;
      }
      const reactor = reactors[i++];
      later(() => {
        const s1 = get();
        if (s1.phase !== "discussion") return;
        set({ typingIds: [reactor.id] });
        const pdef = getPersonality(reactor.personality ?? "random");
        const think = rand(pdef.speed[0] * 0.6, pdef.speed[1] * 0.8);
        later(() => {
          const s2 = get();
          if (s2.phase !== "discussion") {
            set({ typingIds: [] });
            return;
          }
          const text = generateReaction({ reactor, giverName, word });
          playSound("click");
          set({
            feed: [...s2.feed, { id: makeId(), playerId: reactor.id, kind: "reaction", text }],
            typingIds: [],
          });
          step();
        }, think);
      }, rand(1100, 2200));
    };
    step();
  }

  // -- voting ---------------------------------------------------------------

  /** Freshly compute the AI ballots (one distinct vote per imposter, each). */
  function freshAIBallots(quota: number): Ballot[] {
    const st = get();
    if (!st.round) return [];
    const flat = computeAIVotes(st.round, st.players, st.settings.difficulty, st.suspicion, quota);
    const byVoter = new Map<string, string[]>();
    for (const v of flat) byVoter.set(v.voterId, [...(byVoter.get(v.voterId) ?? []), v.targetId]);
    return shuffle([...byVoter.entries()].map(([voterId, targetIds]) => ({ voterId, targetIds })));
  }

  function goToVoting() {
    clearTimers();
    const st = get();
    if (!st.round) return;
    const quota = st.round.imposterIds.length; // one vote per imposter

    set({
      phase: "voting",
      typingIds: [],
      awaitingHuman: false,
      voteQuota: quota,
      aiBallots: freshAIBallots(quota),
      revealedBallots: 0,
      humanVotes: [],
    });
    scheduleVoteReveal();
  }

  function maybeResolve() {
    const st = get();
    if (st.phase !== "voting") return;
    if (st.humanVotes.length < st.voteQuota) return;
    if (st.revealedBallots < st.aiBallots.length) return;
    resolve();
  }

  /** Post a short "why I voted for X" message from this AI ballot into the feed. */
  function postVoteReason(ballot: Ballot) {
    const st = get();
    const voter = st.players.find((p) => p.id === ballot.voterId);
    const target = st.players.find((p) => p.id === ballot.targetIds[0]);
    if (!voter || !target) return;
    const targetWord = [...st.clues].reverse().find((c) => c.playerId === target.id)?.word;
    const text = generateVoteReason({ reactor: voter, targetName: target.name, targetWord });
    set({ feed: [...st.feed, { id: makeId(), playerId: voter.id, kind: "reaction", text }] });
  }

  function scheduleVoteReveal() {
    const st = get();
    if (st.phase !== "voting") return;
    if (st.revealedBallots >= st.aiBallots.length) {
      maybeResolve();
      return;
    }
    later(() => {
      const s = get();
      if (s.phase !== "voting") return;
      if (s.revealedBallots >= s.aiBallots.length) {
        maybeResolve();
        return;
      }
      const ballot = s.aiBallots[s.revealedBallots];
      playSound("vote");
      set({ revealedBallots: s.revealedBallots + 1 });
      // A handful of AIs explain their vote (scaled so big tables aren't spammy).
      const aiCount = Math.max(1, s.players.filter((p) => p.isAI).length);
      if (ballot && Math.random() < Math.min(0.65, 5 / aiCount)) postVoteReason(ballot);
      scheduleVoteReveal();
      maybeResolve();
    }, rand(750, 1700));
  }

  /** After the reveal, a few AIs chat about how the round went. */
  function scheduleResultChat() {
    const st = get();
    if (st.phase !== "result" || !st.result) return;
    const playersWon = st.result.winningSide === "players";
    const imposterNames = st.result.imposters.map((i) => i.name);
    const speakers = shuffle(st.players.filter((p) => p.isAI)).slice(0, Math.random() < 0.5 ? 3 : 4);

    let i = 0;
    const step = () => {
      const s = get();
      if (s.phase !== "result") return;
      if (i >= speakers.length) return;
      const sp = speakers[i++];
      later(() => {
        const s1 = get();
        if (s1.phase !== "result") return;
        set({ typingIds: [sp.id] });
        later(() => {
          const s2 = get();
          if (s2.phase !== "result") {
            set({ typingIds: [] });
            return;
          }
          const text = generateResultComment({ speaker: sp, playersWon, imposterNames });
          set({
            feed: [...s2.feed, { id: makeId(), playerId: sp.id, kind: "reaction", text }],
            typingIds: [],
          });
          step();
        }, rand(700, 1500));
      }, rand(900, 2000));
    };
    step();
  }

  function resolve() {
    const st = get();
    if (!st.round || st.humanVotes.length < st.voteQuota) return;
    const votes: SoloVote[] = [
      ...st.aiBallots.flatMap((b) => b.targetIds.map((t) => ({ voterId: b.voterId, targetId: t }))),
      ...st.humanVotes.map((t) => ({ voterId: st.humanId, targetId: t })),
    ];
    const result = resolveRound(st.round, st.players, votes);

    const wasImposter = st.round.roles[st.humanId] === "imposter";
    const humanEntry = result.imposters.find((i) => i.id === st.humanId);
    const won = result.winners.includes(st.humanId);
    const escaped = wasImposter && !!humanEntry && !humanEntry.caught;
    const imposterSet = new Set(st.round.imposterIds);
    const caughtImposters = st.humanVotes.filter((t) => imposterSet.has(t)).length;

    const stats = recordGame({
      won,
      wasImposter,
      escaped,
      caughtImposters,
      difficulty: st.settings.difficulty,
    });

    clearTimers();
    set({ phase: "result", result, stats });
    scheduleResultChat();
  }

  function deal(players: SoloPlayer[], settings: SoloSettings, exclude: string[]): SoloRound {
    return buildRound(players, settings.imposterCount, exclude);
  }

  /** Common reset of clue/vote state when (re)dealing a round. */
  const freshRoundState = {
    clues: [] as Clue[],
    feed: [] as FeedItem[],
    usedWords: [] as string[],
    turnIndex: 0,
    awaitingHuman: false,
    typingIds: [] as string[],
    suspicion: {} as Record<string, number>,
    voteQuota: 1,
    aiBallots: [] as Ballot[],
    revealedBallots: 0,
    humanVotes: [] as string[],
    result: null as SoloResult | null,
  };

  return {
    phase: "setup",
    players: [],
    humanId: "",
    settings: DEFAULT_SETTINGS,
    round: null,
    roundNumber: 0,
    clues: [],
    feed: [],
    usedWords: [],
    turnIndex: 0,
    totalClueRounds: DEFAULT_SETTINGS.clueRounds,
    awaitingHuman: false,
    typingIds: [],
    suspicion: {},
    voteQuota: 1,
    aiBallots: [],
    revealedBallots: 0,
    humanVotes: [],
    result: null,
    stats: null,
    recentWords: [],

    startGame: (human, settings) => {
      clearTimers();
      const ai = generateAIPlayers(settings.totalPlayers - 1, [human.avatar]);
      // Seat everyone in a shuffled order so the human isn't always first.
      const players = shuffle([human, ...ai]);
      const round = deal(players, settings, []);
      set({
        ...freshRoundState,
        players,
        humanId: human.id,
        settings,
        round,
        roundNumber: 1,
        phase: "role",
        totalClueRounds: settings.clueRounds,
        recentWords: [round.word],
      });
    },

    beginClues: () => {
      clearTimers();
      const { settings } = get();
      set({ ...freshRoundState, phase: "discussion", totalClueRounds: settings.clueRounds });
      processTurn();
    },

    submitHumanClue: (word) => {
      const st = get();
      if (st.phase !== "discussion" || !st.awaitingHuman || !st.round) return;
      const w = word.trim().split(/\s+/)[0]?.slice(0, 20);
      if (!w) return;
      const round = Math.floor(st.turnIndex / st.players.length) + 1;
      playSound("click");
      set({
        clues: [...st.clues, { playerId: st.humanId, word: w, round }],
        feed: [...st.feed, { id: makeId(), playerId: st.humanId, kind: "clue", text: w }],
        usedWords: [...st.usedWords, w.toLowerCase()],
        awaitingHuman: false,
        turnIndex: st.turnIndex + 1,
      });
      // The table reacts to your clue before the next player is asked.
      scheduleReactions(st.humanId, w, processTurn);
    },

    sendHumanMessage: (text) => {
      const st = get();
      // Chat stays open through discussion, voting and the reveal.
      if (st.phase !== "discussion" && st.phase !== "voting" && st.phase !== "result") return;
      const t = text.trim().slice(0, 160);
      if (!t) return;
      set({
        feed: [...st.feed, { id: makeId(), playerId: st.humanId, kind: "reaction", text: t }],
      });
    },

    startVoting: () => goToVoting(),

    submitHumanBallot: (targetIds) => {
      const st = get();
      if (st.phase !== "voting" || st.humanVotes.length > 0) return;
      // Distinct, non-self targets; must fill the whole ballot.
      const ballot = [...new Set(targetIds)].filter((id) => id !== st.humanId);
      if (ballot.length !== st.voteQuota) return;
      playSound("vote");
      set({ humanVotes: ballot });
      maybeResolve();
    },

    playAgain: () => {
      clearTimers();
      const { players, settings, recentWords, roundNumber } = get();
      const round = deal(players, settings, recentWords);
      set({
        ...freshRoundState,
        round,
        roundNumber: roundNumber + 1,
        phase: "role",
        totalClueRounds: settings.clueRounds,
        recentWords: [round.word, ...recentWords].slice(0, 40),
      });
    },

    editSetup: () => {
      clearTimers();
      set({ ...freshRoundState, phase: "setup", round: null });
    },

    reset: () => {
      clearTimers();
      set({
        ...freshRoundState,
        phase: "setup",
        players: [],
        humanId: "",
        settings: DEFAULT_SETTINGS,
        round: null,
        roundNumber: 0,
        totalClueRounds: DEFAULT_SETTINGS.clueRounds,
        stats: null,
        recentWords: [],
      });
    },
  };
});

// ---- selectors -------------------------------------------------------------

/** The human player, or null before a game starts. */
export function humanPlayer(state: SoloState): SoloPlayer | null {
  return state.players.find((p) => p.id === state.humanId) ?? null;
}
