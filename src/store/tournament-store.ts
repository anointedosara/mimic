"use client";

// ============================================================================
// Zustand store driving Survival Tournament. Everything — the permanent imposter
// set, each round's word, clues, votes and the elimination history — lives here
// in memory on this device.
//
// Flow: role (round intro + secret) → discussion (clue phase, active seats only)
// → voting (everyone active casts ONE vote) → elimination (cinematic reveal +
// end check) → next round's role, or gameover. Eliminated seats become
// spectators: they no longer clue or vote but can still watch and chat.
//
// AI behaviour (clues, reactions, votes) is reused wholesale from Solo Mode.
// ============================================================================

import { create } from "zustand";
import { playSound } from "@/lib/sounds";
import { getPersonality } from "@/lib/solo/personalities";
import { generateClue } from "@/lib/solo/clues";
import { generateReaction, generateVoteReason } from "@/lib/solo/reactions";
import { computeAIVotes, generateAIPlayers } from "@/lib/solo/ai";
import { shuffle } from "@/lib/game/engine";
import { makeId } from "@/lib/passplay/storage";
import {
  assignInitialImposters,
  dealRound,
  evaluateEnd,
  tallyElimination,
} from "@/lib/tournament/engine";
import {
  recordTournament,
  type TournamentStats,
} from "@/lib/tournament/stats";
import type { Clue, FeedItem } from "@/lib/solo/types";
import type {
  EliminationRecord,
  RoundHistory,
  TournamentPhase,
  TournamentPlayer,
  TournamentRound,
  TournamentSettings,
  TournamentStatus,
  TournamentVote,
} from "@/lib/tournament/types";

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

interface Ballot {
  voterId: string;
  targetId: string;
}

/** Running per-tournament tallies the human is scored on (leaderboard). */
interface HumanTally {
  roundsSurvived: number;
  votesCast: number;
  correctVotes: number;
  impostersCaught: number;
  escapes: number;
}

const DEFAULT_SETTINGS: TournamentSettings = {
  totalPlayers: 6,
  imposterCount: 1,
  clueRounds: 2,
  difficulty: "medium",
};

const EMPTY_TALLY: HumanTally = {
  roundsSurvived: 0,
  votesCast: 0,
  correctVotes: 0,
  impostersCaught: 0,
  escapes: 0,
};

interface TournamentState {
  phase: TournamentPhase;
  players: TournamentPlayer[];
  humanId: string;
  settings: TournamentSettings;
  /** The permanent imposter set (chosen once at the start). */
  imposterIds: string[];
  /** Eliminated seat ids, in elimination order (they become spectators). */
  eliminatedIds: string[];
  round: TournamentRound | null;
  roundNumber: number;
  recentWords: string[];

  // clue / discussion phase (mirrors Solo)
  clues: Clue[];
  feed: FeedItem[];
  usedWords: string[];
  turnIndex: number;
  totalClueRounds: number;
  awaitingHuman: boolean;
  typingIds: string[];
  suspicion: Record<string, number>;

  // voting — one elimination vote per active player
  aiBallots: Ballot[];
  revealedBallots: number;
  humanVote: string | null;

  // results
  lastElimination: EliminationRecord | null;
  history: RoundHistory[];
  outcome: TournamentStatus | null;
  humanTally: HumanTally;
  leaderboard: TournamentStats | null;

  // ---- actions ----
  startTournament: (human: TournamentPlayer, settings: TournamentSettings) => void;
  beginDiscussion: () => void;
  submitHumanClue: (word: string) => void;
  sendHumanMessage: (text: string) => void;
  startVoting: () => void;
  submitHumanVote: (targetId: string) => void;
  nextRound: () => void;
  finishTournament: () => void;
  editSetup: () => void;
  reset: () => void;
}

export const useTournamentStore = create<TournamentState>((set, get) => {
  // -- helpers --------------------------------------------------------------

  /** Players still in the game (not eliminated), in seat order. */
  function activePlayers(st: TournamentState): TournamentPlayer[] {
    const out = new Set(st.eliminatedIds);
    return st.players.filter((p) => !out.has(p.id));
  }

  function humanIsActive(st: TournamentState): boolean {
    return !st.eliminatedIds.includes(st.humanId);
  }

  // -- clue phase (turn by turn, around the active table) -------------------

  function processTurn() {
    const st = get();
    if (st.phase !== "discussion" || !st.round) return;
    const active = activePlayers(st);
    const totalTurns = active.length * st.totalClueRounds;

    if (st.turnIndex >= totalTurns) {
      goToVoting();
      return;
    }

    const player = active[st.turnIndex % active.length];

    // The human types their own clue — pause and wait for submitHumanClue.
    if (!player.isAI) {
      set({ awaitingHuman: true, typingIds: [] });
      return;
    }

    const readGap = rand(1400, 2600);
    later(() => {
      const s1 = get();
      if (s1.phase !== "discussion" || !s1.round) return;
      set({ typingIds: [player.id] });
      const pdef = getPersonality(player.personality ?? "random");
      const think = rand(pdef.speed[0], pdef.speed[1]);

      later(() => {
        const s2 = get();
        if (s2.phase !== "discussion" || !s2.round) {
          set({ typingIds: [] });
          return;
        }
        const isImposter = s2.round.roles[player.id] === "imposter";
        const active2 = activePlayers(s2);
        const round = Math.floor(s2.turnIndex / active2.length) + 1;
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
        scheduleReactions(player.id, word, processTurn);
      }, think);
    }, readGap);
  }

  /** 0–2 active AIs briefly react to the clue just given, then call `done`. */
  function scheduleReactions(giverId: string, word: string, done: () => void) {
    const st = get();
    if (st.phase !== "discussion") return;
    const active = activePlayers(st);
    const ais = active.filter((p) => p.isAI && p.id !== giverId);
    const giverName = st.players.find((p) => p.id === giverId)?.name ?? "they";
    const maxR = active.length > 8 ? 1 : 2;
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

  /** Every active AI casts ONE elimination vote (most-suspicious other). */
  function freshAIBallots(): Ballot[] {
    const st = get();
    if (!st.round) return [];
    const active = activePlayers(st);
    const flat = computeAIVotes(st.round, active, st.settings.difficulty, st.suspicion, 1);
    // computeAIVotes returns one target per AI at quota 1.
    return shuffle(flat.map((v) => ({ voterId: v.voterId, targetId: v.targetId })));
  }

  function goToVoting() {
    clearTimers();
    const st = get();
    if (!st.round) return;
    set({
      phase: "voting",
      typingIds: [],
      awaitingHuman: false,
      aiBallots: freshAIBallots(),
      revealedBallots: 0,
      humanVote: null,
    });
    scheduleVoteReveal();
  }

  function maybeResolve() {
    const st = get();
    if (st.phase !== "voting") return;
    if (humanIsActive(st) && st.humanVote === null) return;
    if (st.revealedBallots < st.aiBallots.length) return;
    resolve();
  }

  function postVoteReason(ballot: Ballot) {
    const st = get();
    const voter = st.players.find((p) => p.id === ballot.voterId);
    const target = st.players.find((p) => p.id === ballot.targetId);
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
      const aiCount = Math.max(1, activePlayers(s).filter((p) => p.isAI).length);
      if (ballot && Math.random() < Math.min(0.65, 5 / aiCount)) postVoteReason(ballot);
      scheduleVoteReveal();
      maybeResolve();
    }, rand(750, 1700));
  }

  /** Tally the round, eliminate one seat, update history + end status. */
  function resolve() {
    const st = get();
    if (!st.round) return;
    const active = activePlayers(st);

    const votes: TournamentVote[] = [
      ...st.aiBallots.map((b) => ({ voterId: b.voterId, targetId: b.targetId })),
      ...(st.humanVote ? [{ voterId: st.humanId, targetId: st.humanVote }] : []),
    ];

    const { eliminatedId, voteBreakdown } = tallyElimination(votes, active);
    const eliminated = st.players.find((p) => p.id === eliminatedId);
    if (!eliminated) return;

    const imposterSet = new Set(st.imposterIds);
    const eliminatedWasImposter = imposterSet.has(eliminatedId);

    // Recompute who remains active AFTER this elimination.
    const nextEliminated = [...st.eliminatedIds, eliminatedId];
    const remainingActive = st.players.filter((p) => !nextEliminated.includes(p.id));
    const remainingImposters = remainingActive.filter((p) => imposterSet.has(p.id)).length;
    const remainingNormals = remainingActive.length - remainingImposters;
    const status = evaluateEnd(remainingImposters, remainingNormals);

    // --- leaderboard tallies (human perspective) ---------------------------
    const humanWasActive = humanIsActive(st);
    const humanImposter = imposterSet.has(st.humanId);
    const tally: HumanTally = { ...st.humanTally };
    if (humanWasActive && st.humanVote) {
      tally.votesCast += 1;
      if (imposterSet.has(st.humanVote)) tally.correctVotes += 1;
      // The human's own vote caught the eliminated imposter.
      if (eliminatedWasImposter && st.humanVote === eliminatedId) tally.impostersCaught += 1;
    }
    if (humanWasActive && eliminatedId !== st.humanId) {
      tally.roundsSurvived += 1; // survived this round's vote
      if (humanImposter) tally.escapes += 1; // an imposter who dodged the vote
    }

    const record: EliminationRecord = {
      round: st.roundNumber,
      eliminatedId,
      eliminatedName: eliminated.name,
      eliminatedAvatar: eliminated.avatar,
      eliminatedWasImposter,
      eliminatedWasAI: eliminated.isAI,
      voteBreakdown,
      remaining: remainingActive.length,
      status,
    };
    const history: RoundHistory[] = [
      ...st.history,
      {
        round: st.roundNumber,
        eliminatedName: eliminated.name,
        eliminatedAvatar: eliminated.avatar,
        wasImposter: eliminatedWasImposter,
        remaining: remainingActive.length,
      },
    ];

    clearTimers();
    playSound(eliminatedWasImposter ? "reveal" : "lose");
    set({
      phase: "elimination",
      eliminatedIds: nextEliminated,
      lastElimination: record,
      history,
      humanTally: tally,
      outcome: status === "continue" ? null : status,
      typingIds: [],
    });
  }

  /** Per-round reset of clue/vote scratch state. */
  const freshRoundState = {
    clues: [] as Clue[],
    feed: [] as FeedItem[],
    usedWords: [] as string[],
    turnIndex: 0,
    awaitingHuman: false,
    typingIds: [] as string[],
    suspicion: {} as Record<string, number>,
    aiBallots: [] as Ballot[],
    revealedBallots: 0,
    humanVote: null as string | null,
  };

  return {
    phase: "setup",
    players: [],
    humanId: "",
    settings: DEFAULT_SETTINGS,
    imposterIds: [],
    eliminatedIds: [],
    round: null,
    roundNumber: 0,
    recentWords: [],
    clues: [],
    feed: [],
    usedWords: [],
    turnIndex: 0,
    totalClueRounds: DEFAULT_SETTINGS.clueRounds,
    awaitingHuman: false,
    typingIds: [],
    suspicion: {},
    aiBallots: [],
    revealedBallots: 0,
    humanVote: null,
    lastElimination: null,
    history: [],
    outcome: null,
    humanTally: { ...EMPTY_TALLY },
    leaderboard: null,

    startTournament: (human, settings) => {
      clearTimers();
      const ai = generateAIPlayers(settings.totalPlayers - 1, [human.avatar]);
      const players = shuffle([human, ...ai]);
      const imposterIds = assignInitialImposters(players, settings.imposterCount);
      const round = dealRound(players, imposterIds, []);
      set({
        ...freshRoundState,
        players,
        humanId: human.id,
        settings,
        imposterIds,
        eliminatedIds: [],
        round,
        roundNumber: 1,
        recentWords: [round.word],
        phase: "role",
        totalClueRounds: settings.clueRounds,
        history: [],
        outcome: null,
        lastElimination: null,
        humanTally: { ...EMPTY_TALLY },
        leaderboard: null,
      });
    },

    beginDiscussion: () => {
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
      const active = activePlayers(st);
      const round = Math.floor(st.turnIndex / active.length) + 1;
      playSound("click");
      set({
        clues: [...st.clues, { playerId: st.humanId, word: w, round }],
        feed: [...st.feed, { id: makeId(), playerId: st.humanId, kind: "clue", text: w }],
        usedWords: [...st.usedWords, w.toLowerCase()],
        awaitingHuman: false,
        turnIndex: st.turnIndex + 1,
      });
      scheduleReactions(st.humanId, w, processTurn);
    },

    sendHumanMessage: (text) => {
      const st = get();
      // Chat (incl. spectator chat) stays open through the live phases.
      if (!["discussion", "voting", "elimination", "gameover"].includes(st.phase)) return;
      const t = text.trim().slice(0, 160);
      if (!t) return;
      set({
        feed: [...st.feed, { id: makeId(), playerId: st.humanId, kind: "reaction", text: t }],
      });
    },

    startVoting: () => goToVoting(),

    submitHumanVote: (targetId) => {
      const st = get();
      if (st.phase !== "voting" || st.humanVote !== null) return;
      if (targetId === st.humanId) return;
      playSound("vote");
      set({ humanVote: targetId });
      maybeResolve();
    },

    nextRound: () => {
      clearTimers();
      const st = get();
      const active = st.players.filter((p) => !st.eliminatedIds.includes(p.id));
      const round = dealRound(active, st.imposterIds, st.recentWords);
      set({
        ...freshRoundState,
        round,
        roundNumber: st.roundNumber + 1,
        phase: "role",
        totalClueRounds: st.settings.clueRounds,
        recentWords: [round.word, ...st.recentWords].slice(0, 40),
      });
    },

    finishTournament: () => {
      clearTimers();
      const st = get();
      const outcome = st.outcome ?? st.lastElimination?.status ?? "players_win";
      const humanImposter = st.imposterIds.includes(st.humanId);
      const won = outcome === "imposters_win" ? humanImposter : !humanImposter;
      const leaderboard = recordTournament({
        won,
        wasImposter: humanImposter,
        roundsSurvived: st.humanTally.roundsSurvived,
        impostersCaught: st.humanTally.impostersCaught,
        escapes: st.humanTally.escapes,
        votesCast: st.humanTally.votesCast,
        correctVotes: st.humanTally.correctVotes,
      });
      set({ phase: "gameover", outcome, leaderboard });
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
        imposterIds: [],
        eliminatedIds: [],
        round: null,
        roundNumber: 0,
        recentWords: [],
        totalClueRounds: DEFAULT_SETTINGS.clueRounds,
        history: [],
        outcome: null,
        lastElimination: null,
        humanTally: { ...EMPTY_TALLY },
        leaderboard: null,
      });
    },
  };
});

// ---- selectors -------------------------------------------------------------

/** Players still in the game (not eliminated). */
export function selectActivePlayers(state: TournamentState): TournamentPlayer[] {
  const out = new Set(state.eliminatedIds);
  return state.players.filter((p) => !out.has(p.id));
}

/** Is the human still in the game (vs. spectating)? */
export function selectHumanActive(state: TournamentState): boolean {
  return state.humanId !== "" && !state.eliminatedIds.includes(state.humanId);
}
