// ============================================================================
// MIMIC — Pass & Play (offline, single-device) types.
// The whole offline game lives on ONE device, so — unlike the online mode —
// roles are held in client memory. Nothing here ever touches the network.
// ============================================================================

import type { PlayerRole } from "@/lib/game/types";

/** A local player at the table. `id` is a stable local id (not a DB user). */
export interface PassPlayer {
  id: string;
  name: string;
  /** Avatar id from src/lib/avatars.ts */
  avatar: string;
}

/** Offline round configuration the host picks in setup. */
export interface PassSettings {
  imposterCount: number;
  durationSeconds: number;
}

/** Phases of the single-device flow. */
export type PassPhase =
  | "setup" // configure players + settings
  | "reveal" // pass-and-peek loop: each player secretly sees their role
  | "ready" // everyone has seen their role — put the phone down
  | "discussion" // timed group discussion
  | "voting" // group accuses suspect(s)
  | "result"; // imposters revealed, winners shown

/** A dealt round. Roles live only in memory on this device. */
export interface PassRound {
  word: string;
  imposterHint: string;
  category: string;
  /** playerId -> role */
  roles: Record<string, PlayerRole>;
  imposterIds: string[];
  /** Randomised order players view their secret role in. */
  viewOrder: string[];
}

/** Outcome of a round, shaped for the reveal screen. */
export interface PassResult {
  realWord: string;
  imposterHint: string;
  category: string;
  imposters: Array<{
    id: string;
    name: string;
    avatar: string;
    /** Was this imposter among the group's accusations? */
    caught: boolean;
  }>;
  /** playerIds the group voted out, in order. */
  accusedIds: string[];
  /** "players" win only if every imposter was accused; else "imposters". */
  winningSide: "players" | "imposters";
}
