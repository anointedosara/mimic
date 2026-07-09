import { describe, it, expect } from "vitest";
import { generateClue } from "./clues";

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("generateClue", () => {
  it("returns a non-empty clue word", () => {
    const c = generateClue({ isImposter: false, category: "Food", difficulty: "medium", rng: seededRng(1) });
    expect(c.word.length).toBeGreaterThan(0);
  });

  it("knowers never whiff", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateClue({ isImposter: false, category: "Animals", difficulty: "easy", rng: seededRng(i + 1) });
      expect(c.whiff).toBe(false);
    }
  });

  it("easy imposters whiff more often than hard imposters", () => {
    function whiffRate(difficulty: "easy" | "hard"): number {
      let whiffs = 0;
      const N = 500;
      for (let i = 0; i < N; i++) {
        const c = generateClue({ isImposter: true, category: "Food", difficulty, rng: seededRng(i + 1) });
        if (c.whiff) whiffs++;
      }
      return whiffs / N;
    }
    expect(whiffRate("easy")).toBeGreaterThan(whiffRate("hard"));
  });

  it("never leaks anything resembling the category name itself", () => {
    // Clue words are generic theme words, not the category label.
    const c = generateClue({ isImposter: false, category: "Food", difficulty: "medium", rng: seededRng(3) });
    expect(c.word.toLowerCase()).not.toBe("food");
  });
});
