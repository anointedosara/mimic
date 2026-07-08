"use client";

import { useState } from "react";
import { Copy, Check, Share2, LogOut, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, appUrl } from "@/lib/utils";
import type { ConnectionStatus } from "@/store/game-store";
import { playSound } from "@/lib/sounds";

export function RoomBar({
  code,
  status,
  onLeave,
}: {
  code: string;
  status: ConnectionStatus;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link = appUrl(`/room/${code}`);

  const copy = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      playSound("click");
      toast.success(kind === "code" ? "Code copied" : "Invite link copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my MIMIC game", text: `Room code: ${code}`, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      copy(link, "link");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => copy(code, "code")}
          className="group flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 transition-colors hover:border-primary/50"
          title="Copy room code"
        >
          <span className="text-xs text-muted-foreground">CODE</span>
          <span className="font-display text-xl font-black tracking-[0.25em] text-gradient">{code}</span>
          {copied === "code" ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground group-hover:text-white" />
          )}
        </button>

        <ConnBadge status={status} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => copy(link, "link")}>
          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">Copy link</span>
        </Button>
        <Button variant="outline" size="sm" onClick={share}>
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onLeave}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Leave</span>
        </Button>
      </div>
    </div>
  );
}

function ConnBadge({ status }: { status: ConnectionStatus }) {
  const map = {
    connected: { label: "Live", cls: "bg-emerald-500/20 text-emerald-300", icon: <Wifi className="h-3 w-3" /> },
    connecting: { label: "Connecting", cls: "bg-amber-500/20 text-amber-300", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    reconnecting: { label: "Reconnecting", cls: "bg-amber-500/20 text-amber-300", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    disconnected: { label: "Offline", cls: "bg-rose-500/20 text-rose-300", icon: <WifiOff className="h-3 w-3" /> },
  }[status];

  return (
    <Badge className={cn("border-transparent", map.cls)}>
      {map.icon} {map.label}
    </Badge>
  );
}
