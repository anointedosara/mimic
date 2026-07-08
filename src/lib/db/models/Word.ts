import mongoose, { Schema, model, models, type Model } from "mongoose";

export interface WordDoc extends mongoose.Document {
  word: string;
  imposterHint: string;
  category: string;
}

const WordSchema = new Schema<WordDoc>({
  word: { type: String, required: true, trim: true },
  imposterHint: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, index: true },
});

// Prevent duplicate word entries.
WordSchema.index({ word: 1, category: 1 }, { unique: true });

export const Word: Model<WordDoc> =
  (models.Word as Model<WordDoc>) || model<WordDoc>("Word", WordSchema);
