"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROOM_CODE_LENGTH } from "@/lib/game/config";
import { playSound } from "@/lib/sounds";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      const c = params.get("code");
      router.push(`/login?callbackUrl=${encodeURIComponent(`/join${c ? `?code=${c}` : ""}`)}`);
    }
  }, [status, router, params]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== ROOM_CODE_LENGTH) {
      toast.error(`Room codes are ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${trimmed}`);
      if (res.status === 404) {
        toast.error("No room with that code");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data.joinable && data.phase !== "lobby") {
        toast.error("That game is already in progress");
        setLoading(false);
        return;
      }
      playSound("click");
      router.push(`/room/${trimmed}`);
    } catch {
      toast.error("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="grid place-items-center px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Join a room</CardTitle>
              <CardDescription>Enter the 6-character code your host shared.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-5">
                <input
                  aria-label="Room code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH))
                  }
                  placeholder="ABC123"
                  autoFocus
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-6 text-center font-display text-4xl font-black uppercase tracking-[0.5em] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/50"
                />
                <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  Join room
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <JoinInner />
    </Suspense>
  );
}
