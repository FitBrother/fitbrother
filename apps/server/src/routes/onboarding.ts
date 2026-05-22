import { OnboardingPayloadSchema } from "@fitbrother/shared";
import type { FastifyInstance } from "fastify";
import { authRequired, supabaseForRequest } from "../lib/auth.js";

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/complete", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = OnboardingPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase.rpc("complete_onboarding", {
      payload: parsed.data,
    });

    if (error) {
      req.log.error({ err: error }, "onboarding_rpc_failed");
      return reply.code(error.code === "23505" ? 409 : 500).send({ error: error.message });
    }

    return reply.code(201).send(data);
  });
}
