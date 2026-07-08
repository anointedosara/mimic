"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/game/events";
import { SOCKET_PATH } from "@/lib/game/events";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? undefined;
  socket = io(url, {
    path: SOCKET_PATH,
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    transports: ["websocket", "polling"],
  });
  return socket;
}

/** Promise wrapper around an emit-with-ack. */
export function emitAck<T = { ok: boolean; error?: string }>(
  event: keyof ClientToServerEvents,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    const s = getSocket();
    // socket.io ack is the last argument.
    (s.emit as unknown as (e: string, p: unknown, cb: (r: T) => void) => void)(
      event as string,
      payload,
      (res: T) => resolve(res),
    );
  });
}
