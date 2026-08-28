# Dashboard alinhado ao template — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `apps/mobile/app/(app)/index.tsx` (desktop e mobile) pra bater com
a estrutura do template `templates/dashboard/Dashboard.dc.html` do Claude Design: header
flutuante com streak no desktop, resumo em `Card` + `GoalsDisclaimer`, heading
"Refeições" com contagem, `EmptyMealsState` em `Card`, e `MealComposer` docado como
barra de página inteira (não mais dentro da coluna de resumo).

**Architecture:** Nenhum componente novo — só reorganização de JSX em
`(app)/index.tsx`, reusando `Card`, `GoalsDisclaimer`, `StreakCounter`, `useStreak` (já
usados em `Sidebar.tsx`, mesmo padrão). `HomeHeader` passa a renderizar só no branch
mobile; o desktop ganha seu próprio header inline usando `Card`.

**Tech Stack:** React Native, NativeWind v4 (`sticky` via Tailwind, funciona em web via
react-native-web; degrada graciosamente — sem crash — em builds nativos onde
`position:sticky` não existe).

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-display-bold` — nunca `font-bold` puro.
- Números → `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores via token de `@/lib/colors` — nunca hex inline em JSX.
- Hit target 44×44pt em `Pressable`.
- Sombras via `Platform.select` — reusar o padrão já pronto em `Card.tsx`, não duplicar.

---

## Task 1: `HomeHeader.tsx` — exporta `greetingFor`

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`

- [ ] **Step 1: Exportar a função**

Substituir:
```tsx
function greetingFor(date: Date): string {
```

Por:
```tsx
export function greetingFor(date: Date): string {
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep HomeHeader`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx
git commit -m "refactor(mobile): exporta greetingFor de HomeHeader pra reuso"
```

---

## Task 2: `(app)/index.tsx` — reorganiza os dois branches

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx`

**Interfaces:**
- Consumes: `Card` (`@/components/Card`), `GoalsDisclaimer`
  (`@/components/domain/GoalsDisclaimer`), `StreakCounter`
  (`@/components/domain/StreakCounter`), `useStreak` (`@/lib/hooks/useStreak`),
  `greetingFor` (`@/components/domain/HomeHeader`, Task 1).

- [ ] **Step 1: Novos imports**

Substituir:
```tsx
import { HomeHeader } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
```

Por:
```tsx
import { Card } from "@/components/Card";
import { HomeHeader, greetingFor } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { useStreak } from "@/lib/hooks/useStreak";
```

- [ ] **Step 2: Buscar o streak no componente (usado pelo header novo do desktop)**

Substituir:
```tsx
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
```

Por:
```tsx
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { data: streakView } = useStreak();
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;
```

- [ ] **Step 3: Reescrever o branch desktop**

Substituir o bloco inteiro (do `if (isDesktop) {` até o `}` que fecha esse if):
```tsx
  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        <HomeHeader name={profile.full_name} softMode={profile.soft_mode} />
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
        <View className="mx-auto w-full max-w-[1120px] flex-1 flex-row gap-6 px-6">
          <View className="w-[440px] shrink-0 gap-4 pt-4">
            <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
            <MealComposer
              onSend={handleSend}
              onAudioReady={handleAudioReady}
              onPhotoPress={handlePhotoPress}
              onScanPress={() => router.push("/(app)/scan" as never)}
              disabled={banner === "quota_exceeded"}
              processing={
                createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
              }
            />
          </View>
          <View className="flex-1">
            {mealsQuery.isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : items.length === 0 ? (
              <EmptyMealsState />
            ) : (
              <Animated.FlatList
                data={items}
                keyExtractor={(m) => (m as OptimisticMeal).id}
                renderItem={renderItem as never}
                contentContainerStyle={{ paddingBottom: 40 }}
                itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
                refreshControl={
                  <RefreshControl
                    refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
                    onRefresh={() => {
                      void mealsQuery.refetch();
                      void summaryQuery.refetch();
                    }}
                    tintColor={colors.primary[400]}
                  />
                }
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

Por:
```tsx
  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}

        <View className="sticky top-0 z-10 bg-neutral-50 px-6 pb-4 pt-5">
          <Card
            variant="elevated"
            className="mx-auto w-full max-w-[1120px] flex-row items-center justify-between"
          >
            <View>
              <Text className="text-[13px] font-sans text-neutral-500">
                {greetingFor(new Date())}, {firstName}
              </Text>
              <Text className="mt-0.5 text-[28px] font-display-bold text-neutral-800">Hoje</Text>
            </View>
            {!profile.soft_mode && streakView && (
              <StreakCounter
                current={streakView.streak.current_streak}
                atRisk={streakView.atRisk}
              />
            )}
          </Card>
        </View>

        <View className="mx-auto w-full max-w-[1120px] flex-1 flex-row items-start gap-8 px-6">
          <View className="sticky top-[124px] w-[400px] shrink-0 gap-5">
            <Card variant="elevated">
              <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
            </Card>
            <GoalsDisclaimer />
          </View>

          <View className="flex-1">
            <View className="mb-4 flex-row items-baseline justify-between gap-4">
              <Text className="text-2xl font-display-bold text-neutral-800">Refeições</Text>
              <Text
                className="text-[13px] text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {items.length} de hoje
              </Text>
            </View>
            {mealsQuery.isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : items.length === 0 ? (
              <Card variant="flat">
                <EmptyMealsState />
              </Card>
            ) : (
              <Animated.FlatList
                data={items}
                keyExtractor={(m) => (m as OptimisticMeal).id}
                renderItem={renderItem as never}
                contentContainerStyle={{ paddingBottom: 180 }}
                itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
                refreshControl={
                  <RefreshControl
                    refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
                    onRefresh={() => {
                      void mealsQuery.refetch();
                      void summaryQuery.refetch();
                    }}
                    tintColor={colors.primary[400]}
                  />
                }
              />
            )}
          </View>
        </View>

        <View className="sticky bottom-0 z-10 bg-neutral-50 px-6 pb-3 pt-4">
          <View className="mx-auto w-full max-w-[1120px]">
            <MealComposer
              onSend={handleSend}
              onAudioReady={handleAudioReady}
              onPhotoPress={handlePhotoPress}
              onScanPress={() => router.push("/(app)/scan" as never)}
              disabled={banner === "quota_exceeded"}
              processing={
                createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
              }
            />
            <Text className="mt-2.5 text-center text-[12.5px] text-neutral-400">
              Escreva, dite ou fotografe — a IA calcula os macros.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 4: Reescrever o branch mobile**

Substituir o `return` final (mobile) inteiro:
```tsx
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <HomeHeader name={profile.full_name} softMode={profile.soft_mode} />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      {mealsQuery.isLoading ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss} />
      ) : items.length === 0 ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss}>
          <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
          <EmptyMealsState />
        </Pressable>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(m) => (m as OptimisticMeal).id}
          renderItem={renderItem as never}
          ListHeaderComponent={
            <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
          }
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          refreshControl={
            <RefreshControl
              refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
              onRefresh={() => {
                void mealsQuery.refetch();
                void summaryQuery.refetch();
              }}
              tintColor={colors.primary[400]}
            />
          }
        />
      )}
      {/* Composer sits over the list. We drive its position from
          useAnimatedKeyboard instead of KeyboardAvoidingView because absolute
          children inside KAV don't observe the padding it adds. */}
      <Animated.View
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, composerStyle]}
      >
        <MealComposer
          onSend={handleSend}
          onAudioReady={handleAudioReady}
          onPhotoPress={handlePhotoPress}
          onScanPress={() => router.push("/(app)/scan" as never)}
          disabled={banner === "quota_exceeded"}
          processing={
            createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}
```

Por:
```tsx
  const listHeader = (
    <View className="gap-4 px-4 pb-2">
      <Card variant="elevated">
        <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
      </Card>
      <GoalsDisclaimer />
      <View className="flex-row items-baseline justify-between gap-4">
        <Text className="text-xl font-display-bold text-neutral-800">Refeições</Text>
        <Text
          className="text-[13px] text-neutral-500"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {items.length} de hoje
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <HomeHeader name={profile.full_name} softMode={profile.soft_mode} />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      {mealsQuery.isLoading ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss} />
      ) : items.length === 0 ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss}>
          {listHeader}
          <Card variant="flat" className="mx-4">
            <EmptyMealsState />
          </Card>
        </Pressable>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(m) => (m as OptimisticMeal).id}
          renderItem={renderItem as never}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          refreshControl={
            <RefreshControl
              refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
              onRefresh={() => {
                void mealsQuery.refetch();
                void summaryQuery.refetch();
              }}
              tintColor={colors.primary[400]}
            />
          }
        />
      )}
      {/* Composer sits over the list. We drive its position from
          useAnimatedKeyboard instead of KeyboardAvoidingView because absolute
          children inside KAV don't observe the padding it adds. */}
      <Animated.View
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, composerStyle]}
      >
        <View className="bg-neutral-50 px-4 pb-2 pt-3">
          <MealComposer
            onSend={handleSend}
            onAudioReady={handleAudioReady}
            onPhotoPress={handlePhotoPress}
            onScanPress={() => router.push("/(app)/scan" as never)}
            disabled={banner === "quota_exceeded"}
            processing={
              createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
            }
          />
          <Text className="mt-2 text-center text-xs text-neutral-400">
            Escreva, dite ou fotografe — a IA calcula os macros.
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
```

Note: `contentContainerStyle={{ paddingHorizontal: 16, ... }}` no `FlatList` já cobre o
padding lateral que os itens precisam — `listHeader` usa `px-4` (16px) pra bater com o
mesmo valor, já que `ListHeaderComponent` não herda o `paddingHorizontal` do
`contentContainerStyle` da mesma forma que os itens (ele é só mais um item da lista,
então herda sim — mantendo os dois em 16px evita desalinhamento).

- [ ] **Step 5: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep "app)/index"; npx eslint "apps/mobile/app/(app)/index.tsx"`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/index.tsx"
git commit -m "feat(mobile): dashboard alinhado ao template — header flutuante, Refeições, composer docado"
```

---

## Task 3: Verificação manual

**Files:** nenhum.

- [ ] **Step 1: Typecheck e lint do workspace inteiro**

Run: `npm run typecheck --workspace apps/mobile && npm run lint`
Expected: PASS.

- [ ] **Step 2: Browser — desktop (1280×800+)**

Logar com a conta de teste, ir pro Home. Confirmar: header flutuante "Boa tarde/noite,
{nome}" + "Hoje" + streak (se houver), coluna esquerda com resumo em card + disclaimer,
coluna direita com "Refeições N de hoje" + lista, composer como barra fixa no rodapé
com a legenda abaixo. Rolar a lista de refeições e confirmar que o header de cima e o
composer de baixo continuam fixos (sticky).

- [ ] **Step 3: Browser — mobile (375×812)**

Confirmar resumo em card + disclaimer + "Refeições N de hoje" antes da lista, composer
continua acompanhando o teclado ao focar o campo de texto (sem regressão da animação
existente), com a legenda abaixo dele.

- [ ] **Step 4: Estado vazio**

Conferir com uma conta sem refeições hoje (ou zerando localmente) que o
`EmptyMealsState` aparece dentro do card, nos dois layouts.

- [ ] **Step 5: Finalizar**

Seguir superpowers:finishing-a-development-branch.
