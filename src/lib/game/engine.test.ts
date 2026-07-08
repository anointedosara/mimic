import { describe, it, expect } from "vitest";
import { assignRoles, resolveRound, tallyVotes, shuffle } from "./engine";
import type { PublicVote } from "./types";

// Deterministic RNG for reproducible tests.
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("assignRoles", () => {
  it("assigns exactly the requested number of imposters", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const { roles, imposterIds } = assignRoles(ids, 2, seededRng(1));
    expect(imposterIds).toHaveLength(2);
    const imposters = Object.values(roles).filter((r) => r === "imposter");
    expect(imposters).toHaveLength(2);
  });

  it("never makes everyone an imposter", () => {
    const ids = ["a", "b", "c"];
    const { imposterIds } = assignRoles(ids, 5, seededRng(2));
    expect(imposterIds.length).toBeLessThan(ids.length);
    expect(imposterIds.length).toBeGreaterThanOrEqual(1);
  });

  it("gives every player a role", () => {
    const ids = ["a", "b", "c", "d"];
    const { roles } = assignRoles(ids, 1, seededRng(3));
    for (const id of ids) expect(roles[id]).toMatch(/player|imposter/);
  });

  it("does not leak imposter identities into the role values", () => {
    // Roles map only says player/imposter — it is server-only, but even so the
    // value carries no reference to *which other* players are imposters.
    const ids = ["a", "b", "c", "d", "e"];
    const { roles } = assignRoles(ids, 2, seededRng(4));
    expect(Object.values(roles).every((r) => r === "player" || r === "imposter")).toBe(true);
  });
});

describe("shuffle", () => {
  it("keeps all elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, seededRng(9));
    expect(out.sort()).toEqual(arr);
  });
});

describe("tallyVotes", () => {
  it("counts votes per target", () => {
    const votes: PublicVote[] = [
      { voterId: "a", voterName: "A", targetId: "x", targetName: "X" },
      { voterId: "b", voterName: "B", targetId: "x", targetName: "X" },
      { voterId: "c", voterName: "C", targetId: "y", targetName: "Y" },
    ];
    const counts = tallyVotes(votes);
    expect(counts.get("x")).toBe(2);
    expect(counts.get("y")).toBe(1);
  });
});

describe("resolveRound", () => {
  const players = [
    { userId: "imp", displayName: "Imp", avatar: "fox" },
    { userId: "p1", displayName: "P1", avatar: "cat" },
    { userId: "p2", displayName: "P2", avatar: "owl" },
    { userId: "p3", displayName: "P3", avatar: "bee" },
  ];

  it("marks the imposter caught when the majority votes for them", () => {
    const votes: PublicVote[] = [
      { voterId: "p1", voterName: "P1", targetId: "imp", targetName: "Imp" },
      { voterId: "p2", voterName: "P2", targetId: "imp", targetName: "Imp" },
      { voterId: "p3", voterName: "P3", targetId: "imp", targetName: "Imp" },
      { voterId: "imp", voterName: "Imp", targetId: "p1", targetName: "P1" },
    ];
    const res = resolveRound({
      votes,
      imposterIds: ["imp"],
      players,
      realWord: "Pizza",
      imposterHint: "Cheese",
      category: "Food",
      voterCount: 4,
    });
    expect(res.imposters[0].caught).toBe(true);
    expect(res.winningSide).toBe("players");
    expect(res.winners).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
  });

  it("lets the imposter escape when votes are scattered", () => {
    const votes: PublicVote[] = [
      { voterId: "p1", voterName: "P1", targetId: "p2", targetName: "P2" },
      { voterId: "p2", voterName: "P2", targetId: "p3", targetName: "P3" },
      { voterId: "p3", voterName: "P3", targetId: "p1", targetName: "P1" },
      { voterId: "imp", voterName: "Imp", targetId: "p1", targetName: "P1" },
    ];
    const res = resolveRound({
      votes,
      imposterIds: ["imp"],
      players,
      realWord: "Pizza",
      imposterHint: "Cheese",
      category: "Food",
      voterCount: 4,
    });
    expect(res.imposters[0].caught).toBe(false);
    expect(res.winningSide).toBe("imposters");
    expect(res.winners).toEqual(["imp"]);
  });

  it("requires ALL imposters caught for players to win", () => {
    const votes: PublicVote[] = [
      { voterId: "p1", voterName: "P1", targetId: "imp", targetName: "Imp" },
      { voterId: "p2", voterName: "P2", targetId: "imp", targetName: "Imp" },
      { voterId: "p3", voterName: "P3", targetId: "imp", targetName: "Imp" },
    ];
    const res = resolveRound({
      votes,
      imposterIds: ["imp", "p3"], // p3 is a second imposter who was NOT caught
      players,
      realWord: "Pizza",
      imposterHint: "Cheese",
      category: "Food",
      voterCount: 3,
    });
    expect(res.winningSide).toBe("imposters");
  });
});
