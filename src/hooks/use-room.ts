"use client";

import { useEffect, useRef } from "react";
import { getSocket, emitAck } from "@/lib/socket-client";
import { useGameStore } from "@/store/game-store";
import type { RoomNotice } from "@/lib/game/events";
import { playSound } from "@/lib/sounds";
import { toast } from "sonner";

/**
 * Connects to the room over Socket.IO, keeps the Zustand store in sync, and
 * transparently re-joins on reconnect so a refresh/disconnect never loses state.
 */
export function useRoom(code: string) {
  const { setSnapshot, setRole, setStatus, setJoinError, reset } = useGameStore();
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    const socket = getSocket();
    const upper = code.toUpperCase();

    const join = async () => {
      const res = await emitAck("room:join", { code: upper });
      if (!res.ok) {
        setJoinError(res.error ?? "Could not join room");
      } else {
        setJoinError(null);
        joinedRef.current = true;
      }
    };

    const onConnect = () => {
      setStatus("connected");
      // (Re)join and request a fresh authoritative sync.
      join().then(() => socket.emit("room:requestSync", { code: upper }));
    };
    const onDisconnect = () => setStatus("reconnecting");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onConnectError = (err: Error) => {
      // Surface handshake failures (e.g. auth rejected) instead of hanging
      // silently on "connecting" forever.
      setStatus("disconnected");
      if (/unauthor/i.test(err.message)) {
        setJoinError("Your session expired — please sign in again.");
      }
    };

    const onState = (snapshot: Parameters<typeof setSnapshot>[0]) => setSnapshot(snapshot);
    const onRole = (role: Parameters<typeof setRole>[0]) => setRole(role);
    const onClosed = (payload: { reason: string }) => {
      toast.error(payload.reason || "The room was closed");
      reset();
      if (typeof window !== "undefined") window.location.href = "/";
    };
    const onNotice = (n: RoomNotice) => handleNotice(n);
    const onError = (p: { message: string }) => toast.error(p.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("room:state", onState);
    socket.on("game:role", onRole);
    socket.on("room:closed", onClosed);
    socket.on("room:notice", onNotice);
    socket.on("error", onError);

    if (socket.connected) onConnect();
    else setStatus("connecting");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("room:state", onState);
      socket.off("game:role", onRole);
      socket.off("room:closed", onClosed);
      socket.off("room:notice", onNotice);
      socket.off("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
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
    emitAck("room:updateSettings", { code, settings }),
  kick: (code: string, userId: string) => emitAck("room:kick", { code, userId }),
  start: (code: string) => emitAck("game:start", { code }),
  voteEarly: (code: string) => emitAck("game:voteEarly", { code }),
  castVote: (code: string, targetId: string) => emitAck("game:castVote", { code, targetId }),
  reveal: (code: string) => emitAck("game:reveal", { code }),
  playAgain: (code: string) => emitAck("game:playAgain", { code }),
  leave: (code: string) => getSocket().emit("room:leave", { code }),
};
