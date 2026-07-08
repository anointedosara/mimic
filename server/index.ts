// Custom Next.js server that also hosts the Socket.IO real-time layer.
// Run with `npm run dev` (tsx) — see package.json.

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { config as loadEnv } from "dotenv";
import { initSocketServer } from "./socket";

// Load env (.env.local first, then .env) when not already injected.
loadEnv({ path: ".env.local" });
loadEnv();

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url ?? "", true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[server] request error", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  initSocketServer(server);

  server.listen(port, () => {
    console.log(`\n  ▲ MIMIC ready on http://localhost:${port}  (${dev ? "dev" : "production"})\n`);
  });
});
