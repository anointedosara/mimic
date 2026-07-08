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
  const scheduler = { armAdvance() {}, cancel() {} };
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
      const res = await manager.handleCastVote("TEST01", p.userId, imposter.userId);
      expect(res.ok).toBe(true);
    }
    const impVote = await manager.handleCastVote("TEST01", imposter.userId, players[0].userId);
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
