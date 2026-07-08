"use client";

import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Loader2, Headphones, AlertCircle } from "lucide-react";
import { useVoice } from "@/hooks/use-voice";
import { useVoiceStore } from "@/store/voice-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Compact voice-chat control bar. Voice is opt-in: the first click asks for the
 * mic (which also unlocks remote-audio autoplay). Once joined, players hear each
 * other peer-to-peer and can mute/unmute or leave.
 */
export function VoiceBar({ code, selfId }: { code: string; selfId: string }) {
  const { join, leave, toggleMic } = useVoice(code, selfId);
  const status = useVoiceStore((s) => s.status);
  const error = useVoiceStore((s) => s.error);
  const micOn = useVoiceStore((s) => s.micOn);
  const count = useVoiceStore((s) => s.connectedUserIds.length);

  if (status === "idle" || status === "error") {
    return (
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Voice chat</div>
            <p className="text-xs text-muted-foreground">
              {status === "error" ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {error}
                </span>
              ) : (
                "Talk to the table in real time."
              )}
            </p>
          </div>
        </div>
        <Button variant="gradient" size="sm" onClick={join}>
          <Mic className="h-4 w-4" /> {status === "error" ? "Try again" : "Join voice"}
        </Button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Connecting voice…</span>
      </div>
    );
  }

  // active
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold">Voice on</span>
        <span className="text-muted-foreground">· {count} connected</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={micOn ? "outline" : "destructive"}
          size="sm"
          onClick={toggleMic}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          className={cn(!micOn && "animate-none")}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {micOn ? "Mute" : "Unmute"}
        </Button>
        <Button variant="ghost" size="icon" onClick={leave} aria-label="Leave voice" title="Leave voice">
          <PhoneOff className="h-5 w-5 text-destructive" />
        </Button>
      </div>
    </motion.div>
  );
}
