// ============================================================================
// GameManager — server-authoritative game state machine.
//
// Responsibilities:
//  - Load/persist Room documents (MongoDB is the durable source of truth).
//  - Drive the phase machine: lobby -> role -> discussion -> voting -> reveal.
//  - Broadcast PUBLIC snapshots to the room and PRIVATE roles to each player.
//  - Manage discussion timers (survive disconnects; auto-advance at zero).
//  - Validate every action server-side (host-only actions, vote legality, ...).
//  - Update user statistics on reveal.
//
// Secrets (roles/word/hint) never leave this layer except via buildPrivateRole,
// which sends a single player ONLY their own information.
// ============================================================================

import type { Server as IOServer } from "socket.io";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Room, type RoomDoc } from "@/lib/db/models/Room";
import { User } from "@/lib/db/models/User";
import { assignRoles, resolveRound } from "@/lib/game/engine";
import { clampImposters, clampPlayers, clampDuration } from "@/lib/game/config";
import type { RoomSettings } from "@/lib/game/types";
import type { AckResult, RoomNotice } from "@/lib/game/events";
import { buildPrivateRole, buildSnapshot } from "./snapshot";
import { pickWord } from "./words";

const ROLE_PHASE_MS = 5000; // brief personal-role reveal before discussion

type Timer = ReturnType<typeof setTimeout>;

export class GameManager {
  private io: IOServer;
  private timers = new Map<string, Timer>();
  private locks = new Map<string, Promise<unknown>>();
  private recentWords = new Map<string, string[]>();

  constructor(io: IOServer) {
    this.io = io;
  }

  // --- concurrency: serialize mutations per room ---------------------------
  private async withLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(code) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    this.locks.set(
      code,
      prev.then(() => next),
    );
    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (this.locks.get(code) === next) this.locks.delete(code);
    }
  }

  private roomRoom(code: string) {
    return `room:${code}`;
  }
  private userRoom(code: string, userId: string) {
    return `user:${code}:${userId}`;
  }

  private async load(code: string): Promise<RoomDoc | null> {
    await connectToDatabase();
    return Room.findOne({ code: code.toUpperCase() });
  }

  private notice(code: string, notice: RoomNotice) {
    this.io.to(this.roomRoom(code)).emit("room:notice", notice);
  }

  // --- broadcasting --------------------------------------------------------
  private broadcast(room: RoomDoc, reveal: Parameters<typeof buildSnapshot>[1] = null) {
    this.io.to(this.roomRoom(room.code)).emit("room:state", buildSnapshot(room, reveal));
  }

  /** Send each connected player their private role (during role/discussion). */
  private emitRoles(room: RoomDoc) {
    for (const p of room.players) {
      const payload = buildPrivateRole(room, p.userId);
      if (payload) {
        this.io.to(this.userRoom(room.code, p.userId)).emit("game:role", payload);
      }
    }
  }

  /** Send a single player their private role (on reconnect / sync). */
  async emitRoleTo(code: string, userId: string) {
    const room = await this.load(code);
    if (!room) return;
    const payload = buildPrivateRole(room, userId);
    if (payload) this.io.to(this.userRoom(code, userId)).emit("game:role", payload);
  }

  // --- player presence -----------------------------------------------------
  async handleJoin(code: string, user: { id: string; displayName: string; avatar: string }): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };

      let player = room.players.find((p) => p.userId === user.id);
      const isNew = !player;

      if (!player) {
        if (room.phase !== "lobby") {
          return { ok: false, error: "Game already in progress" };
        }
        if (room.players.length >= room.settings.maxPlayers) {
          return { ok: false, error: "Room is full" };
        }
        room.players.push({
          userId: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          isHost: room.players.length === 0,
          connected: true,
          joinedAt: new Date(),
          roundsWon: 0,
          role: null,
          word: null,
          hint: null,
          hasVoted: false,
          votedFor: null,
        });
        player = room.players[room.players.length - 1];
      } else {
        // Reconnect: keep their role/vote intact, refresh identity + presence.
        player.connected = true;
        player.displayName = user.displayName;
        player.avatar = user.avatar;
      }

      // Ensure there is always a host.
      if (!room.players.some((p) => p.isHost)) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].userId;
      }

      await room.save();
      this.broadcast(room);
      if (isNew) this.notice(code, { type: "player_joined", name: user.displayName });

      // Re-send private role if a round is underway.
      if (["role", "discussion", "voting"].includes(room.phase)) {
        await this.emitRoleTo(code, user.id);
      }
      return { ok: true };
    });
  }

  async handleDisconnect(code: string, userId: string) {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return;
      const player = room.players.find((p) => p.userId === userId);
      if (!player) return;
      player.connected = false;

      // In the lobby, remove disconnected players entirely.
      if (room.phase === "lobby") {
        room.players = room.players.filter((p) => p.userId !== userId);
      }

      // Host migration: if the host left, promote the first connected player.
      if (player.isHost) {
        player.isHost = false;
        const successor = room.players.find((p) => p.connected) ?? room.players[0];
        if (successor) {
          successor.isHost = true;
          room.hostId = successor.userId;
          this.notice(code, { type: "host_changed", name: successor.displayName });
        }
      }

      if (room.players.length === 0) {
        await Room.deleteOne({ code: room.code });
        this.clearTimer(code);
        return;
      }

      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "player_left", name: player.displayName });
    });
  }

  async handleKick(code: string, hostId: string, targetId: string): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.hostId !== hostId) return { ok: false, error: "Only the host can remove players" };
      if (room.phase !== "lobby") return { ok: false, error: "Can only remove players in the lobby" };
      if (targetId === hostId) return { ok: false, error: "You cannot remove yourself" };

      const target = room.players.find((p) => p.userId === targetId);
      if (!target) return { ok: false, error: "Player not found" };

      room.players = room.players.filter((p) => p.userId !== targetId);
      await room.save();

      this.io.to(this.userRoom(code, targetId)).emit("room:closed", { reason: "You were removed by the host." });
      this.broadcast(room);
      this.notice(code, { type: "player_kicked", name: target.displayName });
      return { ok: true };
    });
  }

  async handleUpdateSettings(
    code: string,
    hostId: string,
    settings: Partial<RoomSettings>,
  ): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.hostId !== hostId) return { ok: false, error: "Only the host can change settings" };
      if (room.phase !== "lobby") return { ok: false, error: "Settings are locked during a game" };

      if (settings.maxPlayers != null) {
        const clamped = clampPlayers(settings.maxPlayers);
        // Cannot set capacity below current player count.
        room.settings.maxPlayers = Math.max(clamped, room.players.length);
      }
      if (settings.durationSeconds != null) {
        room.settings.durationSeconds = clampDuration(settings.durationSeconds);
      }
      if (settings.imposterCount != null) {
        room.settings.imposterCount = clampImposters(settings.imposterCount, room.settings.maxPlayers);
      }
      // Re-clamp imposters in case capacity shrank.
      room.settings.imposterCount = clampImposters(room.settings.imposterCount, room.settings.maxPlayers);

      await room.save();
      this.broadcast(room);
      return { ok: true };
    });
  }

  // --- round lifecycle -----------------------------------------------------
  async handleStart(code: string, hostId: string): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.hostId !== hostId) return { ok: false, error: "Only the host can start" };
      if (room.phase !== "lobby") return { ok: false, error: "Game already started" };
      if (room.players.length < 3) return { ok: false, error: "Need at least 3 players to start" };

      await this.beginRound(room);
      return { ok: true };
    });
  }

  async handlePlayAgain(code: string, hostId: string): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.hostId !== hostId) return { ok: false, error: "Only the host can restart" };
      if (room.phase !== "reveal") return { ok: false, error: "Round is not finished" };
      const connected = room.players.filter((p) => p.connected);
      if (connected.length < 3) return { ok: false, error: "Need at least 3 players" };

      await this.beginRound(room);
      this.notice(code, { type: "new_round" });
      return { ok: true };
    });
  }

  /** Assign roles + word, enter role phase, then auto-advance to discussion. */
  private async beginRound(room: RoomDoc) {
    // Only connected players take part in the round.
    const participants = room.players.filter((p) => p.connected);
    const ids = participants.map((p) => p.userId);
    const imposterCount = clampImposters(room.settings.imposterCount, ids.length);

    const recent = this.recentWords.get(room.code) ?? [];
    const picked = await pickWord(recent);
    this.recentWords.set(room.code, [picked.word, ...recent].slice(0, 25));

    const { roles } = assignRoles(ids, imposterCount);

    room.round += 1;
    room.phase = "role";
    room.currentCategory = picked.category;
    room.timerEndsAt = null;

    for (const p of room.players) {
      p.hasVoted = false;
      p.votedFor = null;
      if (p.connected && roles[p.userId]) {
        p.role = roles[p.userId];
        if (p.role === "imposter") {
          p.hint = picked.imposterHint;
          p.word = null;
        } else {
          p.word = picked.word;
          p.hint = null;
        }
      } else {
        // Spectators (disconnected) hold no role this round.
        p.role = null;
        p.word = null;
        p.hint = null;
      }
    }

    await room.save();
    this.broadcast(room);
    this.emitRoles(room);
    this.notice(room.code, { type: "game_started" });

    // Auto-advance to the discussion phase (with the synced timer).
    this.setTimer(room.code, ROLE_PHASE_MS, () => this.enterDiscussion(room.code));
  }

  private async enterDiscussion(code: string) {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room || room.phase !== "role") return;
      room.phase = "discussion";
      room.timerEndsAt = new Date(Date.now() + room.settings.durationSeconds * 1000);
      await room.save();
      this.broadcast(room);
      this.emitRoles(room);

      const ms = room.timerEndsAt.getTime() - Date.now();
      this.setTimer(code, ms, () => this.enterVoting(code, "timer"));
    });
  }

  async handleVoteEarly(code: string, userId: string): Promise<AckResult> {
    const room = await this.load(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.phase !== "discussion") return { ok: false, error: "Not in discussion" };
    // Any participant may trigger early voting.
    if (!room.players.some((p) => p.userId === userId && p.connected)) {
      return { ok: false, error: "You are not in this round" };
    }
    await this.enterVoting(code, "early");
    return { ok: true };
  }

  private async enterVoting(code: string, _reason: "timer" | "early") {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room || room.phase !== "discussion") return;
      this.clearTimer(code);
      room.phase = "voting";
      room.timerEndsAt = null;
      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "phase_voting" });
    });
  }

  async handleCastVote(code: string, voterId: string, targetId: string): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.phase !== "voting") return { ok: false, error: "Voting is not open" };

      const voter = room.players.find((p) => p.userId === voterId);
      if (!voter || !voter.connected) return { ok: false, error: "You are not in this round" };
      if (voter.hasVoted) return { ok: false, error: "You already voted" };

      const target = room.players.find((p) => p.userId === targetId && p.connected);
      if (!target) return { ok: false, error: "Invalid vote target" };
      if (targetId === voterId) return { ok: false, error: "You cannot vote for yourself" };

      voter.hasVoted = true;
      voter.votedFor = targetId;
      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "vote_cast", voterName: voter.displayName });

      // If everyone connected has voted, lock voting (reveal enabled for host).
      const connected = room.players.filter((p) => p.connected);
      if (connected.every((p) => p.hasVoted)) {
        this.notice(code, { type: "all_voted" });
      }
      return { ok: true };
    });
  }

  async handleReveal(code: string, hostId: string): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.hostId !== hostId) return { ok: false, error: "Only the host can reveal" };
      if (room.phase !== "voting") return { ok: false, error: "Voting is not complete" };

      const connected = room.players.filter((p) => p.connected);
      const voters = connected.filter((p) => p.hasVoted);
      if (voters.length === 0) return { ok: false, error: "No votes cast yet" };

      // Reconstruct round facts from server-only fields.
      const imposterIds = connected.filter((p) => p.role === "imposter").map((p) => p.userId);
      const realWord =
        connected.find((p) => p.role === "player")?.word ??
        // Edge case: everyone is an imposter (shouldn't happen) — leave blank.
        "";
      const imposterHint = connected.find((p) => p.role === "imposter")?.hint ?? "";

      const votes = voters.map((p) => {
        const t = room.players.find((x) => x.userId === p.votedFor);
        return {
          voterId: p.userId,
          voterName: p.displayName,
          targetId: p.votedFor!,
          targetName: t?.displayName ?? "Unknown",
        };
      });

      const reveal = resolveRound({
        votes,
        imposterIds,
        players: connected.map((p) => ({ userId: p.userId, displayName: p.displayName, avatar: p.avatar })),
        realWord,
        imposterHint,
        category: room.currentCategory ?? "",
        voterCount: voters.length,
      });

      // Track per-room round wins.
      const winnerSet = new Set(reveal.winners);
      for (const p of room.players) {
        if (winnerSet.has(p.userId)) p.roundsWon += 1;
      }

      room.phase = "reveal";
      room.timerEndsAt = null;
      await room.save();

      // Persist lifetime statistics.
      await this.applyStatistics(room, imposterIds, reveal.winners, reveal.imposters);

      this.broadcast(room, reveal);
      this.notice(code, { type: "revealed" });
      return { ok: true };
    });
  }

  private async applyStatistics(
    room: RoomDoc,
    imposterIds: string[],
    winners: string[],
    imposters: { userId: string; caught: boolean }[],
  ) {
    const imposterSet = new Set(imposterIds);
    const winnerSet = new Set(winners);
    const caughtSet = new Set(imposters.filter((i) => i.caught).map((i) => i.userId));
    const participants = room.players.filter((p) => p.role !== null && p.connected);

    await Promise.all(
      participants.map((p) => {
        const inc: Record<string, number> = { "statistics.gamesPlayed": 1 };
        if (winnerSet.has(p.userId)) inc["statistics.wins"] = 1;
        else inc["statistics.losses"] = 1;
        if (imposterSet.has(p.userId)) {
          inc["statistics.timesAsImposter"] = 1;
          if (caughtSet.has(p.userId)) inc["statistics.timesCaught"] = 1;
        }
        return User.updateOne({ _id: p.userId }, { $inc: inc }).catch((e) =>
          console.error("[stats]", e),
        );
      }),
    );
  }

  async syncTo(code: string, userId: string) {
    const room = await this.load(code);
    if (!room) return;
    // Re-emit the current snapshot to just this user (post-refresh hydration).
    let reveal = null;
    if (room.phase === "reveal") {
      // Rebuild reveal for late/refreshed clients.
      reveal = await this.rebuildReveal(room);
    }
    this.io.to(this.userRoom(code, userId)).emit("room:state", buildSnapshot(room, reveal));
    await this.emitRoleTo(code, userId);
  }

  private async rebuildReveal(room: RoomDoc) {
    const connected = room.players.filter((p) => p.role !== null);
    const imposterIds = connected.filter((p) => p.role === "imposter").map((p) => p.userId);
    const realWord = connected.find((p) => p.role === "player")?.word ?? "";
    const imposterHint = connected.find((p) => p.role === "imposter")?.hint ?? "";
    const voters = room.players.filter((p) => p.hasVoted);
    const votes = voters.map((p) => {
      const t = room.players.find((x) => x.userId === p.votedFor);
      return {
        voterId: p.userId,
        voterName: p.displayName,
        targetId: p.votedFor!,
        targetName: t?.displayName ?? "Unknown",
      };
    });
    return resolveRound({
      votes,
      imposterIds,
      players: connected.map((p) => ({ userId: p.userId, displayName: p.displayName, avatar: p.avatar })),
      realWord,
      imposterHint,
      category: room.currentCategory ?? "",
      voterCount: voters.length || 1,
    });
  }

  // --- timers --------------------------------------------------------------
  private setTimer(code: string, ms: number, fn: () => void) {
    this.clearTimer(code);
    const t = setTimeout(fn, Math.max(0, ms));
    this.timers.set(code, t);
  }
  private clearTimer(code: string) {
    const t = this.timers.get(code);
    if (t) clearTimeout(t);
    this.timers.delete(code);
  }

  /** On server (re)start, re-arm any timers for rooms mid-discussion. */
  async rehydrateTimers() {
    await connectToDatabase();
    const rooms = await Room.find({ phase: "discussion", timerEndsAt: { $ne: null } });
    for (const room of rooms) {
      const ms = (room.timerEndsAt?.getTime() ?? 0) - Date.now();
      if (ms <= 0) {
        await this.enterVoting(room.code, "timer");
      } else {
        this.setTimer(room.code, ms, () => this.enterVoting(room.code, "timer"));
      }
    }
  }
}
