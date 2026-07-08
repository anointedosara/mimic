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

  // --- Voice (WebRTC signaling) --------------------------------------------
  /** Join the room's voice mesh; ack returns the peers already in it. */
  "voice:join": (payload: { code: string }, ack: (res: VoiceJoinAck) => void) => void;
  /** Leave the voice mesh (mic off / tab closed). */
  "voice:leave": (payload: { code: string }) => void;
  /** Relay an SDP offer/answer or ICE candidate to a specific peer socket. */
  "voice:signal": (payload: { code: string; to: string; data: VoiceSignal }) => void;
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

  // --- Voice (WebRTC signaling) --------------------------------------------
  /** A new peer joined the voice mesh — existing peers initiate an offer to it. */
  "voice:peer-joined": (peer: VoicePeer) => void;
  /** A peer left the voice mesh (or disconnected) — tear down its connection. */
  "voice:peer-left": (payload: { socketId: string }) => void;
  /** Relayed SDP offer/answer or ICE candidate from `from`. */
  "voice:signal": (payload: { from: string; data: VoiceSignal }) => void;
}

export interface AckResult {
  ok: boolean;
  error?: string;
}

// --- Voice signaling payloads ------------------------------------------------
/** Identity of a peer in the voice mesh, keyed by its live socket id. */
export interface VoicePeer {
  socketId: string;
  userId: string;
  displayName: string;
  avatar: string;
}

export interface VoiceJoinAck {
  ok: boolean;
  error?: string;
  /** Peers already in the mesh when we joined (they will offer to us). */
  peers?: VoicePeer[];
  /** Our own socket id, so the client can reason about mesh membership. */
  selfSocketId?: string;
}

/**
 * Opaque-ish signaling envelope relayed verbatim by the server. `sdp` /
 * `candidate` are typed loosely so the shared contract stays free of DOM libs;
 * the client casts to the concrete RTC* types.
 */
export type VoiceSignal =
  | { kind: "offer"; sdp: unknown }
  | { kind: "answer"; sdp: unknown }
  | { kind: "ice"; candidate: unknown };

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
