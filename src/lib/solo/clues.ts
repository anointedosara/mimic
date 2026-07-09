// ============================================================================
// Clue generation for Solo Mode's clue phase.
//
// The game plays like a word-association round: each player gives ONE clue word
// tied to their secret. Knowers know the real word and clue on its category
// theme; imposters know only the hint and must blend — smarter (harder) AIs
// blend more often, weaker ones "whiff" with a vague/off word that gives them
// away. A whiff is the visible tell voting keys off of.
//
// No LLM: clues come from per-category pools. Deterministic when an rng is
// injected (see clues.test.ts).
// ============================================================================

import type { Difficulty } from "./types";

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// On-theme clue words per category. A knower picks from their word's category;
// a blending imposter (who also knows the category) picks from here too.
// ---------------------------------------------------------------------------
const CATEGORY_CLUES: Record<string, string[]> = {
  Food: ["tasty", "kitchen", "dinner", "flavor", "snack", "plate", "recipe", "hungry", "meal", "delicious", "cooked", "bite"],
  Animals: ["wild", "furry", "roar", "paws", "creature", "zoo", "tail", "hunt", "beast", "claws", "pack", "instinct"],
  Movies: ["screen", "actor", "scene", "plot", "cinema", "sequel", "trailer", "director", "drama", "blockbuster", "role", "ending"],
  Sports: ["team", "score", "match", "athlete", "coach", "victory", "training", "arena", "compete", "champion", "referee", "play"],
  Technology: ["device", "screen", "digital", "code", "gadget", "update", "wireless", "software", "circuit", "smart", "battery", "app"],
  Countries: ["nation", "flag", "border", "capital", "culture", "language", "travel", "map", "passport", "region", "citizens", "abroad"],
  Professions: ["career", "uniform", "skilled", "office", "expert", "shift", "salary", "training", "duty", "workplace", "trade", "boss"],
  Nature: ["outdoors", "wild", "green", "scenic", "peaceful", "landscape", "fresh", "growth", "trail", "earthy", "quiet", "seasons"],
  Music: ["rhythm", "melody", "beat", "concert", "sound", "tune", "lyrics", "band", "volume", "chorus", "stage", "notes"],
  Household: ["home", "cozy", "clean", "everyday", "room", "furniture", "handy", "domestic", "shelf", "tidy", "chore", "comfort"],
  Body: ["human", "anatomy", "muscle", "physical", "bone", "healthy", "movement", "organ", "reflex", "nerve", "flesh", "pulse"],
  Clothing: ["wear", "fabric", "style", "outfit", "fashion", "closet", "warm", "fitted", "cotton", "layer", "dress", "trendy"],
  Vehicles: ["ride", "engine", "wheels", "road", "speed", "travel", "motor", "drive", "fuel", "transport", "fast", "commute"],
  Space: ["cosmic", "orbit", "distant", "starry", "galaxy", "vast", "gravity", "celestial", "launch", "infinite", "glow", "void"],
  Mythology: ["legend", "ancient", "myth", "godly", "epic", "hero", "sacred", "fabled", "power", "curse", "prophecy", "immortal"],
  Games: ["play", "fun", "win", "score", "board", "rules", "turn", "challenge", "level", "player", "compete", "strategy"],
  Weather: ["sky", "forecast", "climate", "outside", "cold", "warm", "seasonal", "damp", "breeze", "storm", "conditions", "temperature"],
  Drinks: ["sip", "refreshing", "thirsty", "glass", "cold", "pour", "liquid", "flavor", "chilled", "bottle", "drink", "brew"],
  School: ["learn", "class", "lesson", "study", "teacher", "exam", "homework", "grade", "student", "pencil", "desk", "subject"],
  Places: ["visit", "location", "destination", "spot", "landmark", "scenic", "crowd", "busy", "map", "trip", "venue", "explore"],
  Fruit: ["fresh", "sweet", "juicy", "ripe", "orchard", "peel", "healthy", "snack", "seed", "market", "vitamin", "tasty"],
  Tools: ["fix", "handy", "workshop", "sharp", "metal", "grip", "build", "garage", "repair", "sturdy", "project", "useful"],
  Vegetables: ["fresh", "garden", "healthy", "green", "leafy", "crunchy", "market", "harvest", "raw", "nutritious", "salad", "grow"],
  Dessert: ["sweet", "sugary", "treat", "bakery", "indulgent", "creamy", "frosting", "delicious", "rich", "yummy", "celebrate", "craving"],
  Insects: ["tiny", "buzz", "crawl", "wings", "swarm", "bug", "legs", "backyard", "sting", "antenna", "creepy", "flutter"],
  Flowers: ["petals", "bloom", "spring", "fragrant", "garden", "colorful", "bouquet", "stem", "pretty", "pollen", "vase", "delicate"],
  Gemstones: ["shiny", "precious", "sparkle", "jewel", "rare", "polished", "facets", "valuable", "glimmer", "carat", "treasure", "brilliant"],
  Camping: ["outdoors", "tent", "campfire", "woods", "backpack", "wilderness", "trail", "nature", "getaway", "sleeping", "lantern", "rustic"],
  Ocean: ["deep", "waves", "salty", "blue", "tide", "marine", "shore", "current", "vast", "coastal", "seaweed", "dive"],
};

const GENERIC_CLUES = ["common", "typical", "normal", "everyday", "familiar", "regular", "ordinary", "classic"];

// Vague / off words an imposter reaches for when they whiff — the visible tell.
const VAGUE_CLUES = ["thing", "stuff", "object", "nice", "interesting", "unsure", "hmm", "basic", "whatever", "something"];

function themePool(category: string): string[] {
  return CATEGORY_CLUES[category] ?? GENERIC_CLUES;
}

/** How likely an AI imposter of a given difficulty blends in (vs. whiffs). */
function imposterBlend(difficulty: Difficulty, rng: () => number): number {
  switch (difficulty) {
    case "easy":
      return 0.4;
    case "medium":
      return 0.6;
    case "hard":
      return 0.85;
    case "chaos":
      return 0.3 + rng() * 0.6;
  }
}

export interface GeneratedClue {
  word: string;
  /** True when an imposter reached for a vague/off word — the visible tell. */
  whiff: boolean;
}

/**
 * Generate one clue word for a player. Knowers always clue on-theme. Imposters
 * blend (on-theme) with a difficulty-dependent probability, else whiff with a
 * vague/off word. `used` lists words already said, to reduce duplicates.
 */
export function generateClue(params: {
  isImposter: boolean;
  category: string;
  difficulty: Difficulty;
  used?: string[];
  rng?: () => number;
}): GeneratedClue {
  const { isImposter, category, difficulty, used = [], rng = Math.random } = params;
  const usedSet = new Set(used.map((w) => w.toLowerCase()));

  const fromPool = (pool: string[]): string => {
    const fresh = pool.filter((w) => !usedSet.has(w.toLowerCase()));
    return pick(fresh.length ? fresh : pool, rng);
  };

  if (!isImposter) {
    return { word: fromPool(themePool(category)), whiff: false };
  }

  // Imposter: blend on-theme, or whiff with a vague / off-category word.
  if (rng() < imposterBlend(difficulty, rng)) {
    return { word: fromPool(themePool(category)), whiff: false };
  }
  const offCategory = rng() < 0.5;
  const pool = offCategory
    ? themePool(pick(Object.keys(CATEGORY_CLUES).filter((c) => c !== category), rng))
    : VAGUE_CLUES;
  return { word: fromPool(pool), whiff: true };
}

/** Exposed for tests / previews. */
export const CLUE_CATEGORIES = Object.keys(CATEGORY_CLUES);
