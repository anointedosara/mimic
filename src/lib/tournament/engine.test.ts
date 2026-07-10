import { describe, it, expect } from "vitest";
import {
  assignInitialImposters,
  dealRound,
  tallyElimination,
  evaluateEnd,
} from "./engine";
import type { TournamentPlayer, TournamentVote } from "./types";

/** Deterministic RNG: cycles through the given values. */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function players(n: number): TournamentPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    avatar: "fox",
    isAI: i !== 0,
    personality: i === 0 ? null : "logical",
  }));
}

describe("assignInitialImposters", () => {
  it("assigns the requested number of imposters, all valid ids", () => {
    const ps = players(6);
    const imps = assignInitialImposters(ps, 2, seededRng([0.1, 0.9, 0.3, 0.7, 0.5]));
    expect(imps).toHaveLength(2);
    const ids = new Set(ps.map((p) => p.id));
    for (const id of imps) expect(ids.has(id)).toBe(true);
    expect(new Set(imps).size).toBe(2); // distinct
  });

  it("never assigns everyone as an imposter", () => {
    const ps = players(3);
    const imps = assignInitialImposters(ps, 5, () => 0);
    expect(imps.length).toBeLessThanOrEqual(2);
    expect(imps.length).toBeGreaterThanOrEqual(1);
  });
});

describe("dealRound", () => {
  it("marks only still-active imposters and gives everyone a role", () => {
    const ps = players(5);
    const imposterIds = ["p1", "p3"];
    // p3 eliminated → only p1 active imposter.
    const active = ps.filter((p) => p.id !== "p3");
    const round = dealRound(active, imposterIds, [], () => 0.42);
    expect(round.imposterIds).toEqual(["p1"]);
    expect(round.roles["p1"]).toBe("imposter");
    expect(round.roles["p0"]).toBe("player");
    expect(Object.keys(round.roles)).toHaveLength(active.length);
    expect(round.word).toBeTruthy();
    expect(round.imposterHint).toBeTruthy();
  });

  it("excludes recently-used words when possible", () => {
    const ps = players(4);
    const first = dealRound(ps, ["p1"], [], seededRng([0.01, 0.5]));
    const second = dealRound(ps, ["p1"], [first.word], seededRng([0.99, 0.5]));
    expect(second.word).not.toBe(first.word);
  });
});

describe("tallyElimination", () => {
  it("eliminates the most-voted player", () => {
    const ps = players(4);
    const votes: TournamentVote[] = [
      { voterId: "p0", targetId: "p1" },
      { voterId: "p2", targetId: "p1" },
      { voterId: "p3", targetId: "p1" },
      { voterId: "p1", targetId: "p2" },
    ];
    const { eliminatedId, voteBreakdown } = tallyElimination(votes, ps, () => 0);
    expect(eliminatedId).toBe("p1"); // 3 votes, clear plurality
    expect(voteBreakdown[0]).toEqual({ targetId: "p1", targetName: "P1", votes: 3 });
  });

  it("breaks ties at random among the top-voted", () => {
    const ps = players(3);
    const votes: TournamentVote[] = [
      { voterId: "p0", targetId: "p1" },
      { voterId: "p2", targetId: "p1" },
      { voterId: "p1", targetId: "p2" },
    ];
    // p1 has 2 votes (clear winner) → always p1 regardless of rng.
    expect(tallyElimination(votes, ps, () => 0).eliminatedId).toBe("p1");
    expect(tallyElimination(votes, ps, () => 0.99).eliminatedId).toBe("p1");
  });
});

describe("evaluateEnd", () => {
  it("players win when no imposters remain", () => {
    expect(evaluateEnd(0, 3)).toBe("players_win");
  });

  it("imposters win at parity", () => {
    expect(evaluateEnd(2, 2)).toBe("imposters_win");
    expect(evaluateEnd(1, 1)).toBe("imposters_win");
    expect(evaluateEnd(2, 1)).toBe("imposters_win");
  });

  it("continues while imposters are outnumbered", () => {
    expect(evaluateEnd(1, 3)).toBe("continue");
    expect(evaluateEnd(2, 3)).toBe("continue");
  });
});
