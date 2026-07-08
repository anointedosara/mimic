// ============================================================================
// Socket.IO event contract shared by client & server.
// ============================================================================

import type { PrivateRole, RoomSnapshot, RoomSettings } from "./types";

// --- Client -> Server -------------------------------------------------------
export interface ClientToServerEvents {
  "room:join": (payload: { code: string }, ack: (res: AckResult) => void) => void;
  "room:leave": (payload: { code: string }) => void;
  "room:updateSettings": (
    payload: { code: string; settings: Partial<RoomSettings> },
    ack: (res: AckResult) => void,
  ) => void;
  "room:kick": (payload: { code: string; userId: string }, ack: (res: AckResult) => void) => void;
  "game:start": (payload: { code: string }, ack: (res: AckResult) => void) => void;
  "game:voteEarly": (payload: { code: string }, ack: (res: AckResult) => void) => void;
  "game:castVote": (
    payload: { code: string; targetId: string },
    ack: (res: AckResult) => void,
  ) => void;
  "game:reveal": (payload: { code: string }, ack: (res: AckResult) => void) => void;
  "game:playAgain": (payload: { code: string }, ack: (res: AckResult) => void) => void;
  "room:requestSync": (payload: { code: string }) => void;
}

// --- Server -> Client -------------------------------------------------------
export interface ServerToClientEvents {
  /** Full room state — safe for everyone, no secret roles. */
  "room:state": (snapshot: RoomSnapshot) => void;
  /** Private role for THIS socket only. Sent on role & discussion phases. */
  "game:role": (role: PrivateRole) => void;
  /** Lightweight event notices for toasts / sound cues. */
  "room:notice": (notice: RoomNotice) => void;
  /** Server forced this socket out (kicked / room closed). */
  "room:closed": (payload: { reason: string }) => void;
  "error": (payload: { message: string }) => void;
}

export interface AckResult {
  ok: boolean;
  error?: string;
}

export type RoomNotice =
  | { type: "player_joined"; name: string }
  | { type: "player_left"; name: string }
  | { type: "player_kicked"; name: string }
  | { type: "host_changed"; name: string }
  | { type: "game_started" }
  | { type: "phase_voting" }
  | { type: "vote_cast"; voterName: string }
  | { type: "all_voted" }
  | { type: "revealed" }
  | { type: "new_round" };

export const SOCKET_PATH = "/api/socketio";
