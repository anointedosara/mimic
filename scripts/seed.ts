// Seed the MongoDB `words` collection from the bundled dataset.
// Usage: npm run seed

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { Word } from "../src/lib/db/models/Word";
import { WORDS, WORD_CATEGORIES } from "../src/lib/data/words";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ MONGODB_URI is not set. Add it to .env.local");
    process.exit(1);
  }

  console.log("→ Connecting to MongoDB…");
  await mongoose.connect(uri);

  console.log(`→ Clearing existing words…`);
  await Word.deleteMany({});

  console.log(`→ Inserting ${WORDS.length} words across ${WORD_CATEGORIES.length} categories…`);
  // insertMany with ordered:false so a stray duplicate won't abort the batch.
  await Word.insertMany(WORDS, { ordered: false }).catch((e) => {
    if (e?.writeErrors) {
      console.warn(`  (skipped ${e.writeErrors.length} duplicates)`);
    } else {
      throw e;
    }
  });

  const count = await Word.estimatedDocumentCount();
  console.log(`✓ Done. ${count} words in the database.`);
  console.log(`  Categories: ${WORD_CATEGORIES.join(", ")}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
