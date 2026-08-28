import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { BodyFatSilhouette } from "@/components/onboarding/BodyFatSilhouette";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

type Bucket = 1 | 2 | 3 | 4 | 5;
type BodyFatSex = "male" | "female" | "other";

// % representativo de cada faixa, por sexo — usado tanto pra exibir quanto
// pra gravar em body_fat_pct quando o usuário toca num card ilustrado.
const BUCKETS_BY_SEX: Record<BodyFatSex, Record<Bucket, number>> = {
  male: { 1: 10, 2: 14, 3: 20, 4: 26, 5: 33 },
  female: { 1: 17, 2: 22, 3: 28, 4: 34, 5: 40 },
  other: { 1: 13, 2: 18, 3: 24, 4: 30, 5: 36 },
};

const BUCKETS: Bucket[] = [1, 2, 3, 4, 5];

function nearestBucket(pct: number, sex: BodyFatSex): Bucket {
  const table = BUCKETS_BY_SEX[sex];
  let closest: Bucket = 1;
  let closestDist = Infinity;
  for (const bucket of BUCKETS) {
    const dist = Math.abs(table[bucket] - pct);
    if (dist < closestDist) {
      closestDist = dist;
      closest = bucket;
    }
  }
  return closest;
}

export function BodyFatBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const sex = (useOnboardingStore((s) => s.sex) ?? "other") as BodyFatSex;
  const body_fat_pct = useOnboardingStore((s) => s.body_fat_pct);
  const setField = useOnboardingStore((s) => s.setField);
  const [exactMode, setExactMode] = useState(false);
  const [exactText, setExactText] = useState(
    body_fat_pct !== undefined ? String(body_fat_pct) : "",
  );

  const table = BUCKETS_BY_SEX[sex];
  const selectedBucket = body_fat_pct !== undefined ? nearestBucket(body_fat_pct, sex) : undefined;

  function selectBucket(bucket: Bucket) {
    void Haptics.selectionAsync();
    setExactMode(false);
    setField("body_fat_pct", table[bucket]);
    setExactText(String(table[bucket]));
  }

  function commitExact(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(60, Math.max(3, parsed));
    setField("body_fat_pct", clamped);
    setExactText(String(clamped));
  }

  // Bucket 3 ("médio") como estimativa padrão — não deixa o campo em branco
  // (protein_g depende de body_fat_pct) nem exige que o usuário adivinhe.
  function useDefaultEstimate() {
    selectBucket(3);
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu % de gordura corporal?"
      subtitle="Ajuda a calcular sua proteína com mais precisão. Escolha a ilustração mais parecida."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={body_fat_pct === undefined}
    >
      <View className="gap-6">
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-center gap-3">
          {BUCKETS.map((bucket) => (
            <Pressable
              key={bucket}
              onPress={() => selectBucket(bucket)}
              accessibilityRole="radio"
              accessibilityLabel={`Aproximadamente ${table[bucket]}% de gordura corporal`}
              accessibilityState={{ selected: selectedBucket === bucket && !exactMode }}
              className={`min-h-[44px] min-w-[44px] items-center rounded-xl border p-2 ${
                selectedBucket === bucket && !exactMode
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <BodyFatSilhouette sex={sex} bucket={bucket} selected={selectedBucket === bucket} />
              <Text
                className="mt-1 text-xs font-sans text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                ~{table[bucket]}%
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setExactMode((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={exactMode ? "Usar as ilustrações" : "Prefiro digitar o número exato"}
        >
          <Text className="text-center text-sm font-sans-medium text-primary-500">
            {exactMode ? "Usar as ilustrações" : "Prefiro digitar o número exato"}
          </Text>
        </Pressable>

        <Pressable
          onPress={useDefaultEstimate}
          accessibilityRole="button"
          accessibilityLabel="Não sei — usar uma estimativa"
        >
          <Text className="text-center text-sm font-sans-medium text-neutral-500">
            Não sei — usar uma estimativa
          </Text>
        </Pressable>

        {exactMode && (
          <View className="flex-row items-center justify-center gap-2">
            <TextInput
              value={exactText}
              onChangeText={setExactText}
              onBlur={() => commitExact(exactText)}
              onSubmitEditing={() => commitExact(exactText)}
              keyboardType="decimal-pad"
              className="w-20 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-base font-sans-semibold text-neutral-800"
              style={{ fontVariant: ["tabular-nums"] }}
              accessibilityLabel="% de gordura corporal exato"
            />
            <Text className="text-base font-sans text-neutral-600">%</Text>
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
