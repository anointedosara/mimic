"use client";

import confetti from "canvas-confetti";

export function burstConfetti() {
  const colors = ["#7c3aed", "#d946ef", "#22d3ee", "#f59e0b", "#f43f5e"];
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors }), 150);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors }), 300);
}

export function evilConfetti() {
  // Dark, moody burst for when the imposter escapes.
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.5 },
    colors: ["#7c3aed", "#4c1d95", "#1e1b4b", "#a21caf"],
    scalar: 1.1,
    gravity: 1.2,
  });
}
