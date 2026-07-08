// ============================================================================
// MIMIC — shared game types (used by both server and client)
// ============================================================================

/** Phases of the game state machine. */
export type GamePhase =
  | "lobby" // waiting for players, host configures settings
  | "role" // brief "here is your secret role" reveal to each player
  | "discussion" // timed discussion, players talk (out of band) & deduce
  | "voting" // players cast votes
  | "reveal" // imposters revealed, stats updated
  | "ended"; // room closed

export type PlayerRole = "player" | "imposter";

export interface RoomSettings {
  /** Max number of players allowed in the room (3–20). */
  maxPlayers: number;
  /** Number of imposters (1 .. floor(maxPlayers/3)). */
  imposterCount: number;
  /** Discussion duration in seconds. */
  durationSeconds: number;
}

/** A connected participant, as broadcast to everyone. Contains NO role data. */
export interface PublicPlayer {
  userId: string;
  displayName: string;
  avatar: string;
  isHost: boolean;
  connected: boolean;
  /** Whether this player has cast a vote in the current round. */
  hasVoted: boolean;
  /** Score across rounds in this room session. */
  roundsWon: number;
}

/**
 * Private per-player payload. The server sends this ONLY to the owning socket.
 * It never contains the identities of other imposters or the full role map.
 */
export type PrivateRole =
  | { role: "player"; word: string; category: string }
  | { role: "imposter"; hint: string; category: string };

/** A single vote, visible to everyone in real time (voter -> target). */
export interface PublicVote {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

/** Reveal payload — only sent AFTER voting completes and host reveals. */
export interface RevealResult {
  realWord: string;
  imposterHint: string;
  category: string;
  imposters: Array<{
    userId: string;
    displayName: string;
    avatar: string;
    caught: boolean; // received a plurality/enough votes
    votesReceived: number;
  }>;
  voteBreakdown: Array<{
    targetId: string;
    targetName: string;
    votes: number;
  }>;
  /** userIds of the winning side. */
  winners: string[];
  /** "imposters" | "players" — which side won overall. */
  winningSide: "imposters" | "players";
}

/** The full room snapshot broadcast to clients. Contains NO secret role data. */
export interface RoomSnapshot {
  code: string;
  phase: GamePhase;
  hostId: string;
  settings: RoomSettings;
  players: PublicPlayer[];
  round: number;
  /** Epoch ms when the discussion timer will hit zero (null outside discussion). */
  timerEndsAt: number | null;
  /** Live votes so far (voter->target), safe to show everyone. */
  votes: PublicVote[];
  /** Number of players who have voted. */
  votesCast: number;
  /** Total number of connected players expected to vote. */
  votesTotal: number;
  /** Category of the current round's word (safe — same for imposters & players). */
  category: string | null;
  /** Populated only in the reveal phase. */
  reveal: RevealResult | null;
}
