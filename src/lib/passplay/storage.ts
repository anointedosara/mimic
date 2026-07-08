// ============================================================================
// Local persistence for Pass & Play. Player rosters and named templates are
// stored in localStorage so a group can reuse their names in future games.
// SSR-safe (guards `window`) and namespaced under "mimic:passplay:*".
// ============================================================================

import type { PassPlayer } from "./types";

const ROSTER_KEY = "mimic:passplay:roster";
const TEMPLATES_KEY = "mimic:passplay:templates";

/** A saved, named player list. */
export interface PlayerTemplate {
  id: string;
  name: string;
  players: PassPlayer[];
}

/** Stable local id — crypto.randomUUID with a safe fallback. */
export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / privacy mode — ignore, game still works in-memory */
  }
}

/** The most-recent roster, so setup can prefill last game's players. */
export function loadRoster(): PassPlayer[] {
  return read<PassPlayer[]>(ROSTER_KEY, []);
}

export function saveRoster(players: PassPlayer[]): void {
  write(ROSTER_KEY, players);
}

/** All saved templates. */
export function loadTemplates(): PlayerTemplate[] {
  return read<PlayerTemplate[]>(TEMPLATES_KEY, []);
}

/** Create or overwrite a template by name; returns the updated list. */
export function saveTemplate(name: string, players: PassPlayer[]): PlayerTemplate[] {
  const trimmed = name.trim();
  if (!trimmed) return loadTemplates();
  const templates = loadTemplates();
  const existing = templates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  // Store copies so later roster edits don't mutate the saved template.
  const players2 = players.map((p) => ({ ...p }));
  let next: PlayerTemplate[];
  if (existing) {
    next = templates.map((t) => (t.id === existing.id ? { ...t, players: players2 } : t));
  } else {
    next = [...templates, { id: makeId(), name: trimmed, players: players2 }];
  }
  write(TEMPLATES_KEY, next);
  return next;
}

/** Delete a template by id; returns the updated list. */
export function deleteTemplate(id: string): PlayerTemplate[] {
  const next = loadTemplates().filter((t) => t.id !== id);
  write(TEMPLATES_KEY, next);
  return next;
}
