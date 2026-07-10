// ============================================================================
// MIMIC — Survival Tournament types.
//
// Survival Tournament is a local, single-device mode (like Solo & Pass & Play):
// one human plus AI opponents battle across MANY rounds. Every round the table
// votes ONE player out — the most-voted seat is eliminated and becomes a
// spectator. Imposters are chosen ONCE and stay imposters until caught. The
// tournament ends when the players catch every imposter (players win) or the
// imposters reach parity with the remaining normals (imposters win).
//
// Roles and the whole simulation live in client memory and never touch the
// network. AI clues/reactions/votes are generated locally by the Solo engine
// (src/lib/solo/*), which this mode reuses.
// ============================================================================

import type { PlayerRole } from "@/lib/game/types";
import type { Difficulty, SoloPlayer } from "@/lib/solo/types";

/** A seat at the table — the human or an AI. Same shape the Solo engine uses. */
export type TournamentPlayer = SoloPlayer;

/** Configuration the host picks in setup. */
export interface TournamentSettings {
  /** Total seats at the table (human + AIs). */
  totalPlayers: number;
  /** How many imposters are hidden among the table (persist until caught). */
  imposterCount: number;
  /** Passes around the table per discussion (1–3), like Solo's clue rounds. */
  clueRounds: number;
  difficulty: Difficulty;
}

/** Phases of the tournament flow. */
export type TournamentPhase =
  | "setup" // configure the table
  | "role" // cinematic "Round N" intro + this round's private secret
  | "discussion" // clue phase among active players
  | "voting" // everyone active votes to eliminate ONE player
  | "elimination" // cinematic elimination reveal + progression / countdown
  | "gameover"; // a side has won — winners, history, leaderboard

/** How the tournament stands after an elimination. */
export type TournamentStatus = "continue" | "players_win" | "imposters_win";

/** A dealt round. `imposterIds` here is the subset of imposters still ACTIVE. */
export interface TournamentRound {
  word: string;
  imposterHint: string;
  category: string;
  /** playerId -> role, for active players this round. */
  roles: Record<string, PlayerRole>;
  /** Active imposter ids this round (subset of the permanent set). */
  imposterIds: string[];
}

/** A single cast vote (voter -> target). */
export interface TournamentVote {
  voterId: string;
  targetId: string;
}

/** One entry in a completed round's vote tally, most-voted first. */
export interface VoteTally {
  targetId: string;
  targetName: string;
  votes: number;
}

/** The outcome of a single round's elimination — drives the cinematic reveal. */
export interface EliminationRecord {
  /** The round number this elimination resolved. */
  round: number;
  eliminatedId: string;
  eliminatedName: string;
  eliminatedAvatar: string;
  eliminatedWasImposter: boolean;
  /** Was the eliminated seat an AI? (drives the badge). */
  eliminatedWasAI: boolean;
  voteBreakdown: VoteTally[];
  /** Active players remaining AFTER this elimination. */
  remaining: number;
  status: TournamentStatus;
}

/** A compact row for the progression / history timeline. */
export interface RoundHistory {
  round: number;
  eliminatedName: string;
  eliminatedAvatar: string;
  wasImposter: boolean;
  remaining: number;
}
