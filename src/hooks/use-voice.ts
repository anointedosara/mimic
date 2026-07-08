"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSocket, emitAck } from "@/lib/socket-client";
import type { VoiceJoinAck, VoicePeer, VoiceSignal } from "@/lib/game/events";
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

/**
 * Full-mesh peer-to-peer voice for a room, using the Socket.IO server purely as
 * a signaling relay. Mic capture is opt-in via `join()` (needs a user gesture so
 * remote audio can autoplay). State for the UI lives in the voice store.
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
      getSocket().emit("voice:signal", { code: upper, to, data });
    },
    [upper],
  );

  // --- peer connection lifecycle -------------------------------------------
  const closePeer = useCallback(
    (socketId: string) => {
      const peer = peersRef.current.get(socketId);
      if (!peer) return;
      peersRef.current.delete(socketId);
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
      rosterRef.current.delete(socketId);
      syncRoster();
    },
    [store, syncRoster],
  );

  const getOrCreatePeer = useCallback(
    (socketId: string, userId: string, initiator: boolean): PeerConn => {
      const existing = peersRef.current.get(socketId);
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
      peersRef.current.set(socketId, peer);

      pc.onicecandidate = (e) => {
        if (e.candidate) send(socketId, { kind: "ice", candidate: e.candidate.toJSON() });
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
          closePeer(socketId);
        }
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => send(socketId, { kind: "offer", sdp: offer }))
          .catch(() => closePeer(socketId));
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
    for (const socketId of [...peersRef.current.keys()]) closePeer(socketId);
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

    const res = await emitAck<VoiceJoinAck>("voice:join", { code: upper });
    if (!res.ok) throw new Error(res.error ?? "Could not join voice");

    for (const peer of res.peers ?? []) {
      rosterRef.current.set(peer.socketId, peer);
      // We are the newcomer — existing peers offer to us, so we wait to answer.
      // If an offer already raced ahead of this ack, backfill the real userId.
      const early = peersRef.current.get(peer.socketId);
      if (early && !early.userId) early.userId = peer.userId;
    }
    syncRoster();
  }, [upper, attachAnalyser, startMeter, syncRoster]);

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
    getSocket().emit("voice:leave", { code: upper });
    teardown();
  }, [upper, teardown]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !store.getState().micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    store.getState().setMicOn(next);
    if (!next) store.getState().setSpeaking(selfIdRef.current, false);
  }, [store]);

  // --- wire up socket listeners --------------------------------------------
  useEffect(() => {
    if (!upper) return;
    const socket = getSocket();

    const onPeerJoined = (peer: VoicePeer) => {
      if (!activeRef.current) return;
      rosterRef.current.set(peer.socketId, peer);
      syncRoster();
      // We were already here — initiate the offer to the newcomer.
      getOrCreatePeer(peer.socketId, peer.userId, true);
    };
    const onPeerLeft = ({ socketId }: { socketId: string }) => closePeer(socketId);
    const onSignal = (payload: { from: string; data: VoiceSignal }) => {
      void handleSignal(payload);
    };
    // If the socket drops and reconnects it has a new id — rebuild the mesh.
    const onReconnect = () => {
      if (!activeRef.current) return;
      for (const socketId of [...peersRef.current.keys()]) closePeer(socketId);
      doJoin().catch(() => leave());
    };

    socket.on("voice:peer-joined", onPeerJoined);
    socket.on("voice:peer-left", onPeerLeft);
    socket.on("voice:signal", onSignal);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("voice:peer-joined", onPeerJoined);
      socket.off("voice:peer-left", onPeerLeft);
      socket.off("voice:signal", onSignal);
      socket.io.off("reconnect", onReconnect);
    };
  }, [upper, syncRoster, getOrCreatePeer, closePeer, handleSignal, doJoin, leave]);

  // Tear everything down when the room changes or the component unmounts.
  useEffect(() => teardown, [upper, teardown]);

  return { join, leave, toggleMic };
}
