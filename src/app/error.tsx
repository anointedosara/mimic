"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="glass-strong max-w-md space-y-6 rounded-3xl p-10">
        <Logo size="sm" />
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">Something broke</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Your game state is safe on the server — try again.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="gradient" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
