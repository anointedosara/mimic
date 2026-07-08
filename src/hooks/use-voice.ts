"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as Ably from "ably";
import { getAbly } from "@/lib/ably/client";
import { voiceChannel, MSG } from "@/lib/ably/channels";
import type { VoicePeer, VoiceSignal } from "@/lib/game/events";
import { useVoiceStore } from "@/store/voice-store";

// Public STUN only — a full mesh between friends behind typical home NATs works
// without a TURN relay. (Symmetric-NAT users would need TURN; out of scope.)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

// Speaking detection tuning.
const SPEAK_THRESHOLD = 0.025; // RMS of normalized [-1,1] samples
const SPEAK_HANGOVER_MS = 280; // keep "speaking" this long after last peak

interface PeerConn {
  pc: RTCPeerConnection;
  userId: string;
  audioEl: HTMLAudioElement;
  candidateQueue: RTCIceCandidateInit[];
  remoteReady: boolean;
}

/** Signaling envelope published on the voice channel, addressed by connectionId. */
interface VoiceEnvelope {
  to: string;
  from: string;
  data: VoiceSignal;
}

/**
 * Full-mesh peer-to-peer voice for a room, using an Ably channel for signaling
 * and presence for peer discovery. Peers are keyed by Ably connectionId. Mic
 * capture is opt-in via `join()` (needs a user gesture so remote audio can
 * autoplay). State for the UI lives in the voice store.
 */
export function useVoice(code: string, selfId: string) {
  const store = useVoiceStore;

  const peersRef = useRef<Map<string, PeerConn>>(new Map());
  const rosterRef = useRef<Map<string, VoicePeer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<
    Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; lastAbove: number }>
  >(new Map());
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;

  const upper = code.toUpperCase();

  const channel = useCallback((): Ably.RealtimeChannel => {
    return getAbly().channels.get(voiceChannel(upper));
  }, [upper]);

  const myConnId = () => getAbly().connection.id ?? "";

  // --- roster -> store ------------------------------------------------------
  const syncRoster = useCallback(() => {
    const ids = new Set<string>();
    if (selfIdRef.current) ids.add(selfIdRef.current);
    for (const p of rosterRef.current.values()) ids.add(p.userId);
    store.getState().setConnectedUserIds([...ids]);
  }, [store]);

  // --- speaking detection (single rAF over all analysers) -------------------
  const startMeter = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      const micOn = store.getState().micOn;
      for (const [userId, node] of analysersRef.current) {
        node.analyser.getByteTimeDomainData(node.data);
        let sumSq = 0;
        for (let i = 0; i < node.data.length; i++) {
          const v = (node.data[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / node.data.length);
        const isSelf = userId === selfIdRef.current;
        const now = Date.now();
        if (rms > SPEAK_THRESHOLD && !(isSelf && !micOn)) {
          node.lastAbove = now;
          store.getState().setSpeaking(userId, true);
        } else if (now - node.lastAbove > SPEAK_HANGOVER_MS) {
          store.getState().setSpeaking(userId, false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [store]);

  const attachAnalyser = useCallback((userId: string, stream: MediaStream) => {
    const ctx = audioCtxRef.current;
    if (!ctx || !stream.getAudioTracks().length) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysersRef.current.set(userId, {
        analyser,
        data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
        lastAbove: 0,
      });
    } catch {
      /* stream may have no live audio track yet; ignore */
    }
  }, []);

  const send = useCallback(
    (to: string, data: VoiceSignal) => {
      const envelope: VoiceEnvelope = { to, from: myConnId(), data };
      void channel().publish(MSG.voiceSignal, envelope);
    },
    [channel],
  );

  // --- peer connection lifecycle -------------------------------------------
  const closePeer = useCallback(
    (connId: string) => {
      const peer = peersRef.current.get(connId);
      if (!peer) return;
      peersRef.current.delete(connId);
      try {
        peer.pc.ontrack = null;
        peer.pc.onicecandidate = null;
        peer.pc.onconnectionstatechange = null;
        peer.pc.close();
      } catch {
        /* already closed */
      }
      peer.audioEl.srcObject = null;
      peer.audioEl.remove();
      analysersRef.current.delete(peer.userId);
      store.getState().setSpeaking(peer.userId, false);
      rosterRef.current.delete(connId);
      syncRoster();
    },
    [store, syncRoster],
  );

  const getOrCreatePeer = useCallback(
    (connId: string, userId: string, initiator: boolean): PeerConn => {
      const existing = peersRef.current.get(connId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const local = localStreamRef.current;
      if (local) for (const track of local.getTracks()) pc.addTrack(track, local);

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      (audioEl as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);

      const peer: PeerConn = { pc, userId, audioEl, candidateQueue: [], remoteReady: false };
      peersRef.current.set(connId, peer);

      pc.onicecandidate = (e) => {
        if (e.candidate) send(connId, { kind: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {
          /* autoplay blocked until a gesture; join click usually satisfies it */
        });
        attachAnalyser(userId, stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          closePeer(connId);
        }
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => send(connId, { kind: "offer", sdp: offer }))
          .catch(() => closePeer(connId));
      }
      return peer;
    },
    [send, attachAnalyser, closePeer],
  );

  const flushCandidates = useCallback(async (peer: PeerConn) => {
    const queued = peer.candidateQueue.splice(0);
    for (const c of queued) {
      try {
        await peer.pc.addIceCandidate(c);
      } catch {
        /* stale candidate; ignore */
      }
    }
  }, []);

  const handleSignal = useCallback(
    async ({ from, data }: { from: string; data: VoiceSignal }) => {
      if (!activeRef.current) return;
      const info = rosterRef.current.get(from);
      const peer = getOrCreatePeer(from, info?.userId ?? "", false);

      try {
        if (data.kind === "offer") {
          await peer.pc.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
          peer.remoteReady = true;
          await flushCandidates(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          send(from, { kind: "answer", sdp: answer });
        } else if (data.kind === "answer") {
          await peer.pc.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
          peer.remoteReady = true;
          await flushCandidates(peer);
        } else if (data.kind === "ice") {
          const candidate = data.candidate as RTCIceCandidateInit;
          if (peer.remoteReady) {
            await peer.pc.addIceCandidate(candidate).catch(() => {});
          } else {
            peer.candidateQueue.push(candidate);
          }
        }
      } catch {
        closePeer(from);
      }
    },
    [getOrCreatePeer, flushCandidates, send, closePeer],
  );

  const teardown = useCallback(() => {
    activeRef.current = false;
    for (const connId of [...peersRef.current.keys()]) closePeer(connId);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analysersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    rosterRef.current.clear();
    store.getState().reset();
  }, [closePeer, store]);

  // --- public actions -------------------------------------------------------
  const doJoin = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    localStreamRef.current = stream;
    activeRef.current = true;

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtxRef.current = new Ctx();
    await audioCtxRef.current.resume().catch(() => {});
    attachAnalyser(selfIdRef.current, stream);
    startMeter();

    const ch = channel();
    // Announce ourselves; existing peers will offer to us (see onPeerJoined).
    await ch.presence.enter({ userId: selfIdRef.current });

    const members = await ch.presence.get();
    const selfConn = myConnId();
    for (const m of members) {
      if (m.connectionId === selfConn) continue;
      const userId = (m.data as { userId?: string } | undefined)?.userId ?? "";
      rosterRef.current.set(m.connectionId, {
        socketId: m.connectionId,
        userId,
        displayName: "",
        avatar: "",
      });
    }
    syncRoster();
  }, [channel, attachAnalyser, startMeter, syncRoster]);

  const join = useCallback(async () => {
    if (activeRef.current) return;
    const s = store.getState();
    s.setStatus("connecting");
    try {
      await doJoin();
      s.setMicOn(true);
      s.setStatus("active");
    } catch (err) {
      teardown();
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : err instanceof Error
            ? err.message
            : "Could not start voice";
      store.getState().setStatus("error", msg);
    }
  }, [store, doJoin, teardown]);

  const leave = useCallback(() => {
    if (!activeRef.current) return;
    channel()
      .presence.leave()
      .catch(() => {});
    teardown();
  }, [channel, teardown]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !store.getState().micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    store.getState().setMicOn(next);
    if (!next) store.getState().setSpeaking(selfIdRef.current, false);
  }, [store]);

  // --- wire up Ably presence + signaling -----------------------------------
  useEffect(() => {
    if (!upper) return;
    const ch = channel();

    const onPeerJoined = (m: Ably.PresenceMessage) => {
      if (!activeRef.current || m.connectionId === myConnId()) return;
      const userId = (m.data as { userId?: string } | undefined)?.userId ?? "";
      rosterRef.current.set(m.connectionId, {
        socketId: m.connectionId,
        userId,
        displayName: "",
        avatar: "",
      });
      syncRoster();
      // We were already here — initiate the offer to the newcomer.
      getOrCreatePeer(m.connectionId, userId, true);
    };
    const onPeerLeft = (m: Ably.PresenceMessage) => closePeer(m.connectionId);
    const onSignal = (msg: Ably.Message) => {
      const env = msg.data as VoiceEnvelope;
      if (!env || env.to !== myConnId()) return;
      void handleSignal({ from: env.from, data: env.data });
    };
    // On a fresh connection (new connectionId) rebuild the mesh.
    const onConnected = () => {
      if (!activeRef.current) return;
      for (const connId of [...peersRef.current.keys()]) closePeer(connId);
      doJoin().catch(() => leave());
    };

    void ch.presence.subscribe("enter", onPeerJoined);
    void ch.presence.subscribe("leave", onPeerLeft);
    void ch.presence.subscribe("absent", onPeerLeft);
    void ch.subscribe(MSG.voiceSignal, onSignal);
    getAbly().connection.on("connected", onConnected);

    return () => {
      ch.presence.unsubscribe("enter", onPeerJoined);
      ch.presence.unsubscribe("leave", onPeerLeft);
      ch.presence.unsubscribe("absent", onPeerLeft);
      ch.unsubscribe(MSG.voiceSignal, onSignal);
      getAbly().connection.off("connected", onConnected);
    };
  }, [upper, channel, syncRoster, getOrCreatePeer, closePeer, handleSignal, doJoin, leave]);

  // Tear everything down when the room changes or the component unmounts.
  useEffect(() => teardown, [upper, teardown]);

  return { join, leave, toggleMic };
}
