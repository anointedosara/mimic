"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import type * as Ably from "ably";
import { getAbly } from "@/lib/ably/client";
import { roomChannel, userChannel } from "@/lib/ably/channels";
import { postAction, beaconAction } from "@/lib/api/client";
import { useGameStore } from "@/store/game-store";
import type { RoomNotice } from "@/lib/game/events";
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
    const onFailed = () => {
      setStatus("disconnected");
      setJoinError("Realtime connection failed — please refresh.");
    };

    // --- channel messages ---------------------------------------------------
    const onState = (msg: Ably.Message) => setSnapshot(msg.data);
    const onRole = (msg: Ably.Message) => setRole(msg.data);
    const onNotice = (msg: Ably.Message) => handleNotice(msg.data as RoomNotice);
    const onClosed = (msg: Ably.Message) => {
      toast.error((msg.data?.reason as string) || "The room was closed");
      reset();
      if (typeof window !== "undefined") window.location.href = "/";
    };

    room.subscribe("room:state", onState);
    room.subscribe("room:notice", onNotice);
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

    // Best-effort leave on tab close (hard drops are covered by presence).
    const onUnload = () => beaconAction(`/api/room/${upper}/leave`);
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.removeEventListener("pagehide", onUnload);
      room.unsubscribe("room:state", onState);
      room.unsubscribe("room:notice", onNotice);
      mine.unsubscribe("room:state", onState);
      mine.unsubscribe("game:role", onRole);
      mine.unsubscribe("room:closed", onClosed);
      ably.connection.off("connected", onConnected);
      ably.connection.off("disconnected", onDisconnected);
      ably.connection.off("failed", onFailed);
      room.presence.leave().catch(() => {});
    };
  }, [code, userId, setSnapshot, setRole, setStatus, setJoinError, reset]);
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
  }
}

// --- room action helpers ----------------------------------------------------
export const roomActions = {
  updateSettings: (code: string, settings: Record<string, number>) =>
    postAction(`/api/room/${code.toUpperCase()}/settings`, { settings }),
  kick: (code: string, userId: string) =>
    postAction(`/api/room/${code.toUpperCase()}/kick`, { userId }),
  start: (code: string) => postAction(`/api/game/${code.toUpperCase()}/start`),
  voteEarly: (code: string) => postAction(`/api/game/${code.toUpperCase()}/voteEarly`),
  castVote: (code: string, targetId: string) =>
    postAction(`/api/game/${code.toUpperCase()}/castVote`, { targetId }),
  reveal: (code: string) => postAction(`/api/game/${code.toUpperCase()}/reveal`),
  playAgain: (code: string) => postAction(`/api/game/${code.toUpperCase()}/playAgain`),
  leave: (code: string) => postAction(`/api/room/${code.toUpperCase()}/leave`),
};
