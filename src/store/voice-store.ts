import { create } from "zustand";

export type VoiceStatus = "idle" | "connecting" | "active" | "error";

interface VoiceState {
  /** Lifecycle of THIS client's voice session. */
  status: VoiceStatus;
  /** Human-readable reason when status === "error" (e.g. mic denied). */
  error: string | null;
  /** Whether the local mic is currently transmitting. */
  micOn: boolean;
  /** userIds (peers + self) currently connected to the mesh. */
  connectedUserIds: string[];
  /** userId -> is currently speaking (drives the tile glow). */
  speaking: Record<string, boolean>;

  setStatus: (status: VoiceStatus, error?: string | null) => void;
  setMicOn: (micOn: boolean) => void;
  setConnectedUserIds: (ids: string[]) => void;
  setSpeaking: (userId: string, speaking: boolean) => void;
  reset: () => void;
}

const initial = {
  status: "idle" as VoiceStatus,
  error: null as string | null,
  micOn: true,
  connectedUserIds: [] as string[],
  speaking: {} as Record<string, boolean>,
};

export const useVoiceStore = create<VoiceState>((set) => ({
  ...initial,

  setStatus: (status, error = null) => set({ status, error }),
  setMicOn: (micOn) => set({ micOn }),
  setConnectedUserIds: (connectedUserIds) => set({ connectedUserIds }),
  setSpeaking: (userId, speaking) =>
    set((s) =>
      Boolean(s.speaking[userId]) === speaking
        ? s
        : { speaking: { ...s.speaking, [userId]: speaking } },
    ),
  reset: () => set({ ...initial, speaking: {} }),
}));
