import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { SkeletonCircle, SkeletonText } from "@/components/Skeleton";
import { postOnboarding } from "@/lib/api";
import { friendlyApiError } from "@/lib/errors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const MIN_DURATION_MS = 1500;

export function SubmittingBlock({ onNext }: OnboardingBlockProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const setResult = useOnboardingResultStore((s) => s.setResult);
  const targetsInput = useOnboardingResultStore((s) => s.targetsInput);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      const payload = useOnboardingStore.getState().toPayload();
      if (!payload) {
        setError("Faltam informações de um dos passos anteriores.");
        return;
      }
      try {
        const [response] = await Promise.all([
          postOnboarding(payload),
          new Promise((resolve) => setTimeout(resolve, MIN_DURATION_MS)),
        ]);
        if (cancelled) return;
        const body = response as {
          kcal: string;
          protein_g: string;
          carbs_g: string;
          fat_g: string;
          blocked: string | boolean;
          block_reason: string | null;
          soft_mode: boolean;
        };
        if (targetsInput) {
          setResult(
            {
              kcal: Number(body.kcal),
              protein_g: Number(body.protein_g),
              carbs_g: Number(body.carbs_g),
              fat_g: Number(body.fat_g),
              blocked: body.blocked === "true" || body.blocked === true,
              block_reason: body.block_reason,
              soft_mode: body.soft_mode,
            },
            targetsInput,
          );
        }
        onNext();
      } catch (err) {
        if (!cancelled) setError(friendlyApiError(err instanceof Error ? err.message : undefined));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryKey, onNext, setResult, targetsInput]);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-neutral-50 px-8">
      {error ? (
        <>
          <Text className="text-center text-sm font-sans text-danger-600">{error}</Text>
          <Button
            label="Tentar de novo"
            variant="primary"
            onPress={() => setRetryKey((k) => k + 1)}
          />
        </>
      ) : (
        <>
          {/* Sugere um resumo de perfil sendo montado (avatar + linhas),
              em vez de um bloco de card sem relação com o texto abaixo. */}
          <View className="w-full max-w-[280px] items-center gap-4">
            <SkeletonCircle size={56} />
            <SkeletonText lines={3} lineHeight={14} gap={10} lastLineWidth="70%" />
          </View>
          <Text className="text-center text-base font-sans text-neutral-600">
            Criando sua conta...
          </Text>
        </>
      )}
    </View>
  );
}
