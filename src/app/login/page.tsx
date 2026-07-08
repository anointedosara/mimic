"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/create-room";

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup
  const [name, setName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].id);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or password");
    } else {
      playSound("join");
      router.push(callbackUrl);
      router.refresh();
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, email: suEmail, password: suPassword, avatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create account");
        setLoading(false);
        return;
      }
      // Auto sign-in after signup.
      const login = await signIn("credentials", { email: suEmail, password: suPassword, redirect: false });
      setLoading(false);
      if (login?.error) {
        toast.error("Account created — please sign in.");
        setTab("login");
        return;
      }
      playSound("start");
      toast.success(`Welcome, ${name}!`);
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setLoading(false);
      toast.error("Network error. Try again.");
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex justify-center">
          <Logo size="md" showTagline />
        </div>

        <Card className="p-6 sm:p-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    required
                    minLength={2}
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name in the game"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={suPassword}
                    onChange={(e) => setSuPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Choose your avatar</Label>
                  <div className="grid max-h-44 grid-cols-6 gap-2 overflow-y-auto rounded-xl bg-black/20 p-2">
                    {AVATARS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setAvatar(a.id);
                          playSound("click");
                        }}
                        aria-label={a.label}
                        aria-pressed={avatar === a.id}
                        className={cn(
                          "grid aspect-square place-items-center rounded-lg bg-gradient-to-br text-xl transition-all",
                          a.gradient,
                          avatar === a.id
                            ? "ring-2 ring-white scale-105 shadow-lg"
                            : "opacity-70 hover:opacity-100",
                        )}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LoginInner />
    </Suspense>
  );
}
