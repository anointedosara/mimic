// TEMP read-only: list all user accounts so we can confirm before deleting.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import mongoose from "mongoose";
import { User } from "../src/lib/db/models/User";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ MONGODB_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const users = await User.find({}, { displayName: 1, email: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();
  console.log(`Total accounts: ${users.length}`);
  for (const u of users) {
    console.log(
      `  • ${u.displayName}  <${u.email}>  created ${new Date(u.createdAt as unknown as string).toISOString()}  _id=${u._id}`,
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Failed:", e);
  process.exit(1);
});
