"use client";

import { motion } from "framer-motion";
import { Crown, X, Check, Wifi, WifiOff } from "lucide-react";
import type { PublicPlayer } from "@/lib/game/types";
import { AvatarDisplay } from "@/components/avatar-display";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlayerTile({
  player,
  isSelf,
  showVoted = false,
  onKick,
  onClick,
  selectable = false,
  selected = false,
  disabled = false,
}: {
  player: PublicPlayer;
  isSelf?: boolean;
  showVoted?: boolean;
  onKick?: () => void;
  onClick?: () => void;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const Comp = selectable ? "button" : "div";
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
      <Comp
        onClick={selectable && !disabled ? onClick : undefined}
        disabled={selectable ? disabled : undefined}
        className={cn(
          "group relative flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all",
          "glass",
          selectable && !disabled && "cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20",
          selected && "border-primary ring-2 ring-primary",
          disabled && "opacity-50",
          !player.connected && "opacity-60",
        )}
      >
        {player.isHost && (
          <Badge variant="gold" className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <Crown className="h-3 w-3" /> Host
          </Badge>
        )}

        <div className="relative">
          <AvatarDisplay avatar={player.avatar} size="md" dimmed={!player.connected} />
          {showVoted && player.hasVoted && (
            <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
              <Check className="h-4 w-4" />
            </div>
          )}
          <div
            className={cn(
              "absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-white shadow",
              player.connected ? "bg-emerald-500" : "bg-zinc-600",
            )}
            title={player.connected ? "Connected" : "Disconnected"}
          >
            {player.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-center justify-center gap-1">
            <span className="max-w-[8rem] truncate text-sm font-semibold">{player.displayName}</span>
          </div>
          {isSelf && <span className="text-[10px] uppercase tracking-wider text-primary">You</span>}
          {player.roundsWon > 0 && (
            <div className="text-[10px] text-amber-400">★ {player.roundsWon}</div>
          )}
        </div>

        {onKick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKick();
            }}
            className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white opacity-0 shadow transition-opacity hover:brightness-110 group-hover:opacity-100"
            aria-label={`Remove ${player.displayName}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </Comp>
    </motion.div>
  );
}
