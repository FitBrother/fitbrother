import { OnboardingPayloadSchema } from "@fitbrother/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";
import { buildTargetsInput, computeTargets, evaluateSafetyGates } from "../services/targets.js";

const PatchOnboardingProgressRequestSchema = z.object({
  current_block: z.string().min(1).max(50),
  answers: z.record(z.string(), z.unknown()),
});

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/complete", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = OnboardingPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const targetsInput = buildTargetsInput(parsed.data);
    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase.rpc("complete_onboarding", {
      payload: { ...parsed.data, targets, soft_mode },
    });

    if (error) {
      req.log.error({ err: error }, "onboarding_rpc_failed");
      if (error.code === "23505") {
        return reply.code(409).send({ error: "onboarding_already_completed" });
      }
      return internalError(reply, req.log, error);
    }

    return reply.code(201).send(data);
  });

  app.get("/onboarding/progress", { preHandler: [authRequired] }, async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("current_block, answers, updated_at")
      .maybeSingle();

    if (error) {
      return internalError(reply, req.log, error, { where: "onboarding_progress_get" });
    }

    return reply.send({ progress: data ?? null });
  });

  app.patch("/onboarding/progress", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = PatchOnboardingProgressRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);
    const { error } = await supabase.from("onboarding_progress").upsert(
      {
        user_id: userId,
        current_block: parsed.data.current_block,
        answers: parsed.data.answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return internalError(reply, req.log, error, { where: "onboarding_progress_patch" });
    }

    return reply.code(204).send();
  });
}
