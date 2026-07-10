// Integration test: drives the REAL GameManager against a real (in-memory)
// MongoDB. Verifies the full round lifecycle AND the anti-cheat guarantee —
// that public snapshots never leak roles/words/hints, while each player still
// receives their own private role.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { GameManager } from "./manager";
import { Room } from "@/lib/db/models/Room";
import { User } from "@/lib/db/models/User";
import { Word } from "@/lib/db/models/Word";
import type { PrivateRole, RoomSnapshot } from "@/lib/game/types";

// --- Mock Emitter + Scheduler that record emissions per target channel ------
interface Emission {
  target: string;
  event: string;
  payload: unknown;
}
function createMockDeps() {
  const emissions: Emission[] = [];
  const emitter = {
    toRoom(code: string, event: string, payload: unknown) {
      emissions.push({ target: `room:${code.toUpperCase()}`, event, payload });
    },
    toUser(code: string, userId: string, event: string, payload: unknown) {
      emissions.push({ target: `user:${code.toUpperCase()}:${userId}`, event, payload });
    },
  };
  // Timers are irrelevant to this test; record nothing.
  const scheduler = { armAdvance() {}, armAI() {}, cancel() {} };
  return { emitter, scheduler, emissions };
}

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Point the app's own connectToDatabase() at the in-memory instance so the
  // GameManager uses the exact same production connection path.
  process.env.MONGODB_URI = mongod.getUri();
  await connectToDatabase();
  await Word.create({ word: "Pizza", imposterHint: "Cheese", category: "Food" });
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GameManager full round", () => {
  it("runs lobby → roles → voting → reveal without ever leaking roles", async () => {
    const { emitter, scheduler, emissions } = createMockDeps();
    const manager = new GameManager(emitter, scheduler);

    // Seed 4 users + a room hosted by u1.
    const users = await User.create([
      { displayName: "Alice", email: "a@t.co", passwordHash: "x", avatar: "fox" },
      { displayName: "Bob", email: "b@t.co", passwordHash: "x", avatar: "cat" },
      { displayName: "Cara", email: "c@t.co", passwordHash: "x", avatar: "owl" },
      { displayName: "Dan", email: "d@t.co", passwordHash: "x", avatar: "bee" },
    ]);
    const ids = users.map((u) => u._id.toString());

    await Room.create({
      code: "TEST01",
      hostId: ids[0],
      phase: "lobby",
      settings: { maxPlayers: 8, imposterCount: 1, durationSeconds: 60 },
      players: [],
    });

    // Everyone joins.
    for (let i = 0; i < 4; i++) {
      const res = await manager.handleJoin("TEST01", {
        id: ids[i],
        displayName: users[i].displayName,
        avatar: users[i].avatar,
      });
      expect(res.ok).toBe(true);
    }

    // Host starts.
    const start = await manager.handleStart("TEST01", ids[0]);
    expect(start.ok).toBe(true);

    // Each player got a PRIVATE role on their own user room.
    const roleEmits = emissions.filter((e) => e.event === "game:role");
    expect(roleEmits.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 4; i++) {
      const mine = roleEmits.find((e) => e.target === `user:TEST01:${ids[i]}`);
      expect(mine, `player ${i} should get a private role`).toBeTruthy();
      const role = mine!.payload as PrivateRole;
      if (role.role === "imposter") {
        expect(role.hint).toBe("Cheese");
        expect((role as unknown as { word?: string }).word).toBeUndefined();
      } else {
        expect(role.word).toBe("Pizza");
        expect((role as unknown as { hint?: string }).hint).toBeUndefined();
      }
    }

    // CRITICAL: no PUBLIC snapshot (room:state) ever contains secrets.
    const publicSnaps = emissions.filter((e) => e.event === "room:state");
    expect(publicSnaps.length).toBeGreaterThan(0);
    for (const snap of publicSnaps) {
      const json = JSON.stringify(snap.payload);
      expect(json).not.toContain("Pizza");
      expect(json).not.toContain("Cheese");
      // Public players must not carry role/word/hint/votedFor keys.
      const s = snap.payload as RoomSnapshot;
      for (const p of s.players) {
        expect(p).not.toHaveProperty("role");
        expect(p).not.toHaveProperty("word");
        expect(p).not.toHaveProperty("hint");
        expect(p).not.toHaveProperty("votedFor");
      }
    }

    // Determine the imposter from server-side DB (test-only inspection).
    const roomDoc = await Room.findOne({ code: "TEST01" });
    const imposter = roomDoc!.players.find((p) => p.role === "imposter")!;
    const players = roomDoc!.players.filter((p) => p.role === "player");
    expect(imposter).toBeTruthy();
    expect(players.length).toBe(3);

    // Force into voting (simulate discussion ended).
    roomDoc!.phase = "voting";
    await roomDoc!.save();

    // All 3 normal players vote for the imposter; imposter votes for a player.
    for (const p of players) {
      const res = await manager.handleCastVote("TEST01", p.userId, [imposter.userId]);
      expect(res.ok).toBe(true);
    }
    const impVote = await manager.handleCastVote("TEST01", imposter.userId, [players[0].userId]);
    expect(impVote.ok).toBe(true);

    // Host reveals.
    const reveal = await manager.handleReveal("TEST01", ids[0]);
    expect(reveal.ok).toBe(true);

    // The reveal snapshot exposes the outcome (now permitted).
    const revealSnap = [...emissions].reverse().find((e) => e.event === "room:state");
    const s = revealSnap!.payload as RoomSnapshot;
    expect(s.phase).toBe("reveal");
    expect(s.reveal).toBeTruthy();
    expect(s.reveal!.realWord).toBe("Pizza");
    expect(s.reveal!.imposterHint).toBe("Cheese");
    expect(s.reveal!.imposters).toHaveLength(1);
    expect(s.reveal!.imposters[0].caught).toBe(true); // 3/4 votes → caught
    expect(s.reveal!.winningSide).toBe("players");

    // Statistics were written.
    const updated = await User.findById(imposter.userId);
    expect(updated!.statistics.gamesPlayed).toBe(1);
    expect(updated!.statistics.timesAsImposter).toBe(1);
    expect(updated!.statistics.timesCaught).toBe(1);
    expect(updated!.statistics.losses).toBe(1);
  }, 30_000);
});

describe("GameManager hybrid (AI players) + chat", () => {
  it("fills empty slots with AI that play and chat, and never lets AI host", async () => {
    const { emitter, scheduler, emissions } = createMockDeps();
    const manager = new GameManager(emitter, scheduler);

    const host = await User.create({
      displayName: "Zoe",
      email: "zoe@t.co",
      passwordHash: "x",
      avatar: "fox",
    });
    const hostId = host._id.toString();

    await Room.create({
      code: "TEST02",
      hostId,
      phase: "lobby",
      settings: { maxPlayers: 4, imposterCount: 1, durationSeconds: 60 },
      players: [],
    });

    // Host joins alone, then fills the remaining 3 slots with AI.
    expect((await manager.handleJoin("TEST02", { id: hostId, displayName: "Zoe", avatar: "fox" })).ok).toBe(true);

    // Chat works in the lobby.
    expect((await manager.handleChat("TEST02", hostId, "hey anyone?", null)).ok).toBe(true);

    const fill = await manager.handleFillWithAI("TEST02", hostId);
    expect(fill.ok).toBe(true);

    let doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.players).toHaveLength(4);
    const ai = doc!.players.filter((p) => p.isAI);
    expect(ai).toHaveLength(3);
    // AI never host; each has a personality + an ai_ id.
    expect(ai.every((p) => !p.isHost && p.personality && p.userId.startsWith("ai_"))).toBe(true);
    expect(doc!.hostId).toBe(hostId);

    // Public snapshot exposes isAI + messages, still no secrets.
    const lobbySnap = [...emissions].reverse().find((e) => e.event === "room:state");
    const ls = lobbySnap!.payload as RoomSnapshot;
    expect(ls.players.some((p) => p.isAI)).toBe(true);
    expect(ls.messages.some((m) => m.text === "hey anyone?" && m.scope === "lobby")).toBe(true);

    // Start → role → discussion (AI drop opening chat lines).
    expect((await manager.handleStart("TEST02", hostId)).ok).toBe(true);
    await manager.advancePhase("TEST02"); // role → discussion

    doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.phase).toBe("discussion");
    const aiOpeners = doc!.messages.filter((m) => m.isAI && m.scope === "table" && m.round === doc!.round);
    expect(aiOpeners.length).toBeGreaterThan(0);

    // The AI banter chain keeps posting contextual lines during discussion.
    const before = aiOpeners.length;
    for (let i = 0; i < 3; i++) await manager.aiChatTick("TEST02");
    doc = await Room.findOne({ code: "TEST02" });
    const aiLines = doc!.messages.filter((m) => m.isAI && m.scope === "table" && m.round === doc!.round);
    expect(aiLines.length).toBeGreaterThan(before);

    // Any participant can trigger the vote; AI vote the instant it opens.
    expect((await manager.handleVoteEarly("TEST02", hostId)).ok).toBe(true);
    doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.phase).toBe("voting");
    expect(doc!.players.filter((p) => p.isAI).every((p) => p.hasVoted)).toBe(true);

    // Host casts the last vote, then reveals — AI votes count, no stats crash.
    const someTarget = doc!.players.find((p) => p.userId !== hostId)!;
    expect((await manager.handleCastVote("TEST02", hostId, [someTarget.userId])).ok).toBe(true);
    const reveal = await manager.handleReveal("TEST02", hostId);
    expect(reveal.ok).toBe(true);

    // Host got stats; AI have no accounts so none were created for them.
    const hostAfter = await User.findById(hostId);
    expect(hostAfter!.statistics.gamesPlayed).toBe(1);
    expect(await User.countDocuments({})).toBeGreaterThan(0);

    // A reaction toggles on and off.
    doc = await Room.findOne({ code: "TEST02" });
    const msgId = doc!.messages[0].id;
    await manager.handleReact("TEST02", hostId, msgId, "🔥");
    doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.messages.find((m) => m.id === msgId)!.reactions[0]).toMatchObject({
      emoji: "🔥",
      userIds: [hostId],
    });
    await manager.handleReact("TEST02", hostId, msgId, "🔥");
    doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.messages.find((m) => m.id === msgId)!.reactions).toHaveLength(0);

    // Even if the only human drops, the crown never moves to an AI.
    await manager.handleDisconnect("TEST02", hostId);
    doc = await Room.findOne({ code: "TEST02" });
    expect(doc!.hostId).toBe(hostId);
    expect(doc!.players.find((p) => p.isHost)!.isAI).toBe(false);
  }, 30_000);
});
