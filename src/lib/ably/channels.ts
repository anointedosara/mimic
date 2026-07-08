// ============================================================================
// Ably channel naming — shared by client and server so both agree on where
// messages flow. Mirrors the old Socket.IO room names:
//   room:{CODE}                -> public room state, notices, closed
//   user:{USERID}:{CODE}       -> that player's PRIVATE role (secret)
//   voice:{CODE}               -> WebRTC signaling + voice presence
//
// The private channel is namespaced by USERID FIRST so a token can grant
// `user:{USERID}:*` (a trailing wildcard) — that pattern can never match another
// player's channel, so nobody can subscribe to someone else's secret role.
// ============================================================================

export const roomChannel = (code: string) => `room:${code.toUpperCase()}`;

export const userChannel = (code: string, userId: string) =>
  `user:${userId}:${code.toUpperCase()}`;

export const voiceChannel = (code: string) => `voice:${code.toUpperCase()}`;

/** Ably message names — the analogue of Socket.IO event names. */
export const MSG = {
  roomState: "room:state",
  gameRole: "game:role",
  roomNotice: "room:notice",
  roomClosed: "room:closed",
  voicePeerJoined: "voice:peer-joined",
  voicePeerLeft: "voice:peer-left",
  voiceSignal: "voice:signal",
} as const;
