"use client";

import { useEffect, useRef } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { formatTime } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export function TimerRing({
  endsAt,
  total,
  size = 140,
}: {
  endsAt: number | null;
  total: number;
  size?: number;
}) {
  const remaining = useCountdown(endsAt);
  const prev = useRef(remaining);

  // Tick sound in the final 10 seconds.
  useEffect(() => {
    if (remaining !== prev.current && remaining <= 10 && remaining > 0) {
      playSound("tick");
    }
    prev.current = remaining;
  }, [remaining]);

  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const urgent = remaining <= 10 && remaining > 0;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="fill-none stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("fill-none transition-all duration-300", urgent ? "stroke-rose-500" : "stroke-[url(#tg)]")}
          style={{ strokeDasharray: circ, strokeDashoffset: circ * (1 - pct) }}
          stroke={urgent ? undefined : "url(#tg)"}
        />
        <defs>
          <linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute grid place-items-center text-center">
        <span
          className={cn(
            "font-display text-3xl font-black tabular-nums",
            urgent && "animate-pulse text-rose-400",
          )}
        >
          {formatTime(remaining)}
        </span>
      </div>
    </div>
  );
}
