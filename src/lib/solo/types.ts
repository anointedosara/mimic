// ============================================================================
// MIMIC — Solo Mode (play against AI) types.
//
// Solo Mode is fully offline and single-device, like Pass & Play: roles and the
// whole simulation live in client memory and never touch the network. The
// difference is that every player except one is an AI with its own personality,
// and the AI "talks" and votes locally via a template + heuristic engine
// (src/lib/solo/chat.ts + ai.ts). No LLM / backend is involved.
// ============================================================================

import type { PlayerRole } from "@/lib/game/types";

/** The eight AI personalities. Each shapes how an AI talks and votes. */
export type Personality =
  | "logical"
  | "quiet"
  | "suspicious"
  | "aggressive"
  | "random"
  | "overconfident"
  | "funny"
  | "defensive";

/** AI intelligence tier — controls mistakes, memory and accusation quality. */
export type Difficulty = "easy" | "medium" | "hard" | "chaos";

/** A seat at the table — either the human or an AI opponent. */
export interface SoloPlayer {
  id: string;
  name: string;
  /** Avatar id from src/lib/avatars.ts */
  avatar: string;
  /** true for computer players (shown with an "AI" badge). */
  isAI: boolean;
  /** Personality for AI players; null for the human. */
  personality: Personality | null;
}

/** Round configuration chosen by the human in setup. */
export interface SoloSettings {
  /** Total seats at the table, 3–20 (human + AIs). */
  totalPlayers: number;
  imposterCount: number;
  /** How many times the table goes around giving clues (1–3). */
  clueRounds: number;
  difficulty: Difficulty;
}

/** Phases of the solo flow. */
export type SoloPhase =
  | "setup" // configure table + pick name/avatar/difficulty
  | "role" // human privately sees their own role
  | "discussion" // clue phase: each player gives a one-word clue, in turn
  | "voting" // everyone votes on the clues; AI votes appear with delays
  | "result"; // imposters revealed, winners + stats shown

/** A dealt round. Roles live only in memory on this device. */
export interface SoloRound {
  word: string;
  imposterHint: string;
  category: string;
  /** playerId -> role. The engine's private source of truth. */
  roles: Record<string, PlayerRole>;
  imposterIds: string[];
}

/** A one-word clue a player gave on their turn. */
export interface Clue {
  playerId: string;
  /** The clue word (knowers hint at the real word; imposters at the hint). */
  word: string;
  /** Which pass around the table this clue was given on (1-based). */
  round: number;
}

/**
 * An entry in the discussion feed. A "clue" announces the word a player played;
 * a "reaction" is an AI briefly commenting on the clue that was just given.
 */
export interface FeedItem {
  id: string;
  playerId: string;
  kind: "clue" | "reaction";
  text: string;
}

/** A single cast vote (voter -> target). */
export interface SoloVote {
  voterId: string;
  targetId: string;
}

/** Outcome of a round, shaped for the reveal screen. */
export interface SoloResult {
  realWord: string;
  imposterHint: string;
  category: string;
  imposters: Array<{
    id: string;
    name: string;
    avatar: string;
    isAI: boolean;
    votesReceived: number;
    /** Did this imposter get enough votes to be caught? */
    caught: boolean;
  }>;
  /** Every target that received at least one vote, most-voted first. */
  voteBreakdown: Array<{ targetId: string; targetName: string; votes: number }>;
  /** All votes cast this round, in reveal order. */
  votes: SoloVote[];
  /** playerIds on the winning side. */
  winners: string[];
  winningSide: "players" | "imposters";
}
