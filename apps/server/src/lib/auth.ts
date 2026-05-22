import type { FastifyReply, FastifyRequest } from "fastify";
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
}

export function supabaseForRequest(req: FastifyRequest) {
  if (!req.user) {
    throw new Error("supabaseForRequest called on unauthenticated request");
  }
  return supabaseFromJwt(req.user.accessToken);
}
