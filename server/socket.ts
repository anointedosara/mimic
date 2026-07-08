import type { Server as HTTPServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import { getToken } from "next-auth/jwt";
import { GameManager } from "./game/manager";
import { SOCKET_PATH } from "@/lib/game/events";

interface SocketUser {
  id: string;
  displayName: string;
  avatar: string;
}

interface SocketData {
  user: SocketUser;
  // Rooms this socket has joined (for cleanup on disconnect).
  joinedCodes: Set<string>;
}

export function initSocketServer(httpServer: HTTPServer): IOServer {
  const io = new IOServer(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
  });

  const manager = new GameManager(io);
  manager.rehydrateTimers().catch((e) => console.error("[socket] rehydrate", e));

  // --- authenticate every socket via the NextAuth session cookie ----------
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? "";
      const token = await getToken({
        // getToken only reads headers.cookie from the request.
        req: { headers: { cookie } } as unknown as Parameters<typeof getToken>[0]["req"],
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (!token?.uid) return next(new Error("Unauthorized"));
      (socket.data as SocketData).user = {
        id: String(token.uid),
        displayName: String(token.displayName ?? token.name ?? "Player"),
        avatar: String(token.avatar ?? "fox"),
      };
      (socket.data as SocketData).joinedCodes = new Set();
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;
    const user = data.user;

    const normalize = (code: unknown) => String(code ?? "").toUpperCase().trim();

    socket.on("room:join", async ({ code }, ack) => {
      const c = normalize(code);
      if (!c) return ack?.({ ok: false, error: "Missing room code" });
      const res = await manager.handleJoin(c, user);
      if (res.ok) {
        socket.join(`room:${c}`);
        socket.join(`user:${c}:${user.id}`);
        data.joinedCodes.add(c);
      }
      ack?.(res);
    });

    socket.on("room:requestSync", async ({ code }) => {
      const c = normalize(code);
      if (c) await manager.syncTo(c, user.id);
    });

    socket.on("room:leave", async ({ code }) => {
      const c = normalize(code);
      socket.leave(`room:${c}`);
      socket.leave(`user:${c}:${user.id}`);
      data.joinedCodes.delete(c);
      await manager.handleDisconnect(c, user.id);
    });

    socket.on("room:updateSettings", async ({ code, settings }, ack) => {
      ack?.(await manager.handleUpdateSettings(normalize(code), user.id, settings));
    });

    socket.on("room:kick", async ({ code, userId }, ack) => {
      ack?.(await manager.handleKick(normalize(code), user.id, String(userId)));
    });

    socket.on("game:start", async ({ code }, ack) => {
      ack?.(await manager.handleStart(normalize(code), user.id));
    });

    socket.on("game:voteEarly", async ({ code }, ack) => {
      ack?.(await manager.handleVoteEarly(normalize(code), user.id));
    });

    socket.on("game:castVote", async ({ code, targetId }, ack) => {
      ack?.(await manager.handleCastVote(normalize(code), user.id, String(targetId)));
    });

    socket.on("game:reveal", async ({ code }, ack) => {
      ack?.(await manager.handleReveal(normalize(code), user.id));
    });

    socket.on("game:playAgain", async ({ code }, ack) => {
      ack?.(await manager.handlePlayAgain(normalize(code), user.id));
    });

    socket.on("disconnect", async () => {
      // Mark disconnected in every room this socket had joined.
      for (const c of data.joinedCodes) {
        // Only flip presence if no other socket for this user remains in the room.
        const room = io.sockets.adapter.rooms.get(`user:${c}:${user.id}`);
        const stillConnected = room && room.size > 0;
        if (!stillConnected) {
          await manager.handleDisconnect(c, user.id);
        }
      }
    });
  });

  return io;
}
