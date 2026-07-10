// Builds PUBLIC snapshots and PRIVATE role payloads from a Room document.
// The public snapshot NEVER includes role/word/hint/votedFor — this is the
// single choke point that enforces the "hidden imposters" rule.

import type { RoomDoc } from "@/lib/db/models/Room";
import type {
  ChatMessage,
  PrivateRole,
  PublicPlayer,
  PublicVote,
  RoomSnapshot,
} from "@/lib/game/types";
import { clampImposters } from "@/lib/game/config";

export function buildPublicPlayers(room: RoomDoc): PublicPlayer[] {
  // Dedupe by userId as a final safety net: a duplicate entry (e.g. from a
  // concurrent join race) must never reach the client, or React sees two
  // children with the same key and drops/duplicates tiles.
  const seen = new Set<string>();
  const players: PublicPlayer[] = [];
  for (const p of room.players) {
    if (seen.has(p.userId)) continue;
    seen.add(p.userId);
    players.push({
      userId: p.userId,
      displayName: p.displayName,
      avatar: p.avatar,
      isHost: p.isHost,
      connected: p.connected,
      hasVoted: p.hasVoted,
      roundsWon: p.roundsWon,
      isAI: p.isAI ?? false,
    });
  }
  return players;
}

/** Public projection of the room's chat log (oldest first). */
export function buildPublicMessages(room: RoomDoc): ChatMessage[] {
  return (room.messages ?? []).map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.name,
    avatar: m.avatar,
    isAI: m.isAI ?? false,
    text: m.text,
    at: new Date(m.at).getTime(),
    replyTo: m.replyTo ?? null,
    reactions: (m.reactions ?? []).map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] })),
    scope: m.scope,
  }));
}

export function buildPublicVotes(room: RoomDoc): PublicVote[] {
  // Live votes are public (voter -> target). Each voter casts a ballot of one
  // vote per imposter, expanded here into a flat list. This does NOT reveal roles.
  const votes: PublicVote[] = [];
  for (const p of room.players) {
    if (!p.hasVoted) continue;
    for (const targetId of p.votedFor ?? []) {
      const target = room.players.find((t) => t.userId === targetId);
      votes.push({
        voterId: p.userId,
        voterName: p.displayName,
        targetId,
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
  const voteQuota = clampImposters(room.settings.imposterCount, connectedCount);

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
    voteQuota,
    category: room.currentCategory,
    reveal,
    messages: buildPublicMessages(room),
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
