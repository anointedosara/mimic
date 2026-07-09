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

import { connectToDatabase } from "@/lib/db/mongoose";
import { Room, type RoomDoc, type RoomPlayer } from "@/lib/db/models/Room";
import { User } from "@/lib/db/models/User";
import { assignRoles, resolveRound } from "@/lib/game/engine";
import { clampImposters, clampPlayers, clampDuration } from "@/lib/game/config";
import type { RoomSettings } from "@/lib/game/types";
import type { AckResult, RoomNotice } from "@/lib/game/events";
import type { Emitter } from "@/lib/game/emitter";
import type { Scheduler } from "@/lib/game/scheduler";
import { buildPrivateRole, buildSnapshot } from "./snapshot";
import { pickWord } from "./words";

const ROLE_PHASE_MS = 5000; // brief personal-role reveal before discussion
// A host who drops (refresh, backgrounded tab, flaky network) keeps the crown
// for this long. Only if they're still gone after it does the crown move to a
// connected player — so a refresh never costs you host.
const HOST_GRACE_MS = 45_000;

export class GameManager {
  private locks = new Map<string, Promise<unknown>>();
  private recentWords = new Map<string, string[]>();

  constructor(
    private emitter: Emitter,
    private scheduler: Scheduler,
  ) {}

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

  private async load(code: string): Promise<RoomDoc | null> {
    await connectToDatabase();
    return Room.findOne({ code: code.toUpperCase() });
  }

  private notice(code: string, notice: RoomNotice) {
    this.emitter.toRoom(code, "room:notice", notice);
  }

  // --- broadcasting --------------------------------------------------------
  private broadcast(room: RoomDoc, reveal: Parameters<typeof buildSnapshot>[1] = null) {
    // During the reveal phase the snapshot MUST carry the results, or the client
    // sits on its loading spinner forever. Any plain broadcast (a join, a
    // disconnect, a host handoff) would otherwise send reveal:null and wipe the
    // results for everyone — so we always rebuild it here when it's due.
    const payload = reveal ?? (room.phase === "reveal" ? this.computeReveal(room) : null);
    this.emitter.toRoom(room.code, "room:state", buildSnapshot(room, payload));
  }

  /** Send each connected player their private role (during role/discussion). */
  private emitRoles(room: RoomDoc) {
    for (const p of room.players) {
      const payload = buildPrivateRole(room, p.userId);
      if (payload) {
        this.emitter.toUser(room.code, p.userId, "game:role", payload);
      }
    }
  }

  /** Send a single player their private role (on reconnect / sync). */
  async emitRoleTo(code: string, userId: string) {
    const room = await this.load(code);
    if (!room) return;
    const payload = buildPrivateRole(room, userId);
    if (payload) this.emitter.toUser(code, userId, "game:role", payload);
  }

  // --- player presence -----------------------------------------------------
  /**
   * Guarantee the room has a *usable* host. Keeps the current host if they're
   * connected, or disconnected but still inside the grace window (so a refresh
   * doesn't hand off the crown). Otherwise promotes the first connected player.
   * Returns the new host's name if it changed, else null (so the caller can
   * announce it). Mutates `room` but does not save/broadcast.
   */
  private ensureConnectedHost(room: RoomDoc): string | null {
    const host = room.players.find((p) => p.isHost);
    const withinGrace =
      host?.connected ||
      (host?.disconnectedAt != null &&
        Date.now() - new Date(host.disconnectedAt).getTime() < HOST_GRACE_MS);
    if (host && withinGrace) return null;

    const successor = room.players.find((p) => p.connected);
    if (!successor) return null; // nobody to hand off to — leave host as-is
    if (successor.isHost) {
      room.hostId = successor.userId;
      return null;
    }
    for (const p of room.players) p.isHost = p.userId === successor.userId;
    room.hostId = successor.userId;
    return successor.displayName;
  }

  /** A fully-formed player subdocument (all fields — raw $push skips defaults). */
  private newPlayerDoc(
    user: { id: string; displayName: string; avatar: string },
  ): RoomPlayer {
    return {
      userId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      isHost: false, // ensureConnectedHost promotes if the room has no host
      connected: true,
      disconnectedAt: null,
      joinedAt: new Date(),
      roundsWon: 0,
      role: null,
      word: null,
      hint: null,
      hasVoted: false,
      votedFor: [],
    } as RoomPlayer;
  }

  /** Collapse any duplicate userIds (keep the first). Returns true if it changed. */
  private dedupePlayers(room: RoomDoc): boolean {
    const seen = new Set<string>();
    const before = room.players.length;
    room.players = room.players.filter((p) => {
      if (seen.has(p.userId)) return false;
      seen.add(p.userId);
      return true;
    }) as typeof room.players;
    return room.players.length !== before;
  }

  async handleJoin(code: string, user: { id: string; displayName: string; avatar: string }): Promise<AckResult> {
    const CODE = code.toUpperCase();

    // Race-safe add. On serverless, each request is a fresh instance so the
    // in-memory lock can't serialize concurrent joins (two tabs / a fast
    // reconnect). We let MongoDB be the arbiter: push this player ONLY if the
    // userId isn't already present AND there's capacity — a single atomic op, so
    // two simultaneous joins can never both insert. This is what makes duplicate
    // player entries impossible rather than merely rare.
    let added = false;
    try {
      const res = await Room.updateOne(
        {
          code: CODE,
          phase: "lobby",
          "players.userId": { $ne: user.id },
          $expr: { $lt: [{ $size: "$players" }, "$settings.maxPlayers"] },
        },
        { $push: { players: this.newPlayerDoc(user) } },
      );
      added = res.modifiedCount === 1;
    } catch (err) {
      console.error("[join] atomic add failed", err);
    }

    return this.withLock(CODE, async () => {
      const room = await this.load(CODE);
      if (!room) return { ok: false, error: "Room not found" };

      // Belt-and-suspenders: heal any duplicates left behind by older data.
      if (this.dedupePlayers(room)) await room.save();

      const player = room.players.find((p) => p.userId === user.id);
      if (!player) {
        // We didn't add them — report the precise reason.
        if (room.phase !== "lobby") return { ok: false, error: "Game already in progress" };
        return { ok: false, error: "Room is full" };
      }

      // Refresh identity + presence, clear the drop timer (keeps host on refresh).
      player.connected = true;
      player.disconnectedAt = null;
      player.displayName = user.displayName;
      player.avatar = user.avatar;

      // Ensure a usable host exists (promotes only if the host is truly gone).
      const newHost = this.ensureConnectedHost(room);

      await room.save();
      this.broadcast(room);
      if (added) this.notice(CODE, { type: "player_joined", name: user.displayName });
      if (newHost) this.notice(CODE, { type: "host_changed", name: newHost });

      // Re-send private role if a round is underway.
      if (["role", "discussion", "voting"].includes(room.phase)) {
        await this.emitRoleTo(CODE, user.id);
      }
      return { ok: true };
    });
  }

  /**
   * TRANSIENT drop — refresh, backgrounded tab, or flaky network. The player
   * STAYS in the room (marked disconnected) and KEEPS host; we only stamp when
   * they dropped so the crown can move later if they never come back. Nothing
   * is removed here, so a bad connection never ejects anyone.
   */
  async handleDisconnect(code: string, userId: string) {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return;
      const player = room.players.find((p) => p.userId === userId);
      if (!player || !player.connected) return;

      player.connected = false;
      player.disconnectedAt = new Date();

      await room.save();
      this.broadcast(room);
    });
  }

  /**
   * EXPLICIT leave — the player tapped "Leave". Remove them, hand off the host
   * crown if needed, and delete the room once it's empty.
   */
  async handleLeave(code: string, userId: string) {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return;
      const player = room.players.find((p) => p.userId === userId);
      if (!player) return;

      // Eject EVERY device this account has open on the room — a leave is for
      // the user, not just the tab they clicked it in. All their devices are
      // subscribed to their user channel, so this reaches every one of them and
      // stops any from silently re-joining.
      this.emitter.toUser(code, userId, "room:closed", { reason: "You left the room." });

      const wasHost = player.isHost;
      room.players = room.players.filter((p) => p.userId !== userId);

      if (room.players.length === 0) {
        await Room.deleteOne({ code: room.code });
        this.scheduler.cancel(code);
        return;
      }

      let newHost: string | null = null;
      if (wasHost) {
        newHost = this.ensureConnectedHost(room);
        // Nobody connected to take over — hand to the first remaining player so
        // the room always has a host.
        if (!room.players.some((p) => p.isHost) && room.players[0]) {
          room.players[0].isHost = true;
          room.hostId = room.players[0].userId;
          newHost = room.players[0].displayName;
        }
      }

      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "player_left", name: player.displayName });
      if (wasHost && newHost) this.notice(code, { type: "host_changed", name: newHost });
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

      this.emitter.toUser(code, targetId, "room:closed", { reason: "You were removed by the host." });
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
      p.votedFor = [];
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

    // Auto-advance to the discussion phase after the brief role reveal.
    this.scheduler.armAdvance(room.code, ROLE_PHASE_MS);
  }

  /**
   * Idempotent phase-advance entry point, driven by the scheduler callback
   * (QStash in prod / setTimeout in dev). Re-reads the room and only transitions
   * if still warranted, so a stale or duplicate callback is a safe no-op.
   */
  async advancePhase(code: string) {
    const room = await this.load(code);
    if (!room) return;
    if (room.phase === "role") {
      await this.enterDiscussion(code);
    } else if (room.phase === "discussion") {
      await this.enterVoting(code, "timer");
    }
  }

  /**
   * Client-driven phase advance — a fallback for when the scheduled callback
   * (QStash) can't be delivered (e.g. a public URL that QStash can't reach, or
   * a frozen serverless function). A connected participant may nudge the room
   * forward, but only when it's genuinely due:
   *  - role: any time after the brief reveal (the client waits out ROLE_PHASE_MS)
   *  - discussion: only once the timer deadline has passed (so it can't cut the
   *    discussion short — that's what "vote early" is for)
   * enterDiscussion/enterVoting are themselves lock- and phase-guarded, so
   * duplicate or racing calls are safe no-ops.
   */
  async handleClientAdvance(code: string, userId: string): Promise<AckResult> {
    const room = await this.load(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (!room.players.some((p) => p.userId === userId && p.connected)) {
      return { ok: false, error: "You are not in this round" };
    }

    if (room.phase === "role") {
      await this.enterDiscussion(code);
    } else if (room.phase === "discussion") {
      const due = !room.timerEndsAt || Date.now() >= new Date(room.timerEndsAt).getTime();
      if (due) await this.enterVoting(code, "timer");
    }
    return { ok: true };
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
      this.scheduler.armAdvance(code, ms);
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
      this.scheduler.cancel(code);
      room.phase = "voting";
      room.timerEndsAt = null;
      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "phase_voting" });
    });
  }

  async handleCastVote(code: string, voterId: string, targetIds: string[]): Promise<AckResult> {
    return this.withLock(code, async () => {
      const room = await this.load(code);
      if (!room) return { ok: false, error: "Room not found" };
      if (room.phase !== "voting") return { ok: false, error: "Voting is not open" };

      const voter = room.players.find((p) => p.userId === voterId);
      if (!voter || !voter.connected) return { ok: false, error: "You are not in this round" };
      if (voter.hasVoted) return { ok: false, error: "You already voted" };

      // Each player casts one vote per imposter, all at once as a ballot.
      const connectedCount = room.players.filter((p) => p.connected).length;
      const quota = clampImposters(room.settings.imposterCount, connectedCount);
      const ballot = Array.from(new Set(targetIds)); // de-dupe
      if (ballot.length !== quota) {
        return { ok: false, error: `Pick exactly ${quota} player${quota > 1 ? "s" : ""} to vote out` };
      }
      for (const targetId of ballot) {
        if (targetId === voterId) return { ok: false, error: "You cannot vote for yourself" };
        const target = room.players.find((p) => p.userId === targetId && p.connected);
        if (!target) return { ok: false, error: "Invalid vote target" };
      }

      voter.hasVoted = true;
      voter.votedFor = ballot;
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

      const votes = voters.flatMap((p) =>
        (p.votedFor ?? []).map((targetId) => {
          const t = room.players.find((x) => x.userId === targetId);
          return {
            voterId: p.userId,
            voterName: p.displayName,
            targetId,
            targetName: t?.displayName ?? "Unknown",
          };
        }),
      );

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

    // Heal a host who's been gone past the grace window — the periodic re-sync
    // from any connected client is enough to move the crown, so the game never
    // gets stuck waiting on a host who isn't coming back.
    const newHost = this.ensureConnectedHost(room);
    if (newHost) {
      await room.save();
      this.broadcast(room);
      this.notice(code, { type: "host_changed", name: newHost });
    }

    // Re-emit the current snapshot to just this user (post-refresh hydration).
    // Rebuild the reveal for late/refreshed clients so they never hydrate into
    // an empty (perpetually-loading) reveal screen.
    const reveal = room.phase === "reveal" ? this.computeReveal(room) : null;
    this.emitter.toUser(code, userId, "room:state", buildSnapshot(room, reveal));
    await this.emitRoleTo(code, userId);
  }

  /** Synchronously reconstruct the reveal result from server-only round fields. */
  private computeReveal(room: RoomDoc) {
    const connected = room.players.filter((p) => p.role !== null);
    const imposterIds = connected.filter((p) => p.role === "imposter").map((p) => p.userId);
    const realWord = connected.find((p) => p.role === "player")?.word ?? "";
    const imposterHint = connected.find((p) => p.role === "imposter")?.hint ?? "";
    const voters = room.players.filter((p) => p.hasVoted);
    const votes = voters.flatMap((p) =>
      (p.votedFor ?? []).map((targetId) => {
        const t = room.players.find((x) => x.userId === targetId);
        return {
          voterId: p.userId,
          voterName: p.displayName,
          targetId,
          targetName: t?.displayName ?? "Unknown",
        };
      }),
    );
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
}
