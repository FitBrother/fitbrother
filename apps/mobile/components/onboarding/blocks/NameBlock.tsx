import { Input } from "@/components/Input";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function NameBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const full_name = useOnboardingStore((s) => s.full_name);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Como podemos te chamar?"
      subtitle="Seu nome aparece nas conquistas e nas conversas com o bot."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={full_name.trim().length < 2}
    >
      <Input
        label="Nome"
        value={full_name}
        onChangeText={(v) => setField("full_name", v)}
        placeholder="Seu nome"
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        returnKeyType="done"
        maxLength={80}
      />
    </OnboardingChapterShell>
  );
}
