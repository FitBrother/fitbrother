import type { FastifyInstance } from "fastify";
import { RegisterPushTokenRequestSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";

export async function pushTokensRoutes(app: FastifyInstance) {
  // Register (or re-activate) an Expo push token for the current user.
  //
  // Uses the service-role client and upserts on the UNIQUE `token`: a device
  // that previously belonged to another account (shared/reinstalled device)
  // gets reassigned to the current user and un-revoked. RLS WITH CHECK would
  // block that cross-user reassignment from the user-scoped client, so this is
  // a legitimate backend op — we still scope it to the authenticated user id.
  app.post("/push-tokens", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = RegisterPushTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_body" });
    }

    const { token, platform } = parsed.data;
    const { error } = await supabaseService()
      .from("push_tokens")
      .upsert(
        { token, platform, user_id: req.user!.id, revoked_at: null },
        { onConflict: "token" },
      );

    if (error) {
      req.log.error({ err: error }, "push_token_register_failed");
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(204).send();
  });
}
