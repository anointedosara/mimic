// ============================================================================
// Concrete Scheduler. Buffers armAdvance() calls and flushes them:
//   - Production: schedules a delayed QStash message that POSTs back to
//     /api/game/[code]/advance. QStash needs a public URL, so this only works
//     once deployed.
//   - Dev/local: an in-process setTimeout (the `next dev` Node process is
//     long-lived) that calls advanceRoom() directly — QStash can't reach
//     localhost.
//
// cancel() is intentionally a no-op: advancePhase() re-reads the room and only
// transitions when the phase/deadline still warrants it, so a stale callback is
// harmless. That means we never need to delete a scheduled QStash message.
// ============================================================================

import { Client } from "@upstash/qstash";
import type { FlushableScheduler } from "@/lib/game/scheduler";

const isProd = process.env.NODE_ENV === "production";

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function callbackUrl(code: string, kind: Job["kind"]): string {
  const path = kind === "ai" ? "ai-tick" : "advance";
  return `${appBaseUrl()}/api/game/${encodeURIComponent(code)}/${path}`;
}

interface Job {
  code: string;
  delayMs: number;
  kind: "advance" | "ai";
}

export function createScheduler(): FlushableScheduler {
  const jobs: Job[] = [];

  return {
    armAdvance(code, delayMs) {
      jobs.push({ code, delayMs, kind: "advance" });
    },
    armAI(code, delayMs) {
      jobs.push({ code, delayMs, kind: "ai" });
    },
    cancel() {
      // no-op — advancePhase()/aiChatTick() are self-guarding (see file header).
    },
    async flush() {
      if (jobs.length === 0) return;
      const pending = jobs.splice(0);

      if (isProd && process.env.QSTASH_TOKEN) {
        const qstash = new Client({ token: process.env.QSTASH_TOKEN });
        await Promise.all(
          pending.map((j) =>
            qstash.publishJSON({
              url: callbackUrl(j.code, j.kind),
              body: { code: j.code },
              delay: Math.max(0, Math.ceil(j.delayMs / 1000)), // QStash delay is in seconds
            }),
          ),
        );
        return;
      }

      // Dev fallback: fire in-process. Lazy import avoids a require cycle with
      // runtime.ts (runtime -> scheduler -> runtime).
      for (const j of pending) {
        setTimeout(
          () => {
            void import("@/lib/game/runtime")
              .then(({ advanceRoom, runAITick }) =>
                j.kind === "ai" ? runAITick(j.code) : advanceRoom(j.code),
              )
              .catch((e) => console.error(`[scheduler:dev] ${j.kind} failed`, e));
          },
          Math.max(0, j.delayMs),
        );
      }
    },
  };
}
