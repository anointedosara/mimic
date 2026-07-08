// ============================================================================
// ICE server configuration for WebRTC voice. Built on the server so TURN
// credentials never ship in the client bundle — the browser fetches the result
// from /api/voice/ice on join.
//
// STUN alone only connects peers reachable via their public address (typical
// home NATs). Peers on different networks behind strict/symmetric NATs need a
// TURN relay to exchange audio. Two ways to provide one:
//
//  1. Cloudflare Realtime TURN (recommended) — issues SHORT-LIVED credentials
//     via API, so nothing long-lived is exposed. Set:
//        CLOUDFLARE_TURN_KEY_ID=<Turn Token ID>
//        CLOUDFLARE_TURN_API_TOKEN=<API Token>
//
//  2. Static TURN (self-hosted coturn / any provider):
//        TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
//        TURN_USERNAME=<username>
//        TURN_CREDENTIAL=<password>
//
// Optionally override STUN with STUN_URLS (comma-separated).
// ============================================================================

/** Minimal, DOM-free shape matching RTCIceServer (this runs server-side). */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

// Credentials are minted per join(); a day is plenty for one sitting.
const CLOUDFLARE_TTL_SECONDS = 86400;

function list(env: string | undefined, fallback: string[] = []): string[] {
  if (!env) return fallback;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasStaticTurn(): boolean {
  return Boolean(process.env.TURN_URLS && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);
}

function hasCloudflareTurn(): boolean {
  return Boolean(process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN);
}

function hasMeteredTurn(): boolean {
  return Boolean(process.env.METERED_APP_NAME && process.env.METERED_API_KEY);
}

/** True when any TURN relay is configured. */
export function hasTurn(): boolean {
  return hasStaticTurn() || hasCloudflareTurn() || hasMeteredTurn();
}

/** Public STUN, plus any statically-configured TURN. Synchronous. */
export function buildStaticIceServers(): IceServer[] {
  const servers: IceServer[] = [];

  const stun = list(process.env.STUN_URLS, DEFAULT_STUN);
  if (stun.length) servers.push({ urls: stun });

  const turnUrls = list(process.env.TURN_URLS);
  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return servers;
}

/** Ask Cloudflare for short-lived TURN credentials. Returns [] if unset/failed. */
async function fetchCloudflareIce(): Promise<IceServer[]> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !apiToken) return [];

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: CLOUDFLARE_TTL_SECONDS }),
      },
    );
    if (!res.ok) {
      console.error("[voice/ice] Cloudflare TURN request failed", res.status);
      return [];
    }
    const data = (await res.json()) as { iceServers?: IceServer | IceServer[] };
    // Cloudflare has returned either a single object or an array across versions.
    const raw = data.iceServers;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  } catch (err) {
    console.error("[voice/ice] Cloudflare TURN error", err);
    return [];
  }
}

/** Ask Metered for TURN credentials. Returns [] if unset/failed. */
async function fetchMeteredIce(): Promise<IceServer[]> {
  const app = process.env.METERED_APP_NAME;
  const apiKey = process.env.METERED_API_KEY;
  if (!app || !apiKey) return [];

  // Accept either the bare app name ("myapp") or the full host ("myapp.metered.live").
  const host = app.includes(".") ? app : `${app}.metered.live`;
  try {
    const res = await fetch(
      `https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) {
      console.error("[voice/ice] Metered TURN request failed", res.status);
      return [];
    }
    // Metered returns a ready-to-use array of ICE servers (STUN + TURN).
    const data = (await res.json()) as IceServer[] | { iceServers?: IceServer[] };
    if (Array.isArray(data)) return data;
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch (err) {
    console.error("[voice/ice] Metered TURN error", err);
    return [];
  }
}

/**
 * The ICE list handed to clients: a managed TURN provider when configured (its
 * response bakes in STUN), otherwise static TURN/STUN. Always returns at least
 * STUN so same-network voice keeps working even if a provider call fails.
 */
export async function getIceServers(): Promise<IceServer[]> {
  if (hasCloudflareTurn()) {
    const cf = await fetchCloudflareIce();
    if (cf.length) return cf;
  }
  if (hasMeteredTurn()) {
    const metered = await fetchMeteredIce();
    if (metered.length) return metered;
  }
  // Fall through to STUN/static so voice degrades gracefully on provider errors.
  return buildStaticIceServers();
}
