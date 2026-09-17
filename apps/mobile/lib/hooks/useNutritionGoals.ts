import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PatchBodyProfileRequest,
  PostAnthropometricsRequest,
  PostNutritionGoalsRequest,
} from "@fitbrother/shared";
import {
  getCurrentAnthropometrics,
  getCurrentNutritionGoals,
  getSuggestedNutritionGoals,
  patchBodyProfile,
  postAnthropometrics,
  postNutritionGoals,
} from "@/lib/api/account";
import { accountProfileKey } from "./useAccountProfile";
import { dailySummariesHistoryKey } from "./useDailySummaries";

export const currentAnthropometricsKey = ["account", "anthropometrics", "current"] as const;
export const currentNutritionGoalsKey = ["account", "nutrition-goals", "current"] as const;
export const suggestedNutritionGoalsKey = ["account", "nutrition-goals", "suggested"] as const;

export function useCurrentAnthropometrics() {
  return useQuery({ queryKey: currentAnthropometricsKey, queryFn: getCurrentAnthropometrics });
}

export function useCurrentNutritionGoals() {
  return useQuery({ queryKey: currentNutritionGoalsKey, queryFn: getCurrentNutritionGoals });
}

// `enabled: false` por padrão — a sugestão só faz sentido buscar sob demanda
// (usuário mudou peso/atividade/objetivo e o app quer oferecer "recalcular
// metas?"), não em toda visita à tela.
export function useSuggestedNutritionGoals(enabled: boolean) {
  return useQuery({
    queryKey: suggestedNutritionGoalsKey,
    queryFn: getSuggestedNutritionGoals,
    enabled,
  });
}

// Invalida o cache do dashboard também: o RPC do servidor já recomputa o
// snapshot de hoje em `daily_summaries`, mas sem isso o anel de calorias
// continuaria mostrando o valor antigo até o próximo refetch automático.
function invalidateDashboard(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["daily-summary"] });
  qc.invalidateQueries({ queryKey: dailySummariesHistoryKey });
}

export function usePostNutritionGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PostNutritionGoalsRequest) => postNutritionGoals(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: currentNutritionGoalsKey });
      invalidateDashboard(qc);
    },
  });
}

export function usePostAnthropometrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PostAnthropometricsRequest) => postAnthropometrics(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: currentAnthropometricsKey });
      qc.invalidateQueries({ queryKey: suggestedNutritionGoalsKey });
    },
  });
}

export function usePatchBodyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchBodyProfileRequest) => patchBodyProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountProfileKey });
      qc.invalidateQueries({ queryKey: suggestedNutritionGoalsKey });
    },
  });
}
