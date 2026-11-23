import { useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaywallSkeleton } from "@/components/domain/PaywallSkeleton";
import { PlanChoice } from "@/components/domain/PlanChoice";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useBillingActions } from "@/lib/hooks/useBillingActions";
import { useSubscription } from "@/lib/hooks/useSubscription";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PaywallBlock({ onNext, chapter }: OnboardingBlockProps) {
  const subscription = useSubscription();
  const { startCheckout, pending } = useBillingActions();
  const advanced = useRef(false);
  const isPro = subscription.data?.plan === "pro";

  useEffect(() => {
    if (isPro && !advanced.current) {
      advanced.current = true;
      onNext();
    }
  }, [isPro, onNext]);

  if (subscription.isLoading || isPro) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50">
        <PaywallSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Fitbrother Premium"
      subtitle="Escolha um plano para assinar ou siga com o plano gratuito. Você pode mudar isso depois, no seu perfil."
      showNav={false}
    >
      <PlanChoice
        pending={pending}
        onSubscribe={(interval) => void startCheckout(interval)}
        secondaryLabel="Continuar grátis"
        onSecondary={onNext}
      />
    </OnboardingChapterShell>
  );
}
