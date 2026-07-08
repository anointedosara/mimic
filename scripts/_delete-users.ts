// TEMP: delete the four user accounts by _id.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { User } from "../src/lib/db/models/User";

const IDS = [
  "6a4e2fe06c5967f8c1029243",
  "6a4e40bb19279488faa5c07b",
  "6a4e425e19279488faa5c087",
  "6a4e42b419279488faa5c08d",
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ MONGODB_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const res = await User.deleteMany({ _id: { $in: IDS } });
  console.log(`✓ Deleted ${res.deletedCount} account(s).`);
  const remaining = await User.estimatedDocumentCount();
  console.log(`  Remaining accounts: ${remaining}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Failed:", e);
  process.exit(1);
});
