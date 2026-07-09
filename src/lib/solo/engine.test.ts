import { describe, it, expect } from "vitest";
import { buildRound, resolveRound } from "./engine";
import type { SoloPlayer, SoloVote } from "./types";

// Deterministic RNG for reproducible tests.
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const players = (n: number, aiFrom = 1): SoloPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    avatar: "fox",
    isAI: i >= aiFrom, // p0 is the human
    personality: i >= aiFrom ? "logical" : null,
  }));

describe("buildRound", () => {
  it("assigns the requested imposter count and a role for everyone", () => {
    const ps = players(6);
    const round = buildRound(ps, 2, [], seededRng(2));
    expect(round.imposterIds).toHaveLength(2);
    for (const p of ps) expect(round.roles[p.id]).toMatch(/player|imposter/);
    expect(round.word).toBeTruthy();
    expect(round.imposterHint).toBeTruthy();
  });

  it("clamps imposter count so not everyone is an imposter", () => {
    const ps = players(3);
    const round = buildRound(ps, 10, [], seededRng(3));
    expect(round.imposterIds.length).toBeLessThan(ps.length);
    expect(round.imposterIds.length).toBeGreaterThanOrEqual(1);
  });
});

describe("resolveRound", () => {
  const votesFor = (voters: SoloPlayer[], targetId: string): SoloVote[] =>
    voters.map((v) => ({ voterId: v.id, targetId }));

  it("players win when the whole table votes out the only imposter", () => {
    const ps = players(6);
    const round = buildRound(ps, 1, [], seededRng(7));
    const impId = round.imposterIds[0];
    const res = resolveRound(round, ps, votesFor(ps, impId));
    expect(res.winningSide).toBe("players");
    expect(res.imposters[0].caught).toBe(true);
    expect(res.winners).not.toContain(impId);
  });

  it("imposters win when the imposter scrapes below the catch threshold", () => {
    const ps = players(6);
    const round = buildRound(ps, 1, [], seededRng(8));
    const impId = round.imposterIds[0];
    const innocent = ps.find((p) => p.id !== impId)!;
    // Only one vote on the imposter — well below ceil(6/2) = 3.
    const votes: SoloVote[] = ps.map((v) => ({
      voterId: v.id,
      targetId: v.id === ps[0].id ? impId : innocent.id,
    }));
    const res = resolveRound(round, ps, votes);
    expect(res.winningSide).toBe("imposters");
    expect(res.imposters[0].caught).toBe(false);
    expect(res.winners).toContain(impId);
  });

  it("tallies a sorted vote breakdown", () => {
    const ps = players(5);
    const round = buildRound(ps, 1, [], seededRng(9));
    const res = resolveRound(round, ps, votesFor(ps, ps[2].id));
    expect(res.voteBreakdown[0].targetId).toBe(ps[2].id);
    expect(res.voteBreakdown[0].votes).toBe(5);
  });
});
