import { describe, it, expect } from "vitest";
import { computeAIVotes, generateAIPlayers } from "./ai";
import { buildRound } from "./engine";
import type { Difficulty, SoloPlayer } from "./types";

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const human: SoloPlayer = { id: "human", name: "Me", avatar: "fox", isAI: false, personality: null };

describe("generateAIPlayers", () => {
  it("creates the requested number of AI seats with distinct names & avatars", () => {
    const ai = generateAIPlayers(5, ["fox"], seededRng(1));
    expect(ai).toHaveLength(5);
    expect(ai.every((p) => p.isAI && p.personality)).toBe(true);
    expect(new Set(ai.map((p) => p.name)).size).toBe(5);
    expect(new Set(ai.map((p) => p.avatar)).size).toBe(5);
    expect(ai.every((p) => p.avatar !== "fox")).toBe(true); // human's avatar excluded
  });
});

describe("computeAIVotes", () => {
  const table = (): SoloPlayer[] => [human, ...generateAIPlayers(5, ["fox"], seededRng(4))];

  it("produces one vote per AI, never a self-vote, always a valid target", () => {
    const players = table();
    const round = buildRound(players, 1, [], seededRng(5));
    const votes = computeAIVotes(round, players, "medium", {}, 1, seededRng(6));
    const ids = new Set(players.map((p) => p.id));
    const aiCount = players.filter((p) => p.isAI).length;

    expect(votes).toHaveLength(aiCount);
    for (const v of votes) {
      expect(v.voterId).not.toBe(v.targetId);
      expect(ids.has(v.targetId)).toBe(true);
      expect(players.find((p) => p.id === v.voterId)?.isAI).toBe(true);
    }
  });

  it("piles onto the player whose clues were most suspicious (whiffs)", () => {
    const players = table();
    const round = buildRound(players, 1, [], seededRng(5));
    const framed = players.find((p) => p.isAI)!;
    // Heavy whiff suspicion on one player → most AIs should vote them.
    const votes = computeAIVotes(round, players, "medium", { [framed.id]: 10 }, 1, seededRng(6));
    const onFramed = votes.filter((v) => v.targetId === framed.id).length;
    expect(onFramed).toBeGreaterThan(votes.length / 2);
  });

  it("casts a full distinct ballot of `quota` votes per AI", () => {
    const players = table();
    const round = buildRound(players, 2, [], seededRng(5));
    const votes = computeAIVotes(round, players, "medium", {}, 2, seededRng(6));
    const aiCount = players.filter((p) => p.isAI).length;
    expect(votes).toHaveLength(aiCount * 2);
    // Each AI's two votes are distinct and never itself.
    for (const voter of players.filter((p) => p.isAI)) {
      const mine = votes.filter((v) => v.voterId === voter.id).map((v) => v.targetId);
      expect(mine).toHaveLength(2);
      expect(new Set(mine).size).toBe(2);
      expect(mine).not.toContain(voter.id);
    }
  });

  it("hard AIs sense a clean imposter more often than easy AIs", () => {
    // With NO visible whiffs, detection rests on the difficulty tell — harder
    // AIs should still land more votes on the real imposter.
    function hitRate(difficulty: Difficulty): number {
      let hits = 0;
      const N = 400;
      for (let i = 0; i < N; i++) {
        const rng = seededRng(1000 + i);
        const players = [human, ...generateAIPlayers(5, ["fox"], rng)];
        const round = buildRound(players, 1, [], rng);
        const impId = round.imposterIds[0];
        const votes = computeAIVotes(round, players, difficulty, {}, 1, rng);
        hits += votes.filter((v) => v.targetId === impId).length;
      }
      return hits / N;
    }
    expect(hitRate("hard")).toBeGreaterThan(hitRate("easy"));
  });
});
