import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext, type CoachContext } from "@fitbrother/shared";

/**
 * Monta o CoachContext de um usuário a partir do banco. Funciona tanto com
 * um client autenticado (rota HTTP, RLS já escopa por auth.uid()) quanto
 * com o client de service-role (job de insights, sem sessão de usuário) —
 * por isso toda query filtra explicitamente por user_id, sem depender de
 * views que assumem auth.uid() (ex.: vw_today_summary).
 */
export async function loadCoachContext(
  client: SupabaseClient,
  userId: string,
): Promise<CoachContext> {
  const [profileQ, anthroQ, goalQ, todayQ] = await Promise.all([
    client
      .from("profiles")
      .select("goal, soft_mode, onboarding_context")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("anthropometrics")
      .select("training_days_per_week, strength_training")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("nutrition_goals")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .is("effective_to", null)
      .maybeSingle(),
    client.rpc("fitbrother_today", { p_user_id: userId }),
  ]);

  if (profileQ.error) throw new Error(`coach_context_profile_failed: ${profileQ.error.message}`);
  if (!profileQ.data) throw new Error("coach_context_profile_not_found");

  const today = todayQ.data as string | null;
  let todayConsumption: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null = null;
  if (today) {
    const { data: summary } = await client
      .from("daily_summaries")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if (summary) {
      todayConsumption = {
        kcal: summary.kcal,
        protein_g: summary.protein_g,
        carbs_g: summary.carbs_g,
        fat_g: summary.fat_g,
      };
    }
  }

  return buildCoachContext({
    goal: profileQ.data.goal,
    soft_mode: profileQ.data.soft_mode,
    onboarding_context: (profileQ.data.onboarding_context ?? {}) as Record<string, unknown>,
    training_days_per_week: anthroQ.data?.training_days_per_week ?? null,
    strength_training: anthroQ.data?.strength_training ?? null,
    current_goals: goalQ.data,
    today_consumption: todayConsumption,
  });
}
