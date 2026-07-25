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

export async function authTokenRequired(req: FastifyRequest, reply: FastifyReply): Promise<void> {
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

  const isolationScope = Sentry.getIsolationScope();
  isolationScope.setUser({ id: req.user.id });
  isolationScope.setTag("request_id", req.id);
}

export async function activeAccountRequired(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!req.user) {
    return reply.code(401).send({ error: "authentication required" });
  }

  const { data: deletion, error: deletionError } = await supabaseService()
    .from("account_deletions")
    .select("requested_at, scheduled_purge_at")
    .eq("user_id", req.user.id)
    .is("cancelled_at", null)
    .is("purged_at", null)
    .maybeSingle();

  if (deletionError) {
    req.log.error({ err: deletionError, user_id: req.user.id }, "account_deletion_check_failed");
    return reply.code(500).send({ error: deletionError.message });
  }

  if (deletion) {
    req.log.info({ user_id: req.user.id }, "account_deletion_pending");
    return reply.code(401).send({
      error: "account_deletion_pending",
      requested_at: deletion.requested_at,
      scheduled_purge_at: deletion.scheduled_purge_at,
      can_reactivate: new Date(deletion.scheduled_purge_at) > new Date(),
    });
  }
}

export async function authRequired(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authTokenRequired(req, reply);
  if (reply.sent) return;
  await activeAccountRequired(req, reply);
}

export function supabaseForRequest(req: FastifyRequest) {
  if (!req.user) {
    throw new Error("supabaseForRequest called on unauthenticated request");
  }
  return supabaseFromJwt(req.user.accessToken);
}
