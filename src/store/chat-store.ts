"use client";

// ============================================================================
// Lightweight client store for transient chat UI state that doesn't belong in
// the authoritative room snapshot: who's currently typing (auto-expiring), and
// the message the composer is replying to.
// ============================================================================

import { create } from "zustand";

/** How long a typing signal stays "live" after the last keystroke ping. */
export const TYPING_TTL_MS = 3500;

interface TypingEntry {
  name: string;
  at: number;
}

interface ChatState {
  /** userId -> latest typing ping. */
  typing: Record<string, TypingEntry>;
  /** The message id the composer is replying to (null = none). */
  replyTo: string | null;

  noteTyping: (userId: string, name: string) => void;
  setReplyTo: (id: string | null) => void;
  clearRoom: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  typing: {},
  replyTo: null,
  noteTyping: (userId, name) =>
    set((s) => ({ typing: { ...s.typing, [userId]: { name, at: Date.now() } } })),
  setReplyTo: (replyTo) => set({ replyTo }),
  clearRoom: () => set({ typing: {}, replyTo: null }),
}));

/** The names typing within the TTL window, excluding `selfId`. */
export function activeTypers(typing: Record<string, TypingEntry>, selfId: string): string[] {
  const now = Date.now();
  return Object.entries(typing)
    .filter(([id, e]) => id !== selfId && now - e.at < TYPING_TTL_MS)
    .map(([, e]) => e.name);
}
