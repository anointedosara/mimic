import mongoose, { Schema, model, models, type Model } from "mongoose";

export interface UserStatistics {
  gamesPlayed: number;
  wins: number;
  losses: number;
  timesAsImposter: number;
  timesCaught: number;
}

export interface UserDoc extends mongoose.Document {
  displayName: string;
  email: string;
  passwordHash: string;
  avatar: string;
  statistics: UserStatistics;
  createdAt: Date;
  updatedAt: Date;
}

const StatisticsSchema = new Schema<UserStatistics>(
  {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    timesAsImposter: { type: Number, default: 0 },
    timesCaught: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 24 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    avatar: { type: String, required: true, default: "fox" },
    statistics: { type: StatisticsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// Virtual winRate — computed, not stored.
UserSchema.virtual("statistics.winRate").get(function (this: UserDoc) {
  const played = this.statistics?.gamesPlayed ?? 0;
  if (!played) return 0;
  return Math.round((this.statistics.wins / played) * 100);
});

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);
