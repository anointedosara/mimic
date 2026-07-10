"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send,
  Bot,
  ChevronDown,
  MessagesSquare,
  Smile,
  Reply,
  X,
  Eye,
  SmilePlus,
} from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chatActions } from "@/hooks/use-room";
import { useGameStore } from "@/store/game-store";
import { useChatStore, activeTypers } from "@/store/chat-store";
import type { ChatMessage } from "@/lib/game/types";

/** Stable empty reference — a zustand selector must never return a fresh []. */
const NO_MESSAGES: ChatMessage[] = [];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const EMOJI_PICKER = [
  "😀", "😂", "😅", "😊", "😍", "😎", "🤔", "🤨",
  "😐", "😏", "😢", "😭", "😱", "😴", "🤯", "🥳",
  "😈", "👻", "💀", "🤖", "👀", "👍", "👎", "👏",
  "🙌", "🙏", "💪", "🔥", "✨", "🎉", "❤️", "💔",
  "❓", "❗", "💯", "🚩", "🕵️", "🤐", "🤝", "🧠",
];

/** Compact relative timestamp, with the exact time as a tooltip title. */
function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Full-featured room chat: emoji picker, timestamps, reply-to, reactions, a live
 * typing indicator, an unread badge and near-bottom auto-follow. Backed by the
 * authoritative room snapshot (messages) + a small client store (typing/reply).
 */
export function RoomChat({ code, selfId }: { code: string; selfId: string }) {
  // Select the raw (possibly-undefined) array — both branches are stable
  // references — and default OUTSIDE the selector so it never returns a fresh [].
  const messages = useGameStore((s) => s.snapshot?.messages) ?? NO_MESSAGES;
  const typing = useChatStore((s) => s.typing);
  const replyTo = useChatStore((s) => s.replyTo);
  const setReplyTo = useChatStore((s) => s.setReplyTo);

  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seen, setSeen] = useState(0);

  const feedRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-render every second so relative timestamps + typing TTLs stay fresh.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const typers = activeTypers(typing, selfId);
  const replyMsg = replyTo ? byId.get(replyTo) : null;
  const unread = Math.max(0, messages.length - seen);

  function handleScroll() {
    const el = feedRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAtBottom(bottom);
    if (bottom) setSeen(messages.length);
  }
  function jumpToLatest() {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setAtBottom(true);
    setSeen(messages.length);
  }

  // Auto-follow when already at the bottom; otherwise leave the unread badge.
  useEffect(() => {
    if (atBottom) {
      const el = feedRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setSeen(messages.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typers.length]);

  function pingTyping() {
    const now = Date.now();
    if (now - lastTypingPing.current > 1500) {
      lastTypingPing.current = now;
      void chatActions.typing(code);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setPickerOpen(false);
    const reply = replyTo;
    setReplyTo(null);
    const res = await chatActions.send(code, text, reply);
    if (!res.ok) {
      // Restore the draft so a dropped send isn't silently lost.
      setDraft(text);
      setReplyTo(reply);
    }
  }

  function toggleReaction(messageId: string, emoji: string) {
    setReactFor(null);
    void chatActions.react(code, messageId, emoji);
  }

  return (
    <div className="glass flex flex-col rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <MessagesSquare className="h-4 w-4" /> Chat
        </h3>
        {unread > 0 && !atBottom && (
          <button
            onClick={jumpToLatest}
            className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
          >
            {unread} new
          </button>
        )}
      </div>

      {/* Feed */}
      <div className="relative">
        <div
          ref={feedRef}
          onScroll={handleScroll}
          className="h-[42vh] min-h-[240px] space-y-1.5 overflow-y-auto p-3"
        >
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <div className="text-3xl">💬</div>
                <p className="mt-2">No messages yet. Say hi 👋</p>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                msg={m}
                mine={m.userId === selfId}
                replied={m.replyTo ? byId.get(m.replyTo) ?? null : null}
                selfId={selfId}
                reactOpen={reactFor === m.id}
                onOpenReact={() => setReactFor((cur) => (cur === m.id ? null : m.id))}
                onReact={(emoji) => toggleReaction(m.id, emoji)}
                onReply={() => {
                  setReplyTo(m.id);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </AnimatePresence>
        </div>

        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
          >
            <ChevronDown className="h-4 w-4" /> Latest
          </button>
        )}
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 text-xs text-muted-foreground">
        <AnimatePresence>
          {typers.length > 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1"
            >
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1 w-1 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </span>
              {typers.length === 1
                ? `${typers[0]} is typing…`
                : typers.length === 2
                  ? `${typers[0]} and ${typers[1]} are typing…`
                  : `${typers.length} people are typing…`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mx-3 flex items-center gap-2 overflow-hidden rounded-lg border-l-2 border-primary bg-white/[0.04] px-3 py-1.5 text-xs"
          >
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">
                {replyMsg.userId === selfId ? "You" : replyMsg.name}
              </span>
              <span className="ml-1 truncate text-muted-foreground">{replyMsg.text}</span>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="relative flex items-center gap-2 p-3">
        {pickerOpen && (
          <>
            <button
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close emoji picker"
              onClick={() => setPickerOpen(false)}
            />
            <div className="absolute bottom-14 left-3 z-20 grid w-64 grid-cols-8 gap-0.5 rounded-2xl border border-white/10 bg-popover p-2 shadow-xl">
              {EMOJI_PICKER.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setDraft((d) => d + e);
                    inputRef.current?.focus();
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
            pickerOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5",
          )}
          aria-label="Emoji picker"
        >
          <Smile className="h-5 w-5" />
        </button>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            pingTyping();
          }}
          onKeyDown={(e) => e.key === "Enter" && send()}
          maxLength={300}
          placeholder="Message the room…"
          aria-label="Chat message"
          className="h-10"
        />
        <Button variant="gradient" className="h-10 shrink-0" onClick={send} disabled={!draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  mine,
  replied,
  selfId,
  reactOpen,
  onOpenReact,
  onReact,
  onReply,
}: {
  msg: ChatMessage;
  mine: boolean;
  replied: ChatMessage | null;
  selfId: string;
  reactOpen: boolean;
  onOpenReact: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
}) {
  const isSpectator = msg.scope === "spectator";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}
    >
      {!mine && <AvatarDisplay avatar={msg.avatar} size="xs" ring={false} />}
      <div className={cn("relative max-w-[78%]", mine && "text-right")}>
        <div
          className={cn(
            "mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground",
            mine && "flex-row-reverse",
          )}
        >
          <span className="font-semibold text-foreground/80">{mine ? "You" : msg.name}</span>
          {msg.isAI && (
            <Badge variant="outline" className="gap-0.5 px-1 py-0 text-[9px]">
              <Bot className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
          {isSpectator && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/70">
              <Eye className="h-2.5 w-2.5" /> spectator
            </span>
          )}
          <span title={new Date(msg.at).toLocaleTimeString()}>{timeAgo(msg.at)}</span>
        </div>

        {/* Replied-to preview */}
        {replied && (
          <div
            className={cn(
              "mb-1 max-w-full truncate rounded-lg border-l-2 border-primary/60 bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground",
              mine && "ml-auto",
            )}
          >
            <span className="font-semibold">
              {replied.userId === selfId ? "You" : replied.name}:
            </span>{" "}
            {replied.text}
          </div>
        )}

        <div className={cn("flex items-end gap-1", mine && "flex-row-reverse")}>
          <div
            className={cn(
              "inline-block break-words rounded-2xl px-3 py-2 text-sm",
              mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-white/[0.06]",
              isSpectator && "opacity-75",
            )}
          >
            {msg.text}
          </div>

          {/* Hover actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onReply}
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onOpenReact}
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="React"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick-reaction row */}
        <AnimatePresence>
          {reactOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "absolute z-20 mt-1 flex gap-0.5 rounded-full border border-white/10 bg-popover p-1 shadow-xl",
                mine ? "right-0" : "left-0",
              )}
            >
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => onReact(e)}
                  className="grid h-7 w-7 place-items-center rounded-full text-base hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction chips */}
        {msg.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {msg.reactions.map((r) => {
              const reacted = r.userIds.includes(selfId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onReact(r.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                    reacted
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/10",
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
