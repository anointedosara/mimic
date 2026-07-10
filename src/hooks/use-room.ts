"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import type * as Ably from "ably";
import { getAbly } from "@/lib/ably/client";
import { roomChannel, userChannel } from "@/lib/ably/channels";
import { postAction, beaconAction } from "@/lib/api/client";
import { useGameStore } from "@/store/game-store";
import { useChatStore } from "@/store/chat-store";
import type { RoomNotice, TypingSignal } from "@/lib/game/events";
import { playSound } from "@/lib/sounds";
import { toast } from "sonner";

/**
 * Connects to the room over Ably, keeps the Zustand store in sync, and
 * transparently re-joins on reconnect so a refresh/disconnect never loses state.
 * Public room state + notices arrive on the room channel; this player's PRIVATE
 * role arrives on their own user channel.
 */
export function useRoom(code: string) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const { setSnapshot, setRole, setStatus, setJoinError, reset } = useGameStore();
  const snapshot = useGameStore((s) => s.snapshot);

  useEffect(() => {
    if (!code || !userId) return;
    const upper = code.toUpperCase();
    const ably = getAbly();
    const room = ably.channels.get(roomChannel(upper));
    const mine = ably.channels.get(userChannel(upper, userId));

    const join = async () => {
      const res = await postAction(`/api/room/${upper}/join`);
      if (!res.ok) {
        setJoinError(res.error ?? "Could not join room");
      } else {
        setJoinError(null);
        // Ask for a fresh authoritative sync (also delivers our private role).
        await postAction(`/api/room/${upper}/sync`);
      }
    };

    const enterAndJoin = async () => {
      try {
        await room.presence.enter();
      } catch {
        /* presence best-effort */
      }
      await join();
    };

    // --- connection state -> UI status --------------------------------------
    const onConnected = () => {
      setStatus("connected");
      void enterAndJoin();
    };
    const onDisconnected = () => setStatus("reconnecting");
    // Ably's "failed" is terminal (usually a transient auth hiccup, e.g. the
    // server restarting mid-session). Don't strand the user on "Offline" —
    // show reconnecting and kick off a fresh connection (re-mints a token).
    let retry: ReturnType<typeof setTimeout> | undefined;
    const onFailed = () => {
      setStatus("reconnecting");
      retry = setTimeout(() => {
        try {
          ably.connect();
        } catch {
          /* ignore */
        }
      }, 1500);
    };

    // --- channel messages ---------------------------------------------------
    const onState = (msg: Ably.Message) => setSnapshot(msg.data);
    const onRole = (msg: Ably.Message) => setRole(msg.data);
    const onNotice = (msg: Ably.Message) => handleNotice(msg.data as RoomNotice);
    const onTyping = (msg: Ably.Message) => {
      const t = msg.data as TypingSignal;
      if (t?.userId && t.userId !== userId) useChatStore.getState().noteTyping(t.userId, t.name);
    };
    const onClosed = (msg: Ably.Message) => {
      toast.error((msg.data?.reason as string) || "The room was closed");
      reset();
      if (typeof window !== "undefined") window.location.href = "/";
    };

    room.subscribe("room:state", onState);
    room.subscribe("room:notice", onNotice);
    room.subscribe("room:typing", onTyping);
    mine.subscribe("room:state", onState);
    mine.subscribe("game:role", onRole);
    mine.subscribe("room:closed", onClosed);

    ably.connection.on("connected", onConnected);
    ably.connection.on("disconnected", onDisconnected);
    ably.connection.on("failed", onFailed);

    if (ably.connection.state === "connected") {
      setStatus("connected");
      void enterAndJoin();
    } else {
      setStatus("connecting");
    }

    // On tab hide/close, mark a TRANSIENT disconnect — NOT a leave. A refresh,
    // a backgrounded mobile tab, or a dropped network keeps you in the room
    // (and keeps the host their crown); only the explicit "Leave" button exits.
    const onUnload = () => beaconAction(`/api/room/${upper}/disconnect`);
    window.addEventListener("pagehide", onUnload);

    // Silent self-heal: re-request the authoritative snapshot every ~75s. This
    // keeps everyone in sync and recovers any stuck UI without a page reload or
    // dropping voice — nothing visibly changes when state is already current.
    const resync = () => {
      if (ably.connection.state === "connected") void postAction(`/api/room/${upper}/sync`);
    };
    const resyncTimer = setInterval(resync, 75_000);

    // Catch up the instant the tab is refocused (returning from a backgrounded
    // mobile tab, waking a laptop) rather than waiting for the next tick — so a
    // player rejoins mid-game exactly where everyone else is.
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (retry) clearTimeout(retry);
      clearInterval(resyncTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onUnload);
      room.unsubscribe("room:state", onState);
      room.unsubscribe("room:notice", onNotice);
      room.unsubscribe("room:typing", onTyping);
      mine.unsubscribe("room:state", onState);
      mine.unsubscribe("game:role", onRole);
      mine.unsubscribe("room:closed", onClosed);
      ably.connection.off("connected", onConnected);
      ably.connection.off("disconnected", onDisconnected);
      ably.connection.off("failed", onFailed);
      room.presence.leave().catch(() => {});
    };
  }, [code, userId, setSnapshot, setRole, setStatus, setJoinError, reset]);

  // --- host autopilot -------------------------------------------------------
  // Timed phase transitions (role -> discussion, discussion -> voting) are
  // normally driven by a scheduled QStash callback. When that callback can't be
  // delivered (QStash can't reach the app URL, e.g. a localhost/self-hosted
  // deploy, or a frozen serverless function), the game would hang. As a
  // fallback the HOST's browser nudges the room forward once a transition is
  // due. handleClientAdvance is idempotent, host/deadline-guarded, and locked,
  // so this is a harmless no-op whenever the scheduler already did its job.
  const phase = snapshot?.phase;
  const timerEndsAt = snapshot?.timerEndsAt ?? null;
  const hostId = snapshot?.hostId;
  useEffect(() => {
    if (!code || !userId || hostId !== userId) return;
    const upper = code.toUpperCase();
    const fire = () => void postAction(`/api/game/${upper}/advance-now`);

    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const arm = (delayMs: number) => {
      timeout = setTimeout(() => {
        fire();
        // Keep retrying (idempotent) until the phase changes and this effect
        // is torn down — covers a dropped request or a transient failure.
        interval = setInterval(fire, 4000);
      }, Math.max(0, delayMs));
    };

    if (phase === "role") {
      // Let the brief role reveal (and the scheduler) have first crack.
      arm(5500);
    } else if (phase === "discussion" && timerEndsAt) {
      // Only after the discussion timer has actually elapsed.
      arm(timerEndsAt - Date.now() + 750);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [code, userId, phase, timerEndsAt, hostId]);
}

function handleNotice(n: RoomNotice) {
  switch (n.type) {
    case "player_joined":
      playSound("join");
      toast(`${n.name} joined`, { icon: "👋" });
      break;
    case "player_left":
      toast(`${n.name} left`, { icon: "🚪" });
      break;
    case "player_kicked":
      toast(`${n.name} was removed`, { icon: "🥾" });
      break;
    case "host_changed":
      toast(`${n.name} is now the host`, { icon: "👑" });
      break;
    case "game_started":
      playSound("start");
      break;
    case "phase_voting":
      playSound("vote");
      toast("Voting has begun!", { icon: "🗳️" });
      break;
    case "vote_cast":
      playSound("tick");
      break;
    case "all_voted":
      toast("Everyone has voted", { icon: "✅" });
      break;
    case "revealed":
      playSound("reveal");
      break;
    case "new_round":
      toast("New round!", { icon: "🔄" });
      break;
    case "players_filled":
      playSound("join");
      toast(`${n.count} AI player${n.count === 1 ? "" : "s"} added`, { icon: "🤖" });
      break;
  }
}

// --- room action helpers ----------------------------------------------------
export const roomActions = {
  updateSettings: (code: string, settings: Record<string, number>) =>
    postAction(`/api/room/${code.toUpperCase()}/settings`, { settings }),
  kick: (code: string, userId: string) =>
    postAction(`/api/room/${code.toUpperCase()}/kick`, { userId }),
  fillWithAI: (code: string) => postAction(`/api/room/${code.toUpperCase()}/fill-ai`),
  start: (code: string) => postAction(`/api/game/${code.toUpperCase()}/start`),
  voteEarly: (code: string) => postAction(`/api/game/${code.toUpperCase()}/voteEarly`),
  castVote: (code: string, targetIds: string[]) =>
    postAction(`/api/game/${code.toUpperCase()}/castVote`, { targetIds }),
  reveal: (code: string) => postAction(`/api/game/${code.toUpperCase()}/reveal`),
  advanceNow: (code: string) => postAction(`/api/game/${code.toUpperCase()}/advance-now`),
  playAgain: (code: string) => postAction(`/api/game/${code.toUpperCase()}/playAgain`),
  leave: (code: string) => postAction(`/api/room/${code.toUpperCase()}/leave`),
};

// --- chat action helpers ----------------------------------------------------
export const chatActions = {
  send: (code: string, text: string, replyTo: string | null) =>
    postAction(`/api/room/${code.toUpperCase()}/chat`, { text, replyTo }),
  react: (code: string, messageId: string, emoji: string) =>
    postAction(`/api/room/${code.toUpperCase()}/chat/react`, { messageId, emoji }),
  typing: (code: string) => postAction(`/api/room/${code.toUpperCase()}/chat/typing`),
};
