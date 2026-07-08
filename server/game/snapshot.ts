// Builds PUBLIC snapshots and PRIVATE role payloads from a Room document.
// The public snapshot NEVER includes role/word/hint/votedFor — this is the
// single choke point that enforces the "hidden imposters" rule.

import type { RoomDoc } from "@/lib/db/models/Room";
import type { PrivateRole, PublicPlayer, PublicVote, RoomSnapshot } from "@/lib/game/types";

export function buildPublicPlayers(room: RoomDoc): PublicPlayer[] {
  return room.players.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    avatar: p.avatar,
    isHost: p.isHost,
    connected: p.connected,
    hasVoted: p.hasVoted,
    roundsWon: p.roundsWon,
  }));
}

export function buildPublicVotes(room: RoomDoc): PublicVote[] {
  // Live votes are public (voter -> target). This does NOT reveal roles.
  const votes: PublicVote[] = [];
  for (const p of room.players) {
    if (p.hasVoted && p.votedFor) {
      const target = room.players.find((t) => t.userId === p.votedFor);
      votes.push({
        voterId: p.userId,
        voterName: p.displayName,
        targetId: p.votedFor,
        targetName: target?.displayName ?? "Unknown",
      });
    }
  }
  return votes;
}

/**
 * Public snapshot broadcast to the whole room. Contains no secret role data.
 * `reveal` is attached separately by the manager only during the reveal phase.
 */
export function buildSnapshot(
  room: RoomDoc,
  reveal: RoomSnapshot["reveal"] = null,
): RoomSnapshot {
  const connectedCount = room.players.filter((p) => p.connected).length;
  const votesCast = room.players.filter((p) => p.hasVoted).length;

  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: {
      maxPlayers: room.settings.maxPlayers,
      imposterCount: room.settings.imposterCount,
      durationSeconds: room.settings.durationSeconds,
    },
    players: buildPublicPlayers(room),
    round: room.round,
    timerEndsAt: room.timerEndsAt ? room.timerEndsAt.getTime() : null,
    votes: buildPublicVotes(room),
    votesCast,
    votesTotal: connectedCount,
    category: room.currentCategory,
    reveal,
  };
}

/**
 * The PRIVATE payload for a single player. Sent only to that player's socket.
 * Imposters get only their hint; players get only the word. Neither learns who
 * else is an imposter.
 */
export function buildPrivateRole(room: RoomDoc, userId: string): PrivateRole | null {
  const p = room.players.find((pl) => pl.userId === userId);
  if (!p || !p.role) return null;
  if (p.role === "imposter") {
    return { role: "imposter", hint: p.hint ?? "", category: room.currentCategory ?? "" };
  }
  return { role: "player", word: p.word ?? "", category: room.currentCategory ?? "" };
}
