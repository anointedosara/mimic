// Game-wide constants and helpers for validating room configuration.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;

export const DURATION_PRESETS = [60, 120, 180, 300] as const;
export const MIN_CUSTOM_DURATION = 30;
export const MAX_CUSTOM_DURATION = 900;

export const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  imposterCount: 1,
  durationSeconds: 120,
};

/** Max imposters allowed for a given player capacity: 1..floor(n/3). */
export function maxImposters(players: number): number {
  return Math.max(1, Math.floor(players / 3));
}

/** Clamp / validate imposter count for a player capacity. */
export function clampImposters(imposterCount: number, players: number): number {
  const max = maxImposters(players);
  if (!Number.isFinite(imposterCount)) return 1;
  return Math.min(Math.max(1, Math.round(imposterCount)), max);
}

export function clampPlayers(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.maxPlayers;
  return Math.min(Math.max(MIN_PLAYERS, Math.round(n)), MAX_PLAYERS);
}

export function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_SETTINGS.durationSeconds;
  return Math.min(Math.max(MIN_CUSTOM_DURATION, Math.round(seconds)), MAX_CUSTOM_DURATION);
}

/** Room codes: unambiguous uppercase alphabet (no O/0, I/1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
