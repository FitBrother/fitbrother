import { computeRateBounds, computeTargetWeightBounds, computeTargets } from "@fitbrother/shared";
import * as Haptics from "expo-haptics";
import { Calendar } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/lib/colors";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { projectGoalDate } from "@/lib/onboarding/projectGoalDate";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  { value: "lose", title: "Perder gordura", desc: "Você define o ritmo abaixo." },
  { value: "maintain", title: "Manter peso", desc: "Calorias = TDEE." },
  { value: "gain", title: "Ganhar massa", desc: "Você define o ritmo abaixo." },
] as const;

const DEFAULT_RATE_PCT: Record<"lose" | "gain", number> = { lose: 0.625, gain: 0.375 };

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function GoalBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const goal = useOnboardingStore((s) => s.goal);
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const sex = useOnboardingStore((s) => s.sex);
  const activity_level = useOnboardingStore((s) => s.activity_level);
  const body_fat_pct = useOnboardingStore((s) => s.body_fat_pct);
  const target_weight_kg = useOnboardingStore((s) => s.target_weight_kg);
  const rate_kg_per_week = useOnboardingStore((s) => s.rate_kg_per_week);
  const setField = useOnboardingStore((s) => s.setField);

  const showRateInputs = goal === "lose" || goal === "gain";
  const currentWeight = weight_kg ?? 70;
  const targetBounds =
    goal === "lose" || goal === "gain"
      ? computeTargetWeightBounds({
          goal,
          weight_kg: currentWeight,
          height_cm: height_cm ?? 170,
          body_fat_pct: body_fat_pct ?? 20,
          sex: sex ?? "other",
        })
      : { min: 30, max: 250 };
  const defaultTarget =
    goal === "lose"
      ? Math.max(targetBounds.min, currentWeight - 5)
      : Math.min(targetBounds.max, currentWeight + 5);
  const selectedTarget = Math.min(
    targetBounds.max,
    Math.max(targetBounds.min, target_weight_kg ?? defaultTarget),
  );

  // Trocar de objetivo muda os limites do slider — se o valor já salvo cair
  // fora do novo intervalo, o slider mostra a posição corrigida (acima) mas
  // o store ainda guarda o valor velho até o usuário arrastar de novo. Sem
  // isso, "Continuar" sem tocar no slider submeteria um peso-alvo fora dos
  // limites atuais.
  useEffect(() => {
    if (target_weight_kg === undefined) return;
    const clamped = Math.min(targetBounds.max, Math.max(targetBounds.min, target_weight_kg));
    if (clamped !== target_weight_kg) setField("target_weight_kg", clamped);
  }, [target_weight_kg, targetBounds.min, targetBounds.max, setField]);

  // Idade fixa aqui pelo mesmo motivo do computeTargets abaixo: ela entra na
  // TMB, mas o efeito no teto de ritmo é de segunda ordem e o valor
  // definitivo é recalculado no servidor. O fallback cobre a retomada de um
  // onboarding salvo, quando o bloco pode renderizar antes de todos os
  // campos estarem preenchidos.
  const rateBounds =
    (goal === "lose" || goal === "gain") && sex && height_cm && activity_level
      ? computeRateBounds({
          goal,
          sex,
          age_years: 30,
          weight_kg: currentWeight,
          height_cm,
          activity_level,
        })
      : { min: 0.1, max: 1.0 };

  const defaultRate =
    goal === "lose" || goal === "gain"
      ? Math.round((DEFAULT_RATE_PCT[goal] / 100) * currentWeight * 10) / 10
      : 0.5;
  const selectedRate = Math.min(
    rateBounds.max,
    Math.max(rateBounds.min, rate_kg_per_week ?? defaultRate),
  );

  // Mesmo motivo do efeito acima: trocar de objetivo muda o teto de ritmo, e
  // um valor salvo fora da faixa nova seria submetido intacto se o usuário
  // não tocasse no slider.
  useEffect(() => {
    if (rate_kg_per_week === undefined) return;
    const clamped = Math.min(rateBounds.max, Math.max(rateBounds.min, rate_kg_per_week));
    if (clamped !== rate_kg_per_week) setField("rate_kg_per_week", clamped);
  }, [rate_kg_per_week, rateBounds.min, rateBounds.max, setField]);

  let projectedDateLabel: string | null = null;
  if (showRateInputs && sex && height_cm && activity_level && body_fat_pct !== undefined) {
    const targets = computeTargets({
      sex,
      age_years: 30, // só pro preview local — idade real não afeta ritmo/data projetada
      weight_kg: currentWeight,
      height_cm,
      activity_level,
      goal,
      body_fat_pct,
      target_weight_kg: selectedTarget,
      rate_kg_per_week: selectedRate,
    });
    const date = projectGoalDate(
      currentWeight,
      selectedTarget,
      targets.projected_rate_kg_per_week,
      new Date(),
    );
    projectedDateLabel = date ? fmtDate(date) : null;
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!goal}
      scrollable={false}
    >
      <View className="gap-5">
        <View accessibilityRole="radiogroup" className="gap-2">
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                void Haptics.selectionAsync();
                setField("goal", opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: goal === opt.value }}
              className={`min-h-[44px] rounded-xl border p-3 ${
                goal === opt.value
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-base font-sans-semibold text-neutral-800">{opt.title}</Text>
              <Text className="text-sm font-sans text-neutral-600">{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {showRateInputs && (
          <View className="gap-3">
            <SliderInput
              label="Peso-alvo"
              min={targetBounds.min}
              max={targetBounds.max}
              step={0.5}
              value={selectedTarget}
              unit="kg"
              onChange={(v) => setField("target_weight_kg", v)}
            />
            <SliderInput
              label="Ritmo"
              min={rateBounds.min}
              max={rateBounds.max}
              step={0.05}
              value={selectedRate}
              unit="kg/semana"
              onChange={(v) => setField("rate_kg_per_week", v)}
            />
            {projectedDateLabel && (
              <View className="flex-row items-center justify-center gap-2 rounded-xl bg-primary-50 px-3 py-2.5">
                <Calendar size={16} color={colors.primary[600]} />
                <Text className="text-center text-sm font-sans text-primary-700">
                  Nesse ritmo, você chega no peso-alvo em torno de{" "}
                  <Text
                    className="font-sans-semibold text-primary-700"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {projectedDateLabel}
                  </Text>
                  .
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
