"use client";

// ============================================================================
// Zustand store driving the offline Pass & Play state machine. Everything —
// roles, the current viewer, votes — lives here in memory on the single device.
// ============================================================================

import { create } from "zustand";
import { buildRound, resolveRound } from "@/lib/passplay/engine";
import { saveRoster } from "@/lib/passplay/storage";
import type {
  PassPhase,
  PassPlayer,
  PassResult,
  PassRound,
  PassSettings,
} from "@/lib/passplay/types";

interface PassPlayState {
  phase: PassPhase;
  players: PassPlayer[];
  settings: PassSettings;
  round: PassRound | null;
  roundNumber: number;
  /** Index into round.viewOrder for the player currently peeking. */
  viewIndex: number;
  /** Has the current viewer swiped to reveal their role? */
  revealed: boolean;
  /** Epoch ms the discussion timer ends (null outside discussion). */
  discussionEndsAt: number | null;
  /** playerIds the group has accused this round. */
  accusedIds: string[];
  result: PassResult | null;
  /** Recently-used words, to avoid repeats across rounds on this device. */
  recentWords: string[];

  // ---- actions ----
  /** Begin a brand-new game from setup: deal round 1 and start the reveal. */
  startGame: (players: PassPlayer[], settings: PassSettings) => void;
  /** Current viewer swiped up — show their secret role. */
  revealCurrent: () => void;
  /** Viewer memorised their role — re-lock and advance to the next player. */
  nextViewer: () => void;
  /** Everyone has seen their role — start the discussion timer. */
  startDiscussion: () => void;
  /** Move from discussion to voting (timer expired or "vote early"). */
  startVoting: () => void;
  /** Group accuses a player. Auto-resolves once enough suspects are named. */
  accuse: (playerId: string) => void;
  /** Deal a fresh round for the SAME table and restart the reveal. */
  playAgainSameTable: () => void;
  /** Return to setup keeping the current roster so it can be edited. */
  editPlayers: () => void;
  /** Full reset back to an empty setup. */
  reset: () => void;
}

const DEFAULT_SETTINGS: PassSettings = { imposterCount: 1, durationSeconds: 120 };

/** How many imposters the round actually has (drives # of accusations). */
function imposterTarget(round: PassRound | null): number {
  return round ? round.imposterIds.length : 1;
}

export const usePassPlayStore = create<PassPlayState>((set, get) => ({
  phase: "setup",
  players: [],
  settings: DEFAULT_SETTINGS,
  round: null,
  roundNumber: 0,
  viewIndex: 0,
  revealed: false,
  discussionEndsAt: null,
  accusedIds: [],
  result: null,
  recentWords: [],

  startGame: (players, settings) => {
    saveRoster(players);
    const round = buildRound(players, settings.imposterCount);
    set({
      players,
      settings,
      round,
      roundNumber: 1,
      phase: "reveal",
      viewIndex: 0,
      revealed: false,
      discussionEndsAt: null,
      accusedIds: [],
      result: null,
      recentWords: [round.word],
    });
  },

  revealCurrent: () => set({ revealed: true }),

  nextViewer: () => {
    const { viewIndex, round } = get();
    if (!round) return;
    const isLast = viewIndex >= round.viewOrder.length - 1;
    if (isLast) {
      set({ phase: "ready", revealed: false });
    } else {
      set({ viewIndex: viewIndex + 1, revealed: false });
    }
  },

  startDiscussion: () => {
    const { settings } = get();
    set({ phase: "discussion", discussionEndsAt: Date.now() + settings.durationSeconds * 1000 });
  },

  startVoting: () => set({ phase: "voting", discussionEndsAt: null, accusedIds: [] }),

  accuse: (playerId) => {
    const { accusedIds, round, players } = get();
    if (!round || accusedIds.includes(playerId)) return;
    const next = [...accusedIds, playerId];
    if (next.length >= imposterTarget(round)) {
      const result = resolveRound(round, players, next);
      set({ accusedIds: next, result, phase: "result" });
    } else {
      set({ accusedIds: next });
    }
  },

  playAgainSameTable: () => {
    const { players, settings, recentWords, roundNumber } = get();
    const round = buildRound(players, settings.imposterCount, recentWords);
    set({
      round,
      roundNumber: roundNumber + 1,
      phase: "reveal",
      viewIndex: 0,
      revealed: false,
      discussionEndsAt: null,
      accusedIds: [],
      result: null,
      recentWords: [round.word, ...recentWords].slice(0, 30),
    });
  },

  editPlayers: () =>
    set({
      phase: "setup",
      round: null,
      revealed: false,
      accusedIds: [],
      result: null,
      discussionEndsAt: null,
    }),

  reset: () =>
    set({
      phase: "setup",
      players: [],
      settings: DEFAULT_SETTINGS,
      round: null,
      roundNumber: 0,
      viewIndex: 0,
      revealed: false,
      discussionEndsAt: null,
      accusedIds: [],
      result: null,
      recentWords: [],
    }),
}));

/** The player whose turn it is to peek, or null. */
export function currentViewer(state: PassPlayState): PassPlayer | null {
  const { round, viewIndex, players } = state;
  if (!round) return null;
  const id = round.viewOrder[viewIndex];
  return players.find((p) => p.id === id) ?? null;
}
