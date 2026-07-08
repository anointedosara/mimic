"use client";

// Zero-asset sound effects synthesized with the Web Audio API.
// Respects a user mute preference persisted in localStorage.

type SoundName = "join" | "start" | "vote" | "reveal" | "win" | "lose" | "tick" | "click";

let ctx: AudioContext | null = null;
const STORAGE_KEY = "mimic:muted";

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.02);
}

const RECIPES: Record<SoundName, () => void> = {
  join: () => tone(523, 0, 0.15, "sine"),
  click: () => tone(660, 0, 0.06, "triangle", 0.04),
  start: () => {
    tone(392, 0, 0.12, "sawtooth");
    tone(523, 0.1, 0.14, "sawtooth");
    tone(784, 0.22, 0.2, "sawtooth");
  },
  vote: () => tone(440, 0, 0.1, "square", 0.05),
  tick: () => tone(880, 0, 0.05, "sine", 0.03),
  reveal: () => {
    tone(330, 0, 0.15, "sawtooth");
    tone(494, 0.14, 0.2, "sawtooth");
  },
  win: () => {
    tone(523, 0, 0.14, "triangle");
    tone(659, 0.14, 0.14, "triangle");
    tone(784, 0.28, 0.14, "triangle");
    tone(1047, 0.42, 0.3, "triangle");
  },
  lose: () => {
    tone(392, 0, 0.2, "sawtooth");
    tone(294, 0.2, 0.35, "sawtooth");
  },
};

export function playSound(name: SoundName) {
  if (isMuted()) return;
  const c = getCtx();
  if (c?.state === "suspended") c.resume().catch(() => {});
  try {
    RECIPES[name]();
  } catch {
    /* ignore audio errors */
  }
}
