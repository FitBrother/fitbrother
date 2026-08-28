import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { CHAPTER_NAMES, CHAPTER_TOTAL } from "@/lib/onboarding/types";

interface OnboardingChapterShellProps {
  /** Presente só na Fase A (capítulos 1-3) — liga o painel lateral (desktop)
   * e a barra de progresso segmentada. Ausente = Fase B/C: só card + nav. */
  chapter?: { num: 1 | 2 | 3; name: string };
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  onSkip?: () => void;
  /** false pros blocos de payoff (calculating/reveal) — sem botão voltar/continuar. */
  showNav?: boolean;
  /** false quando o conteúdo é um WheelPicker (mesma ressalva do OnboardingStepShell
   * original: FlatList dentro de ScrollView quebra o windowing no RN). */
  scrollable?: boolean;
}

export function OnboardingChapterShell({
  chapter,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextDisabled,
  onSkip,
  showNav = true,
  scrollable = true,
}: OnboardingChapterShellProps) {
  const card = (
    <View
      className="mx-auto w-full max-w-[560px] flex-1 px-5 py-6 sm:my-8 sm:flex-none sm:rounded-2xl sm:bg-white sm:p-10"
      style={shadows.card}
    >
      {chapter && (
        <>
          <View className="mb-3 flex-row gap-2.5">
            {[1, 2, 3].map((n) => (
              <View key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                {n <= chapter.num && <View className="h-full w-full bg-primary-400" />}
              </View>
            ))}
          </View>
          <Text className="text-xs font-sans-medium text-neutral-500">
            Capítulo {chapter.num} de {CHAPTER_TOTAL} · {chapter.name}
          </Text>
        </>
      )}

      <View className="mt-7">
        <Text className="mb-2 text-3xl font-display-bold text-neutral-800">{title}</Text>
        {subtitle && <Text className="text-base font-sans text-neutral-600">{subtitle}</Text>}
      </View>

      <View className="mt-7 flex-1">{children}</View>

      {showNav && (
        <View className="mt-8 flex-row items-center gap-4">
          <Pressable
            onPress={onBack}
            disabled={!onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white active:bg-neutral-50"
            style={shadows.card}
          >
            <ChevronLeft size={20} color={colors.neutral[800]} />
          </Pressable>
          {onNext && (
            <View className="flex-1">
              <Button
                label="Continuar"
                variant="primary"
                size="lg"
                disabled={nextDisabled}
                onPress={onNext}
              />
            </View>
          )}
        </View>
      )}

      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular esse passo
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-row">
        {chapter && (
          <View
            className="hidden w-[300px] justify-between bg-white px-6 py-10 lg:flex"
            style={shadows.rail}
          >
            <View className="gap-8">
              <Text className="text-xl font-display-bold text-primary-400">Fitbrother</Text>
              <View>
                <Text className="font-display-bold text-2xl leading-tight text-neutral-800">
                  Vamos montar suas metas.
                </Text>
                <Text className="mt-2.5 text-sm text-neutral-600">
                  Três capítulos curtos. Nada aqui é definitivo — você ajusta tudo depois, quando
                  quiser.
                </Text>
              </View>
              <View className="gap-1">
                {([1, 2, 3] as const).map((n) => {
                  const done = n < chapter.num;
                  const active = n === chapter.num;
                  return (
                    <View
                      key={n}
                      className={`flex-row items-center gap-3 rounded-xl px-3 py-2 ${
                        active ? "bg-primary-50" : ""
                      }`}
                    >
                      <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-neutral-100">
                        {done && <View className="h-2 w-2 rounded-full bg-primary-400" />}
                        {active && <View className="h-2 w-2 rounded-full bg-primary-400" />}
                      </View>
                      <Text className="font-sans-medium text-base text-neutral-700">
                        {CHAPTER_NAMES[n]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <Text className="text-xs text-neutral-500">
              Seus dados servem só para calcular suas metas. Você pode exportar ou apagar tudo a
              qualquer momento.
            </Text>
          </View>
        )}

        <View className="flex-1">
          {!chapter && (
            <View className="items-center px-5 pb-2 pt-4 lg:hidden">
              <Text className="text-lg font-display-bold text-neutral-800">Fitbrother</Text>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            {scrollable ? (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {card}
              </ScrollView>
            ) : (
              card
            )}
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}
