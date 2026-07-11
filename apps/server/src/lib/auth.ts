import type { FastifyReply, FastifyRequest } from "fastify";
import { Sentry } from "./sentry.js";
import { supabaseFromJwt, supabaseService } from "./supabase.js";

export type AuthUser = {
  id: string;
  email: string | null;
  accessToken: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const BEARER = /^Bearer\s+(.+)$/i;

export async function authRequired(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const match = header?.match(BEARER);
  if (!match) {
    return reply.code(401).send({ error: "missing bearer token" });
  }

  const accessToken = match[1]!;
  const { data, error } = await supabaseService().auth.getUser(accessToken);

  if (error || !data.user) {
    req.log.warn({ err: error }, "auth_token_rejected");
    return reply.code(401).send({ error: "invalid token" });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? null,
    accessToken,
  };

  Sentry.setUser({ id: req.user.id, email: req.user.email ?? undefined });
  Sentry.setTag("request_id", req.id);

  const { data: deletion, error: deletionError } = await supabaseService()
    .from("account_deletions")
    .select("scheduled_purge_at")
    .eq("user_id", req.user.id)
    .is("purged_at", null)
    .maybeSingle();

  if (deletionError) {
    req.log.error({ err: deletionError, user_id: req.user.id }, "account_deletion_check_failed");
    return reply.code(500).send({ error: deletionError.message });
  }

  if (deletion) {
    req.log.info({ user_id: req.user.id }, "account_deleted_token_rejected");
    return reply.code(401).send({
      error: "account_deleted",
      scheduled_purge_at: deletion.scheduled_purge_at,
    });
  }
}

export function supabaseForRequest(req: FastifyRequest) {
  if (!req.user) {
    throw new Error("supabaseForRequest called on unauthenticated request");
  }
  return supabaseFromJwt(req.user.accessToken);
}
