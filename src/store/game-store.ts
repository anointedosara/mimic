import { create } from "zustand";
import type { PrivateRole, RoomSnapshot } from "@/lib/game/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface GameState {
  snapshot: RoomSnapshot | null;
  /** THIS player's private role. Never contains other players' roles. */
  role: PrivateRole | null;
  status: ConnectionStatus;
  joinError: string | null;

  setSnapshot: (s: RoomSnapshot) => void;
  setRole: (r: PrivateRole | null) => void;
  setStatus: (s: ConnectionStatus) => void;
  setJoinError: (e: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  role: null,
  status: "connecting",
  joinError: null,

  setSnapshot: (snapshot) => set({ snapshot }),
  setRole: (role) => set({ role }),
  setStatus: (status) => set({ status }),
  setJoinError: (joinError) => set({ joinError }),
  reset: () => set({ snapshot: null, role: null, joinError: null }),
}));
