"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Bot, ChevronDown, MessagesSquare, Eye } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getPersonality } from "@/lib/solo/personalities";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { useTournamentStore, selectActivePlayers, selectHumanActive } from "@/store/tournament-store";
import type { TournamentPlayer } from "@/lib/tournament/types";

/**
 * The shared tournament discussion feed: clue announcements, AI reactions and
 * human/spectator messages, with a typing indicator and near-bottom auto-follow.
 * Eliminated seats are dimmed. Reused across discussion, voting and elimination.
 */
export function ConversationFeed({ heightClass = "h-[44vh] min-h-[300px]" }: { heightClass?: string }) {
  const players = useTournamentStore((s) => s.players);
  const humanId = useTournamentStore((s) => s.humanId);
  const feed = useTournamentStore((s) => s.feed);
  const typingIds = useTournamentStore((s) => s.typingIds);
  const eliminatedIds = useTournamentStore((s) => s.eliminatedIds);

  const [atBottom, setAtBottom] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const eliminated = useMemo(() => new Set(eliminatedIds), [eliminatedIds]);
  const typer = typingIds.length ? byId.get(typingIds[0]) : null;

  function handleScroll() {
    const el = feedRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }
  function jumpToLatest() {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setAtBottom(true);
  }
  useEffect(() => {
    if (!atBottom) return;
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feed, typingIds, atBottom]);

  return (
    <div className="relative">
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className={cn("space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4", heightClass)}
      >
        {feed.length === 0 && !typer && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <div className="text-3xl">💭</div>
              <p className="mt-2">The table is thinking… clues are on their way.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {feed.map((item) => {
            const p = byId.get(item.playerId);
            const mine = item.playerId === humanId;
            const isOut = eliminated.has(item.playerId);
            if (item.kind === "clue") {
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2"
                >
                  {p && <AvatarDisplay avatar={p.avatar} size="sm" dimmed={isOut} />}
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-sm font-semibold">{mine ? "You" : p?.name}</span>
                    <span className="text-xs text-muted-foreground">played</span>
                  </div>
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 font-display text-base font-bold text-amber-200">
                    {item.text}
                  </span>
                </motion.div>
              );
            }
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
              >
                {p && <AvatarDisplay avatar={p.avatar} size="sm" dimmed={isOut} />}
                <div className={cn("max-w-[80%]", mine && "text-right")}>
                  <div
                    className={cn(
                      "mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground",
                      mine && "flex-row-reverse",
                    )}
                  >
                    <span className="font-semibold text-foreground/80">{mine ? "You" : p?.name ?? "?"}</span>
                    {isOut && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                        <Eye className="h-2.5 w-2.5" /> spectator
                      </span>
                    )}
                    {!isOut && p?.isAI && <PersonaTag player={p} />}
                  </div>
                  <div
                    className={cn(
                      "inline-block rounded-2xl px-3 py-2 text-sm",
                      mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-white/[0.06]",
                      isOut && "opacity-70",
                    )}
                  >
                    {item.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {typer && (
            <motion.div
              key={`typing-${typer.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2"
            >
              <AvatarDisplay avatar={typer.avatar} size="sm" />
              <div>
                <div className="mb-0.5 text-xs text-muted-foreground">{typer.name} is typing</div>
                <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/[0.06] px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          <ChevronDown className="h-4 w-4" /> Latest
        </button>
      )}
    </div>
  );
}

/** Free-form chat composer. Adapts its placeholder for spectators. */
export function ChatComposer() {
  const send = useTournamentStore((s) => s.sendHumanMessage);
  const human = useTournamentStore((s) => s.players.find((p) => p.id === s.humanId) ?? null);
  const isActive = useTournamentStore(selectHumanActive);
  const [draft, setDraft] = useState("");

  function go() {
    const t = draft.trim();
    if (!t) return;
    send(t);
    setDraft("");
  }

  return (
    <div className="flex items-center gap-2">
      {human && <AvatarDisplay avatar={human.avatar} size="sm" dimmed={!isActive} />}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        maxLength={160}
        placeholder={isActive ? "Say something to the table…" : "Spectator chat…"}
        aria-label="Chat message"
        className="h-11"
      />
      <Button variant="secondary" className="h-11 shrink-0" onClick={go} disabled={!draft.trim()}>
        <Send className="h-4 w-4" /> Send
      </Button>
    </div>
  );
}

/** Collapsible chat panel for the voting / elimination screens. */
export function ChatPanel() {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <MessagesSquare className="h-4 w-4" /> Table chat
      </h3>
      <ConversationFeed heightClass="h-[30vh] min-h-[220px]" />
      <ChatComposer />
    </div>
  );
}

export function PersonaTag({ player }: { player: TournamentPlayer }) {
  const persona = player.personality ? getPersonality(player.personality) : null;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="outline" className="gap-0.5 px-1.5 py-0 text-[10px]">
        <Bot className="h-2.5 w-2.5" /> AI
      </Badge>
      {persona && (
        <span className="text-[10px] text-muted-foreground" title={persona.blurb}>
          {persona.emoji}
        </span>
      )}
    </span>
  );
}

/** Small roster strip showing who's alive vs. eliminated — the "board". */
export function PlayerBoard() {
  const players = useTournamentStore((s) => s.players);
  const humanId = useTournamentStore((s) => s.humanId);
  const eliminatedIds = useTournamentStore((s) => s.eliminatedIds);
  const active = useTournamentStore(useShallow(selectActivePlayers));
  const eliminated = new Set(eliminatedIds);

  return (
    <div className="rounded-2xl glass p-3">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>The board</span>
        <span className="tabular-nums">{active.length} remaining</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {players.map((p) => {
            const isOut = eliminated.has(p.id);
            return (
              <motion.div
                key={p.id}
                layout
                animate={{ opacity: isOut ? 0.45 : 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs",
                  isOut ? "bg-white/[0.02] line-through" : "bg-white/[0.05]",
                )}
              >
                <AvatarDisplay avatar={p.avatar} size="xs" dimmed={isOut} ring={false} />
                <span className="font-medium">{p.id === humanId ? "You" : p.name}</span>
                {p.isAI && <Bot className="h-3 w-3 text-muted-foreground" />}
                {isOut && <span className="text-[10px] text-rose-300/80">out</span>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
