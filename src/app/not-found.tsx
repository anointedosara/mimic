import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="glass-strong max-w-md space-y-6 rounded-3xl p-10">
        <Logo size="sm" />
        <div className="space-y-2">
          <h1 className="font-display text-6xl font-black text-gradient">404</h1>
          <p className="text-sm text-muted-foreground">
            This page vanished like an imposter in the crowd.
          </p>
        </div>
        <Button variant="gradient" asChild>
          <Link href="/">Back to safety</Link>
        </Button>
      </div>
    </div>
  );
}
