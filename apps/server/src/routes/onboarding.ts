import { OnboardingPayloadSchema } from "@fitbrother/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { deleteAuthUserAndAudit, removeUserStorage } from "../lib/account-purge.js";
import { internalError } from "../lib/errors.js";
import { supabaseService } from "../lib/supabase.js";
import { buildTargetsInput, computeTargets, evaluateSafetyGates } from "../services/targets.js";

const PatchOnboardingProgressRequestSchema = z.object({
  current_block: z.string().min(1).max(50),
  answers: z.record(z.string(), z.unknown()),
});

type SignupConflictRow = {
  user_id: string;
  is_anonymous: boolean;
  email_change_sent_at: string | null;
  has_profile: boolean;
};

// Uma conta abandonada logo após "Crie sua conta" (nunca confirmou o e-mail)
// não tem como saber se a troca de e-mail pendente é uma tentativa ativa
// (mesma pessoa, segundos atrás) ou já morreu de vez — esse prazo é a
// margem de segurança antes de presumir abandono e liberar o e-mail pro
// cadastro novo.
const SIGNUP_CONFLICT_STALE_MS = 15 * 60_000;

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
      // fitbrother_assert_required_consents (RPC) recusou o payload — mesma
      // causa que o Zod acima já deveria ter pego (payload sem um consent
      // obrigatório, ex.: client desatualizado sem o campo mais novo). Trata
      // como invalid_payload, não internal_error: o cliente já sabe mostrar
      // "atualize o app" pra esse código, em vez de uma falha opaca.
      if (error.code === "P0001" && error.message === "REQUIRED_CONSENT_MISSING") {
        return reply.code(400).send({ error: "invalid_payload" });
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

  app.post(
    "/onboarding/resolve-signup-conflict",
    { preHandler: [authRequired] },
    async (req, reply) => {
      const userId = req.user!.id;
      const email = req.user!.email;
      if (!email) return reply.send({ resolved: true });

      const admin = supabaseService();
      const { data, error } = await admin.rpc("fitbrother_find_signup_conflict", {
        p_user_id: userId,
        p_email: email,
      });
      if (error) {
        return internalError(reply, req.log, error, {
          user_id: userId,
          where: "resolve_signup_conflict",
        });
      }

      for (const row of (data ?? []) as SignupConflictRow[]) {
        // email_change_sent_at nulo é um estado ambíguo (não deveria
        // acontecer em produção — sendEmailChange sempre marca esse campo)
        // — trata como "não sei há quanto tempo", não como "está velho o
        // suficiente". Apagar conta de outra pessoa merece o lado
        // conservador: só resolve sozinho quando a idade é conhecida e
        // realmente passou do prazo.
        const stale =
          row.is_anonymous &&
          !row.has_profile &&
          row.email_change_sent_at !== null &&
          Date.now() - new Date(row.email_change_sent_at).getTime() > SIGNUP_CONFLICT_STALE_MS;

        if (!stale) {
          req.log.info(
            { user_id: userId, conflicting_user_id: row.user_id },
            "signup_conflict_blocked",
          );
          return reply.send({ resolved: false });
        }

        await removeUserStorage("meal-audios", row.user_id);
        await removeUserStorage("post-images", row.user_id);
        await deleteAuthUserAndAudit(
          row.user_id,
          "abandoned_signup_conflict",
          { reason: "superseded_by_new_signup", superseded_by: userId },
          req.log,
        );
      }

      return reply.send({ resolved: true });
    },
  );
}
