import { describe, it, expect } from "vitest";
import { maxImposters, clampImposters, clampPlayers, clampDuration } from "./config";
import { WORDS, WORD_COUNT } from "@/lib/data/words";

describe("maxImposters", () => {
  it.each([
    [3, 1],
    [5, 1],
    [6, 2],
    [8, 2],
    [9, 3],
    [12, 4],
    [15, 5],
    [20, 6],
  ])("players=%i -> maxImposters=%i", (players, expected) => {
    expect(maxImposters(players)).toBe(expected);
  });
});

describe("clampImposters", () => {
  it("never exceeds the max for the player count", () => {
    expect(clampImposters(6, 6)).toBe(2);
    expect(clampImposters(0, 6)).toBe(1);
    expect(clampImposters(3, 20)).toBe(3);
  });
});

describe("clampPlayers", () => {
  it("keeps players within 3..20", () => {
    expect(clampPlayers(1)).toBe(3);
    expect(clampPlayers(25)).toBe(20);
    expect(clampPlayers(10)).toBe(10);
  });
});

describe("clampDuration", () => {
  it("keeps duration within 30..900", () => {
    expect(clampDuration(5)).toBe(30);
    expect(clampDuration(5000)).toBe(900);
    expect(clampDuration(120)).toBe(120);
  });
});

describe("word database", () => {
  it("contains at least 500 words", () => {
    expect(WORD_COUNT).toBeGreaterThanOrEqual(500);
  });

  it("every word has a hint and category", () => {
    for (const w of WORDS) {
      expect(w.word.length).toBeGreaterThan(0);
      expect(w.imposterHint.length).toBeGreaterThan(0);
      expect(w.category.length).toBeGreaterThan(0);
    }
  });

  it("hints are never identical to the word", () => {
    for (const w of WORDS) {
      expect(w.imposterHint.toLowerCase()).not.toBe(w.word.toLowerCase());
    }
  });
});
