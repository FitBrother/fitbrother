import type { ActivityLevel, Goal, MacroKey, MacroPctBounds, MacroSplit } from "@fitbrother/shared";
import {
  editableRange,
  MACRO_KCAL_PER_G,
  redistributeMacro,
  scaleMacrosToKcal,
} from "@fitbrother/shared";
import { Flame } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { Button } from "@/components/Button";
import { SliderInput } from "@/components/SliderInput";
import { colors } from "@/lib/colors";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";
import {
  useCurrentAnthropometrics,
  useCurrentNutritionGoals,
  usePatchBodyProfile,
  usePostAnthropometrics,
  usePostNutritionGoals,
  useSuggestedNutritionGoals,
} from "@/lib/hooks/useNutritionGoals";
import { useToast } from "@/lib/toast/toast-context";

// Faixas de INTERFACE (min/max do slider) — não são recomendação nutricional.
// Existem só pra evitar erro de digitação grosseiro (ex. 200 kcal/dia).
// Pendente de validação da área de produto/nutrição antes de virar regra.
const KCAL_BOUNDS: [number, number] = [1200, 4500];
const MACRO_PCT_BOUNDS: MacroPctBounds = {
  protein_g: [10, 45],
  carbs_g: [5, 65],
  fat_g: [15, 45],
};
const MACRO_META: Record<
  MacroKey,
  { label: string; dot: string; badge: string; badgeText: string }
> = {
  protein_g: {
    label: "Proteína",
    dot: colors.protein[500],
    badge: colors.protein[100],
    badgeText: colors.protein[600],
  },
  carbs_g: {
    label: "Carboidratos",
    dot: colors.carbs[500],
    badge: colors.carbs[100],
    badgeText: colors.carbs[600],
  },
  fat_g: {
    label: "Gordura",
    dot: colors.fat[500],
    badge: colors.fat[100],
    badgeText: colors.fat[600],
  },
};
const MACRO_ORDER: MacroKey[] = ["protein_g", "carbs_g", "fat_g"];

// Mesmos limites de `WeightBlock`/`HeightBlock` do onboarding — mantém a
// experiência de editar peso/altura consistente em todo o app.
const WEIGHT_BOUNDS: [number, number] = [30, 200];
const HEIGHT_BOUNDS: [number, number] = [120, 220];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentário" },
  { value: "light", label: "Leve" },
  { value: "moderate", label: "Moderado" },
  { value: "active", label: "Ativo" },
  { value: "very_active", label: "Muito ativo" },
];
const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "lose", label: "Perder gordura" },
  { value: "maintain", label: "Manter peso" },
  { value: "gain", label: "Ganhar massa" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pctOf(key: MacroKey, macros: MacroSplit, kcal: number): number {
  if (kcal <= 0) return 0;
  return Math.round(((macros[key] * MACRO_KCAL_PER_G[key]) / kcal) * 100);
}

/**
 * Normaliza um par (kcal, macros) vindo de fora — carga inicial do servidor
 * ou uma sugestão do `computeTargets` — pras faixas de interface desta tela.
 * `computeTargets` roda seu próprio motor de segurança clínico, que não tem
 * por que coincidir com os limites arbitrários do slider aqui; sem isso, uma
 * meta calculada fora dessas faixas chegaria com `value` além do `max` do
 * `SliderInput`. Só clampa por macro (sem redistribuir) — é uma correção de
 * ponto único, não uma edição ao vivo, então uma pequena divergência entre a
 * soma dos macros e `kcal` é aceitável (a mesma tolerância de 5% do servidor
 * cobre isso) e se autocorrige no primeiro toque do usuário em qualquer slider.
 */
function sanitizeGoal(
  rawKcal: number,
  rawMacros: MacroSplit,
): { kcal: number; macros: MacroSplit } {
  const kcal = clamp(Math.round(rawKcal), KCAL_BOUNDS[0], KCAL_BOUNDS[1]);
  const scaled = scaleMacrosToKcal(rawMacros, kcal);
  const macros = { ...scaled };
  for (const key of MACRO_ORDER) {
    const [minPct, maxPct] = MACRO_PCT_BOUNDS[key];
    macros[key] = clamp(
      macros[key],
      ((minPct / 100) * kcal) / MACRO_KCAL_PER_G[key],
      ((maxPct / 100) * kcal) / MACRO_KCAL_PER_G[key],
    );
  }
  return { kcal, macros };
}

export default function GoalsScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<"macros" | "body">("macros");

  const account = useAccountProfile();
  const currentGoal = useCurrentNutritionGoals();
  const currentBody = useCurrentAnthropometrics();
  const postGoals = usePostNutritionGoals();
  const postBody = usePostAnthropometrics();
  const patchProfile = usePatchBodyProfile();

  const [kcal, setKcal] = useState<number | null>(null);
  const [macros, setMacros] = useState<MacroSplit | null>(null);
  const [source, setSource] = useState<"manual" | "recalculated">("manual");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  // Hidrata os campos locais só na primeira carga — depois disso o usuário
  // está editando, e um refetch em segundo plano não pode pisar em cima do
  // que ele já mexeu na tela.
  useEffect(() => {
    if (currentGoal.data?.goal && kcal === null) {
      const sanitized = sanitizeGoal(currentGoal.data.goal.kcal, {
        protein_g: currentGoal.data.goal.protein_g,
        carbs_g: currentGoal.data.goal.carbs_g,
        fat_g: currentGoal.data.goal.fat_g,
      });
      setKcal(sanitized.kcal);
      setMacros(sanitized.macros);
    }
  }, [currentGoal.data, kcal]);

  useEffect(() => {
    if (currentBody.data?.anthropometrics && weight === null) {
      setWeight(currentBody.data.anthropometrics.weight_kg);
      setHeight(currentBody.data.anthropometrics.height_cm);
    }
  }, [currentBody.data, weight]);

  useEffect(() => {
    if (account.data?.profile && activityLevel === null) {
      setActivityLevel(account.data.profile.activity_level);
      setGoal(account.data.profile.goal);
    }
  }, [account.data, activityLevel]);

  const suggested = useSuggestedNutritionGoals(Boolean(currentGoal.data?.goal));
  const activeKcal = currentGoal.data?.goal?.kcal;
  const suggestedKcal = suggested.data?.kcal;
  const showRecalcBanner =
    !bannerDismissed &&
    activeKcal != null &&
    suggestedKcal != null &&
    Math.abs(suggestedKcal - activeKcal) >= Math.max(100, activeKcal * 0.03);

  function handleKcalChange(nextKcal: number) {
    const clamped = clamp(Math.round(nextKcal), KCAL_BOUNDS[0], KCAL_BOUNDS[1]);
    setKcal(clamped);
    setSource("manual");
    setMacros((prev) => (prev ? scaleMacrosToKcal(prev, clamped) : prev));
  }

  function handleMacroChange(key: MacroKey, grams: number) {
    if (macros === null || kcal === null) return;
    // `editableRange` já leva em conta o efeito na REDISTRIBUIÇÃO — clampar
    // só na faixa própria do macro editado (10–45% de proteína, por ex.) não
    // basta: zerar a gordura pode empurrar o carboidrato pra além do teto
    // dele, porque a redistribuição olha só a proporção entre os outros dois,
    // não a faixa de cada um.
    const { minGrams, maxGrams } = editableRange(macros, key, MACRO_PCT_BOUNDS, kcal);
    setSource("manual");
    setMacros(redistributeMacro(macros, key, clamp(Math.max(grams, 0), minGrams, maxGrams)));
  }

  function applySuggestion() {
    if (!suggested.data) return;
    const sanitized = sanitizeGoal(suggested.data.kcal, {
      protein_g: suggested.data.protein_g,
      carbs_g: suggested.data.carbs_g,
      fat_g: suggested.data.fat_g,
    });
    setKcal(sanitized.kcal);
    setMacros(sanitized.macros);
    setSource("recalculated");
    setBannerDismissed(true);
  }

  async function saveGoals() {
    if (kcal === null || macros === null) return;
    const prev = currentGoal.data?.goal;
    const proteinG = Math.round(macros.protein_g);
    const carbsG = Math.round(macros.carbs_g);
    const fatG = Math.round(macros.fat_g);
    // Sem isso, reabrir a tela e apertar "Salvar" sem mexer em nada
    // fecharia a meta vigente e abriria outra idêntica — fragmenta o
    // histórico à toa.
    if (
      prev &&
      prev.kcal === kcal &&
      Math.round(prev.protein_g) === proteinG &&
      Math.round(prev.carbs_g) === carbsG &&
      Math.round(prev.fat_g) === fatG
    ) {
      toast({ variant: "success", message: "Nenhuma alteração para salvar" });
      return;
    }
    try {
      await postGoals.mutateAsync({
        kcal,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        source,
      });
      toast({ variant: "success", message: "Metas atualizadas" });
    } catch {
      toast({ variant: "error", message: "Não foi possível salvar suas metas" });
    }
  }

  async function saveBody() {
    if (weight === null || height === null || activityLevel === null || goal === null) return;
    const prevAnthro = currentBody.data?.anthropometrics;
    const profile = account.data?.profile;
    const weightChanged =
      !prevAnthro || prevAnthro.weight_kg !== weight || prevAnthro.height_cm !== height;
    const profileChanged =
      !profile || profile.activity_level !== activityLevel || profile.goal !== goal;
    if (!weightChanged && !profileChanged) {
      toast({ variant: "success", message: "Nenhuma alteração para salvar" });
      return;
    }
    try {
      // anthropometrics é append-only: só grava uma linha nova quando o
      // peso/altura realmente mudou, senão o histórico ganha um ponto
      // duplicado no gráfico de evolução a cada visita à tela.
      if (weightChanged) {
        await postBody.mutateAsync({ weight_kg: weight, height_cm: height });
      }
      if (profileChanged) {
        await patchProfile.mutateAsync({ activity_level: activityLevel, goal });
      }
      setBannerDismissed(false);
      toast({ variant: "success", message: "Dados do corpo atualizados" });
    } catch {
      toast({ variant: "error", message: "Não foi possível salvar" });
    }
  }

  const loading = account.isLoading || currentGoal.isLoading || currentBody.isLoading;

  if (loading || kcal === null || macros === null) {
    return (
      <AccountScreen title="Metas e macros">
        <View className="items-center py-10">
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      </AccountScreen>
    );
  }

  return (
    <AccountScreen
      title="Metas e macros"
      subtitle="Ajuste suas calorias e macros — o resto se recalcula automaticamente."
    >
      <View className="flex-row gap-1 rounded-full bg-neutral-100 p-1">
        <Pressable
          onPress={() => setTab("macros")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "macros" }}
          className={`min-h-[36px] flex-1 items-center justify-center rounded-full ${tab === "macros" ? "bg-white" : ""}`}
        >
          <Text
            className={`font-sans-semibold text-sm ${tab === "macros" ? "text-neutral-900" : "text-neutral-500"}`}
          >
            Calorias &amp; macros
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("body")}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "body" }}
          className={`min-h-[36px] flex-1 items-center justify-center rounded-full ${tab === "body" ? "bg-white" : ""}`}
        >
          <Text
            className={`font-sans-semibold text-sm ${tab === "body" ? "text-neutral-900" : "text-neutral-500"}`}
          >
            Meu corpo
          </Text>
        </Pressable>
      </View>

      {tab === "macros" ? (
        <>
          {showRecalcBanner && suggested.data ? (
            <View className="gap-2 rounded-2xl border border-warning-200 bg-warning-50 p-4">
              <View className="flex-row items-center gap-2">
                <Flame size={16} color={colors.warning[500]} />
                <Text className="font-sans-bold text-sm text-warning-700">
                  Seu perfil mudou — recalcular metas?
                </Text>
              </View>
              <Text className="font-sans text-xs leading-5 text-warning-700">
                Com os dados mais recentes, seu gasto estimado sugere{" "}
                <Text className="font-sans-semibold" style={{ fontVariant: ["tabular-nums"] }}>
                  {Math.round(suggested.data.kcal)} kcal/dia
                </Text>
                . Suas metas atuais continuam ativas até você decidir.
              </Text>
              {suggested.data.blocked ? (
                <Text className="font-sans-semibold text-xs text-danger-600">
                  {suggested.data.block_reason ?? "Não foi possível calcular uma sugestão segura."}
                </Text>
              ) : (
                <View className="mt-1 flex-row gap-2">
                  <Button
                    label="Manter atual"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => setBannerDismissed(true)}
                  />
                  <Button
                    label="Recalcular"
                    variant="dark"
                    size="sm"
                    className="flex-1"
                    onPress={applySuggestion}
                  />
                </View>
              )}
            </View>
          ) : null}

          <AccountCard>
            <Text className="text-center font-sans-semibold text-xs uppercase tracking-wide text-neutral-500">
              Calorias diárias
            </Text>
            <View className="mt-1 flex-row items-baseline justify-center gap-1.5">
              <Text
                className="font-display-bold text-4xl text-neutral-900"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {kcal.toLocaleString("pt-BR")}
              </Text>
              <Text className="font-sans-semibold text-sm text-neutral-500">kcal/dia</Text>
            </View>
            <View className="mt-3">
              <SliderInput
                label="Calorias"
                min={KCAL_BOUNDS[0]}
                max={KCAL_BOUNDS[1]}
                step={10}
                value={kcal}
                unit="kcal"
                markerValue={suggested.data ? Math.round(suggested.data.kcal) : undefined}
                onChange={handleKcalChange}
              />
            </View>
          </AccountCard>

          <AccountCard>
            <Text className="mb-1 font-sans-semibold text-xs uppercase tracking-wide text-neutral-500">
              Distribuição de macros
            </Text>
            <View className="flex-row overflow-hidden rounded-full" style={{ height: 10 }}>
              {MACRO_ORDER.map((key) => (
                <View
                  key={key}
                  style={{
                    width: `${pctOf(key, macros, kcal)}%`,
                    backgroundColor: MACRO_META[key].dot,
                  }}
                />
              ))}
            </View>

            {MACRO_ORDER.map((key, index) => (
              <View
                key={key}
                className={index === 0 ? "mt-4" : "mt-4 border-t border-neutral-100 pt-4"}
              >
                <View className="mb-1 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: MACRO_META[key].dot }}
                    />
                    <Text className="font-sans-semibold text-sm text-neutral-800">
                      {MACRO_META[key].label}
                    </Text>
                  </View>
                  <Text
                    className="overflow-hidden rounded-full px-2 py-0.5 font-sans-bold text-xs"
                    style={{
                      backgroundColor: MACRO_META[key].badge,
                      color: MACRO_META[key].badgeText,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {pctOf(key, macros, kcal)}%
                  </Text>
                </View>
                {(() => {
                  // Faixa real desta interação, não só a faixa "nua" do
                  // macro — ver o comentário de `editableRange`.
                  const range = editableRange(macros, key, MACRO_PCT_BOUNDS, kcal);
                  const min = Math.floor(range.minGrams);
                  const max = Math.max(min, Math.ceil(range.maxGrams));
                  return (
                    <SliderInput
                      label={MACRO_META[key].label}
                      min={min}
                      max={max}
                      step={1}
                      value={clamp(Math.round(macros[key]), min, max)}
                      unit="g"
                      onChange={(v) => handleMacroChange(key, v)}
                    />
                  );
                })()}
              </View>
            ))}

            <Text className="mt-2 font-sans text-xs leading-5 text-neutral-500">
              Mudar um macro redistribui os outros dois na mesma proporção entre si — as calorias
              totais não mudam. Mudar as calorias mantém a divisão e reescala os gramas.
            </Text>
          </AccountCard>

          <Button
            label="Salvar metas"
            variant="primary"
            loading={postGoals.isPending}
            onPress={saveGoals}
          />
          <Text className="text-center font-sans text-xs text-neutral-400">
            Suas metas anteriores continuam no histórico — nada é sobrescrito.
          </Text>
        </>
      ) : (
        <>
          <AccountCard>
            <Text className="font-sans-semibold text-base text-neutral-900">Peso e altura</Text>
            <View className="mt-3">
              <SliderInput
                label="Peso"
                min={WEIGHT_BOUNDS[0]}
                max={WEIGHT_BOUNDS[1]}
                step={0.5}
                value={weight ?? WEIGHT_BOUNDS[0]}
                unit="kg"
                onChange={setWeight}
              />
            </View>
            <View className="mt-4">
              <SliderInput
                label="Altura"
                min={HEIGHT_BOUNDS[0]}
                max={HEIGHT_BOUNDS[1]}
                step={1}
                value={height ?? HEIGHT_BOUNDS[0]}
                unit="cm"
                onChange={setHeight}
              />
            </View>
            <Text className="mt-3 font-sans text-xs leading-5 text-neutral-500">
              Cada alteração vira um novo registro com data — dá pra ver sua evolução no Histórico.
            </Text>
          </AccountCard>

          <AccountCard>
            <Text className="mb-2 font-sans-semibold text-base text-neutral-900">
              Nível de atividade
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setActivityLevel(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activityLevel === opt.value }}
                  className={`min-h-[40px] justify-center rounded-full border px-4 ${
                    activityLevel === opt.value
                      ? "border-neutral-900 bg-neutral-900"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans-semibold text-sm ${
                      activityLevel === opt.value ? "text-white" : "text-neutral-700"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </AccountCard>

          <AccountCard>
            <Text className="mb-2 font-sans-semibold text-base text-neutral-900">Objetivo</Text>
            <View className="flex-row flex-wrap gap-2">
              {GOAL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setGoal(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: goal === opt.value }}
                  className={`min-h-[40px] justify-center rounded-full border px-4 ${
                    goal === opt.value
                      ? "border-neutral-900 bg-neutral-900"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans-semibold text-sm ${
                      goal === opt.value ? "text-white" : "text-neutral-700"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-3 font-sans text-xs leading-5 text-neutral-500">
              Trocar o peso, a atividade ou o objetivo pode sugerir novas metas de calorias na aba
              anterior — suas metas atuais só mudam se você aceitar.
            </Text>
          </AccountCard>

          <Button
            label="Salvar alterações"
            variant="primary"
            loading={postBody.isPending || patchProfile.isPending}
            onPress={saveBody}
          />
        </>
      )}
    </AccountScreen>
  );
}
