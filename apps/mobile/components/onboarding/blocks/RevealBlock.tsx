import {
  computeTargets,
  PROTEIN_ADJUST_INFO_TEXT,
  PROTEIN_MAX_LIMIT_TEXT,
  PROTEIN_MIN_LIMIT_TEXT,
} from "@fitbrother/shared";
import { Info, TriangleAlert } from "lucide-react-native";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { SliderInput } from "@/components/SliderInput";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext, chapter }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);
  const targetsInput = useOnboardingResultStore((s) => s.targetsInput);
  const setField = useOnboardingStore((s) => s.setField);
  const [proteinOverride, setProteinOverride] = useState<number | undefined>(undefined);

  const live = useMemo(() => {
    if (!targetsInput || !result) return null;
    if (proteinOverride === undefined) return result;
    const recomputed = computeTargets({ ...targetsInput, protein_g_override: proteinOverride });
    return {
      ...result,
      kcal: recomputed.kcal,
      protein_g: recomputed.protein_g,
      carbs_g: recomputed.carbs_g,
      fat_g: recomputed.fat_g,
    };
  }, [targetsInput, result, proteinOverride]);

  if (!result || !targetsInput || !live) {
    router.replace("/(auth)/welcome" as never);
    return null;
  }

  if (live.blocked) {
    return (
      <OnboardingChapterShell chapter={chapter} title="Ajustamos suas metas" showNav={false}>
        <View className="flex-1 justify-between gap-8">
          <Text className="text-center text-base font-sans text-neutral-600">
            {live.block_reason}
          </Text>
          <View className="gap-4">
            <GoalsDisclaimer />
            <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
          </View>
        </View>
      </OnboardingChapterShell>
    );
  }

  // Doença renal dosa proteína por peso total (restrição clínica) — o
  // slider não se aplica, computeTargets ignora protein_g_override nesse caso.
  const proteinAdjustable = targetsInput.has_kidney_disease !== true;
  const leanMass_kg = targetsInput.weight_kg * (1 - targetsInput.body_fat_pct / 100);
  const proteinMin = Math.round(leanMass_kg * 1.2);
  const proteinMax = Math.round(leanMass_kg * 3.0);
  const currentProtein = proteinOverride ?? result.protein_g;
  const proteinLimitText =
    currentProtein <= proteinMin
      ? PROTEIN_MIN_LIMIT_TEXT
      : currentProtein >= proteinMax
        ? PROTEIN_MAX_LIMIT_TEXT
        : null;

  return (
    <OnboardingChapterShell chapter={chapter} title="Suas metas estão prontas" showNav={false}>
      <View className="flex-1 justify-between gap-6">
        <View className="items-center gap-6">
          <Text
            className="text-5xl font-display-bold text-primary-500"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {fmtInt(live.kcal)} kcal
          </Text>
          <View className="flex-row gap-6">
            {!proteinAdjustable && (
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="font-sans text-neutral-600"
              >
                {fmtInt(live.protein_g)}g proteína
              </Text>
            )}
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(live.carbs_g)}g carbo
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(live.fat_g)}g gordura
            </Text>
          </View>
        </View>

        {proteinAdjustable && (
          <View className="gap-2">
            <SliderInput
              label="Proteína"
              value={currentProtein}
              min={proteinMin}
              max={proteinMax}
              step={1}
              unit="g"
              markerValue={result.protein_g}
              onChange={(v) => {
                setProteinOverride(v);
                setField("protein_g_override", v === result.protein_g ? undefined : v);
              }}
            />
            {proteinLimitText && (
              <View className="flex-row items-start gap-2">
                <TriangleAlert size={16} color={colors.warning[500]} className="mt-0.5" />
                <Text className="flex-1 text-xs font-sans text-warning-500">
                  {proteinLimitText}
                </Text>
              </View>
            )}
            <View className="flex-row items-start gap-2">
              <Info size={14} color={colors.neutral[400]} className="mt-0.5" />
              <Text className="flex-1 text-xs font-sans text-neutral-500">
                {PROTEIN_ADJUST_INFO_TEXT}
              </Text>
            </View>
          </View>
        )}

        <View className="gap-4">
          <GoalsDisclaimer />
          <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
