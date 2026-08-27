import { computeTargets } from "@fitbrother/shared";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
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
  const defaultTarget =
    goal === "lose" ? Math.max(30, currentWeight - 5) : Math.min(250, currentWeight + 5);
  const selectedTarget = target_weight_kg ?? defaultTarget;
  const defaultRate =
    goal === "lose" || goal === "gain"
      ? Math.round((DEFAULT_RATE_PCT[goal] / 100) * currentWeight * 10) / 10
      : 0.5;
  const selectedRate = rate_kg_per_week ?? Math.max(0.1, defaultRate);

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
              min={30}
              max={250}
              step={0.5}
              value={selectedTarget}
              unit="kg"
              onChange={(v) => setField("target_weight_kg", v)}
            />
            <SliderInput
              label="Ritmo"
              min={0.1}
              max={1.0}
              step={0.1}
              value={selectedRate}
              unit="kg/semana"
              onChange={(v) => setField("rate_kg_per_week", v)}
            />
            {projectedDateLabel && (
              <Text
                className="text-center text-sm font-sans text-neutral-600"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                Nesse ritmo, você chega no peso-alvo em torno de {projectedDateLabel}.
              </Text>
            )}
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
