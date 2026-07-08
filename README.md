# 🎭 MIMIC — Can you blend in, or will you be exposed? 😈

A **production-ready, real-time multiplayer social-deduction word game**. Everyone in the room gets the same secret word — except the hidden **imposters**, who only receive a *related hint*. Players discuss, deduce, and vote out the mimics before they blend in and win.

> **Real Word:** `Pizza` · **Imposter Hint:** `Cheese`
> **Real Word:** `Beach` · **Imposter Hint:** `Sand`
> **Real Word:** `Football` · **Imposter Hint:** `Goal`

Imposters **never** learn the real word — or even who the other imposters are.

---

## ✨ Features

- 🕵️ **Hidden imposters** — imposters don't know the word *or each other*. The server is the only source of truth for roles.
- ⚡ **Real-time** — Socket.IO keeps every device in sync: live votes, synced timers, instant reveals.
- 🔒 **Server-authoritative & anti-cheat** — roles live only on the server; no network payload ever exposes another player's role.
- 🔁 **Refresh-proof** — full state persistence. Refresh, disconnect, or crash — you reconnect exactly where you left off.
- 👑 **Host migration** — if the host leaves, a new host is promoted automatically.
- 🎨 **Premium UI** — dark gaming aesthetic, glassmorphism, animated gradients, Framer Motion, confetti, synthesized sound effects.
- 📊 **Player statistics** — games played, wins, losses, times as imposter, times caught, win rate.
- 🧑‍🚀 **24 avatars**, 3–20 players, 1–6 imposters, preset & custom timers.
- 📚 **500+ words** across 30 categories with indirect hints.
- 📱 **PWA** + fully responsive + accessible + SEO.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript** + **React 19** |
| Styling | **Tailwind CSS** + **shadcn/ui** (Radix primitives) |
| Animation | **Framer Motion** + `canvas-confetti` |
| Realtime | **Socket.IO** (custom Node server) |
| State | **Zustand** (game state) + **TanStack Query** (server data) |
| Auth | **NextAuth (Auth.js)** — credentials + JWT sessions |
| Database | **MongoDB** + **Mongoose** |
| Testing | **Vitest** (unit) + **Playwright** (E2E) |
| Deploy | **Docker** / Railway / Render / Fly.io (+ MongoDB Atlas) |

---

## 📁 Folder Structure

```
mimic/
├── server/                      # Custom Node server (Next.js + Socket.IO)
│   ├── index.ts                 # HTTP + Next.js + Socket.IO bootstrap
│   ├── socket.ts                # Socket auth (NextAuth JWT) + event wiring
│   └── game/
│       ├── manager.ts           # Game state machine (server-authoritative)
│       ├── snapshot.ts          # Public snapshot / private-role projection
│       └── words.ts             # Random word picker (DB → bundled fallback)
├── scripts/seed.ts              # Seed the words collection
├── src/
│   ├── app/                     # App Router pages + API routes
│   │   ├── page.tsx             # /            landing
│   │   ├── login/               # /login       signup + login (+ avatar)
│   │   ├── profile/             # /profile     stats + avatar management
│   │   ├── create-room/         # /create-room room config
│   │   ├── join/                # /join        join by code
│   │   ├── room/[code]/         # /room/[code] lobby + gameplay
│   │   └── api/                 # auth, signup, profile, rooms
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   └── game/                # lobby, discussion, voting, reveal, ...
│   ├── hooks/                   # use-room, use-countdown
│   ├── lib/
│   │   ├── auth/                # NextAuth options + session helper
│   │   ├── db/                  # mongoose connection + models
│   │   ├── game/                # types, config, engine (pure), events
│   │   ├── data/words.ts        # 500+ word database
│   │   ├── avatars.ts, sounds.ts, confetti.ts, rate-limit.ts, validation.ts
│   └── store/game-store.ts      # Zustand client store
├── e2e/                         # Playwright specs
├── Dockerfile · docker-compose.yml
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+**
- **MongoDB** — local (`mongodb://localhost:27017/mimic`) or [MongoDB Atlas](https://www.mongodb.com/atlas).

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/mimic
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

### 3. Seed the word database
```bash
npm run seed
```

### 4. Run the dev server
```bash
npm run dev
```
Open **http://localhost:3000**. Sign up, create a room, and share the code.

> 💡 To play locally with "multiple players", open the room in several browser profiles / incognito windows and sign up as different users.

### Scripts
| Command | Description |
|---|---|
| `npm run dev` | Dev server (Next.js + Socket.IO via tsx) |
| `npm run build` | Production Next.js build |
| `npm run start` | Production server |
| `npm run seed` | Seed words into MongoDB |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run typecheck` | TypeScript check |

---

## 🏛️ Architecture

### Game State Machine
```
lobby ──start──▶ role ──(5s)──▶ discussion ──timer/voteEarly──▶ voting ──host reveal──▶ reveal
  ▲                                                                                        │
  └────────────────────────────── (host) playAgain ◀──────────────────────────────────────┘
```
Every transition is validated **server-side** in [`server/game/manager.ts`](server/game/manager.ts) and persisted to MongoDB, so the flow survives refreshes and restarts.

### Socket Events (contract in [`src/lib/game/events.ts`](src/lib/game/events.ts))
**Client → Server:** `room:join`, `room:leave`, `room:requestSync`, `room:updateSettings`, `room:kick`, `game:start`, `game:voteEarly`, `game:castVote`, `game:reveal`, `game:playAgain`

**Server → Client:** `room:state` (public snapshot), `game:role` (private, per-socket), `room:notice` (toasts/sfx), `room:closed`, `error`

Each socket joins two Socket.IO rooms: `room:<CODE>` (broadcast) and `user:<CODE>:<USERID>` (private). Private role payloads are emitted **only** to the `user:*` room.

### 🔐 Hidden-Imposter Guarantee (anti-cheat)
The single choke point is [`server/game/snapshot.ts`](server/game/snapshot.ts):
- `buildSnapshot()` produces the **public** state broadcast to everyone — it contains **no** `role`, `word`, `hint`, or `votedFor` secret fields.
- `buildPrivateRole()` returns **one** player's own info, sent only to their `user:*` room.

A normal player receives `{ role: "player", word: "Pizza" }`; an imposter receives `{ role: "imposter", hint: "Cheese" }`. **No payload ever contains the list of imposters.** Roles are revealed only after the host clicks **Reveal**.

### Reconnection Strategy
1. Socket.IO auto-reconnects (infinite attempts, backoff).
2. On (re)connect the client emits `room:join` then `room:requestSync`.
3. The server marks the player `connected`, re-sends the authoritative snapshot **and** the player's private role.
4. Discussion timers are stored as an absolute `timerEndsAt` and **re-armed on server restart** (`rehydrateTimers`), so the countdown stays correct across disconnects.

### State Management
- **Zustand** ([`src/store/game-store.ts`](src/store/game-store.ts)) holds the live snapshot, the player's private role, and connection status.
- **TanStack Query** handles REST data (profile/stats).
- **NextAuth** persists the session (JWT).

---

## 🗃️ Database Schema

**User** — `displayName`, `email` (unique), `passwordHash`, `avatar`, `statistics { gamesPlayed, wins, losses, timesAsImposter, timesCaught }` (+ virtual `winRate`).

**Room** — `code` (unique), `hostId`, `phase`, `round`, `settings { maxPlayers, imposterCount, durationSeconds }`, `players[]`, `currentCategory`, `timerEndsAt`. Each embedded **Player** carries server-only secret fields (`role`, `word`, `hint`, `votedFor`) that never leave the server. Rooms auto-expire after 12h of inactivity (TTL index).

**Word** — `word`, `imposterHint`, `category` (unique on `word+category`).

---

## 🧪 Testing
```bash
npm test            # unit: pure game engine, config rules, word DB integrity
npm run test:e2e    # E2E: landing, auth gating, How-to-Play modal
```
The pure engine ([`src/lib/game/engine.ts`](src/lib/game/engine.ts)) is fully unit-tested with a seeded RNG, including role assignment invariants and win resolution.

---

## 🐳 Docker
```bash
# App + MongoDB together (seeds automatically on boot):
docker compose up --build
```
App on http://localhost:3000, MongoDB on `:27017`. Set a real `NEXTAUTH_SECRET` in your environment for production.

---

## ☁️ Deployment

### Realtime note (important)
MIMIC uses a **long-lived Socket.IO server**, which **Vercel's serverless functions cannot host**. Two supported paths:

**A. Single-service host (recommended)** — deploy the whole app (Next.js + Socket.IO) to **Railway**, **Render**, or **Fly.io**:
1. Provision **MongoDB Atlas**, whitelist your host, copy the connection string.
2. Set env vars: `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL` (all pointing at your deployed URL).
3. Build `npm run build`, start `npm run start`. Run `npm run seed` once.
4. Or just deploy the included **Dockerfile** — these platforms build it directly.

**B. Split hosting** — Next.js frontend on **Vercel** + the Socket.IO server on Railway/Render. Point `NEXT_PUBLIC_SOCKET_URL` at the socket host and enable CORS credentials.

### MongoDB Atlas quickstart
1. Create a free cluster → **Database Access** (user/password) → **Network Access** (allow your host / `0.0.0.0/0` for testing).
2. **Connect → Drivers** → copy the `mongodb+srv://…` URI → set `MONGODB_URI` (append `/mimic`).
3. `npm run seed`.

---

## ♿ Accessibility & SEO
- Semantic roles, `aria-label`s on icon buttons/avatars, keyboard-navigable dialogs (Radix), `prefers-reduced-motion` support, focus rings.
- Rich metadata, Open Graph/Twitter cards, web manifest, theme color, SVG icon.

---

## 📜 License
MIT — build on it, remix it, host your own game night.

Built with ❤️ using Next.js, Socket.IO & MongoDB.
#   m i m i c  
 