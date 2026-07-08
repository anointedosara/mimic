import { describe, it, expect } from "vitest";
import { buildRound, pickWord, resolveRound } from "./engine";
import type { PassPlayer } from "./types";

// Deterministic RNG for reproducible tests.
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const players = (n: number): PassPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: "fox" }));

describe("pickWord", () => {
  it("returns a bundled word entry", () => {
    const w = pickWord([], seededRng(1));
    expect(w.word).toBeTruthy();
    expect(w.imposterHint).toBeTruthy();
    expect(w.category).toBeTruthy();
  });

  it("avoids excluded words when possible", () => {
    const first = pickWord([], seededRng(5));
    const second = pickWord([first.word], seededRng(5));
    expect(second.word.toLowerCase()).not.toBe(first.word.toLowerCase());
  });
});

describe("buildRound", () => {
  it("assigns the requested imposter count and a role for every player", () => {
    const ps = players(6);
    const round = buildRound(ps, 2, [], seededRng(2));
    expect(round.imposterIds).toHaveLength(2);
    for (const p of ps) expect(round.roles[p.id]).toMatch(/player|imposter/);
  });

  it("clamps imposter count so not everyone is an imposter", () => {
    const ps = players(3);
    const round = buildRound(ps, 10, [], seededRng(3));
    expect(round.imposterIds.length).toBeLessThan(ps.length);
    expect(round.imposterIds.length).toBeGreaterThanOrEqual(1);
  });

  it("produces a view order that is a permutation of all players", () => {
    const ps = players(5);
    const round = buildRound(ps, 1, [], seededRng(4));
    expect([...round.viewOrder].sort()).toEqual(ps.map((p) => p.id).sort());
  });
});

describe("resolveRound", () => {
  it("players win only when every imposter is accused", () => {
    const ps = players(6);
    const round = buildRound(ps, 2, [], seededRng(7));
    expect(round.imposterIds).toHaveLength(2);
    const all = resolveRound(round, ps, round.imposterIds);
    expect(all.winningSide).toBe("players");
    expect(all.imposters.every((i) => i.caught)).toBe(true);
  });

  it("imposters win when one escapes", () => {
    const ps = players(6);
    const round = buildRound(ps, 2, [], seededRng(8));
    expect(round.imposterIds).toHaveLength(2);
    // Accuse only the first imposter and one innocent.
    const innocent = ps.find((p) => !round.imposterIds.includes(p.id))!;
    const res = resolveRound(round, ps, [round.imposterIds[0], innocent.id]);
    expect(res.winningSide).toBe("imposters");
    expect(res.imposters.some((i) => !i.caught)).toBe(true);
  });

  it("marks the accused imposter as caught and echoes word + hint", () => {
    const ps = players(4);
    const round = buildRound(ps, 1, [], seededRng(9));
    const res = resolveRound(round, ps, [round.imposterIds[0]]);
    expect(res.realWord).toBe(round.word);
    expect(res.imposterHint).toBe(round.imposterHint);
    expect(res.imposters[0].caught).toBe(true);
  });
});
