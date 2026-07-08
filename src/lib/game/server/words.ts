// Server-side word picker. Prefers the DB (seeded), falls back to the bundled
// dataset so the game is playable even before running the seed script.

import { Word } from "@/lib/db/models/Word";
import { WORDS, type WordEntry } from "@/lib/data/words";

let bundledIndex = 0;

/** Pick a random word, avoiding an optional list of recently-used words. */
export async function pickWord(exclude: string[] = []): Promise<WordEntry> {
  const excludeSet = new Set(exclude.map((w) => w.toLowerCase()));

  try {
    const count = await Word.estimatedDocumentCount();
    if (count > 0) {
      // Try a few random samples to avoid repeats without a heavy query.
      for (let attempt = 0; attempt < 6; attempt++) {
        const [doc] = await Word.aggregate([{ $sample: { size: 1 } }]);
        if (doc && !excludeSet.has(String(doc.word).toLowerCase())) {
          return { word: doc.word, imposterHint: doc.imposterHint, category: doc.category };
        }
      }
    }
  } catch (err) {
    // DB not available — fall through to bundled words.
    console.warn("[words] DB pick failed, using bundled dataset:", (err as Error).message);
  }

  // Bundled fallback — cycle through with a rotating index + exclusion.
  const pool = WORDS.filter((w) => !excludeSet.has(w.word.toLowerCase()));
  const source = pool.length ? pool : WORDS;
  bundledIndex = (bundledIndex + 1 + Math.floor(Math.random() * source.length)) % source.length;
  return source[bundledIndex];
}
