import type { FastifyInstance } from "fastify";
import proxy from "@fastify/http-proxy";
import { env } from "../lib/env.js";

/**
 * DEV-ONLY reverse proxy: /supabase/* → local Supabase (127.0.0.1:54321/*).
 *
 * Why: Docker-published ports (like :54321) often fail to reach mobile devices
 * on the LAN due to iptables/nftables quirks. The Fastify server listens on
 * a native host socket (:3000) that works everywhere. By proxying Supabase
 * through this server, the mobile app only needs to reach port 3000 — no
 * firewall rules, no Docker networking workarounds, works on any Wi-Fi.
 *
 * Supports HTTP (REST, Auth, Storage) and WebSocket (Realtime) automatically.
 * Disabled in production builds where the mobile app connects directly to the
 * hosted Supabase project URL.
 */
export async function supabaseProxyRoute(app: FastifyInstance) {
  if (env.NODE_ENV === "production") return;

  const upstream = env.SUPABASE_URL || "http://127.0.0.1:54321";

  await app.register(proxy, {
    upstream,
    prefix: "/supabase",
    websocket: true,
    rewritePrefix: "",
    // Propagate all headers (apikey, Authorization, etc.) as-is.
    replyOptions: {
      rewriteRequestHeaders: (_req, headers) => headers,
    },
  });

  app.log.info(`[proxy] /supabase/* → ${upstream} (HTTP + WebSocket)`);
}
