import mongoose, { Schema, model, models, type Model } from "mongoose";
import type { GamePhase, PlayerRole } from "@/lib/game/types";

/**
 * A player inside a room. SECRET FIELDS (`role`, `word`, `hint`) live here on
 * the server only and are NEVER included in the client snapshot. The snapshot
 * builder (server/game/snapshot.ts) explicitly constructs a public projection.
 */
export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatar: string;
  isHost: boolean;
  connected: boolean;
  /** When they last dropped (transient disconnect). Drives grace-based host handoff. */
  disconnectedAt: Date | null;
  joinedAt: Date;
  roundsWon: number;

  /** Computer player (filled empty slot). Shown with an "AI" badge; never host. */
  isAI: boolean;
  /** Personality id for AI players (drives their clues/votes/chat). Null for humans. */
  personality: string | null;

  // ---- SECRET (server-only) ----
  role: PlayerRole | null;
  word: string | null; // real word (normal players only)
  hint: string | null; // imposter hint (imposters only)
  hasVoted: boolean;
  votedFor: string[]; // userIds this player voted for (one per imposter)
}

/**
 * A chat message in the room. Persisted so late-joiners / refreshers hydrate the
 * conversation. `scope` segregates lobby chatter, in-round table talk and
 * spectator commentary. Reactions are emoji -> the userIds who reacted.
 */
export interface RoomMessage {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  isAI: boolean;
  text: string;
  at: Date;
  /** Message id this one replies to, if any. */
  replyTo: string | null;
  reactions: { emoji: string; userIds: string[] }[];
  scope: "lobby" | "table" | "spectator";
  /** Round the message was sent in (0 = lobby). Server-only; used to gate AI chat. */
  round: number;
}

export interface RoomDoc extends mongoose.Document {
  code: string;
  hostId: string;
  phase: GamePhase;
  round: number;
  settings: {
    maxPlayers: number;
    imposterCount: number;
    durationSeconds: number;
  };
  players: RoomPlayer[];
  messages: RoomMessage[];

  // ---- current round secret context ----
  currentCategory: string | null;
  timerEndsAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const RoomPlayerSchema = new Schema<RoomPlayer>(
  {
    userId: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: { type: String, required: true },
    isHost: { type: Boolean, default: false },
    connected: { type: Boolean, default: true },
    disconnectedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: () => new Date() },
    roundsWon: { type: Number, default: 0 },
    isAI: { type: Boolean, default: false },
    personality: { type: String, default: null },
    role: { type: String, enum: ["player", "imposter", null], default: null },
    word: { type: String, default: null },
    hint: { type: String, default: null },
    hasVoted: { type: Boolean, default: false },
    votedFor: { type: [String], default: [] },
  },
  { _id: false },
);

const RoomMessageSchema = new Schema<RoomMessage>(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, required: true },
    isAI: { type: Boolean, default: false },
    text: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
    replyTo: { type: String, default: null },
    reactions: {
      type: [{ emoji: String, userIds: [String], _id: false }],
      default: [],
    },
    scope: { type: String, enum: ["lobby", "table", "spectator"], default: "lobby" },
    round: { type: Number, default: 0 },
  },
  { _id: false },
);

const RoomSchema = new Schema<RoomDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    hostId: { type: String, required: true },
    phase: {
      type: String,
      enum: ["lobby", "role", "discussion", "voting", "reveal", "ended"],
      default: "lobby",
    },
    round: { type: Number, default: 0 },
    settings: {
      maxPlayers: { type: Number, default: 8 },
      imposterCount: { type: Number, default: 1 },
      durationSeconds: { type: Number, default: 120 },
    },
    players: { type: [RoomPlayerSchema], default: [] },
    messages: { type: [RoomMessageSchema], default: [] },
    currentCategory: { type: String, default: null },
    timerEndsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Auto-expire abandoned rooms after 12 hours of inactivity.
RoomSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 12 });

export const Room: Model<RoomDoc> =
  (models.Room as Model<RoomDoc>) || model<RoomDoc>("Room", RoomSchema);
