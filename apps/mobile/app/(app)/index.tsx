import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { pickImage } from "@/lib/media/image-picker";
import { Info } from "lucide-react-native";
import { GOALS_DISCLAIMER_TEXT } from "@fitbrother/shared";
import { reloadApp } from "@/lib/reload-app";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import { useDailySummary } from "@/lib/hooks/useDailySummary";
import { useDailySummaryRealtime } from "@/lib/hooks/useDailySummaryRealtime";
import { useMealsRealtime } from "@/lib/hooks/useMealsRealtime";
import {
  newClientMealId,
  useCreateMealText,
  type OptimisticMeal,
} from "@/lib/hooks/useCreateMealText";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { useCreateMealPhoto } from "@/lib/hooks/useCreateMealPhoto";
import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { nextCollapse } from "@/lib/summary-collapse";
import { uploadMealAudio, uploadMealPhoto } from "@/lib/storage";
import type { AudioExtension } from "@/lib/audio/recorder";
import { Card } from "@/components/Card";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AnalisesPanel } from "@/components/domain/AnalisesPanel";
import { FeedTabContent } from "@/components/domain/FeedTabContent";
import { HomeHeader, greetingFor, TABS, type HomeTab } from "@/components/domain/HomeHeader";
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { ComposerBackdrop, COMPOSER_FADE_HEIGHT } from "@/components/domain/ComposerBackdrop";
import { EmailConfirmationBanner } from "@/components/domain/EmailConfirmationBanner";
import { NewVersionBanner } from "@/components/domain/NewVersionBanner";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ListTopFade } from "@/components/domain/ListTopFade";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { useStreak } from "@/lib/hooks/useStreak";

/** Sobra entre o último card e o começo do degradê do composer. */
const LIST_BREATHING_ROOM = 28;

/**
 * Espaço livre no fim da lista de refeições, em px.
 *
 * O composer flutua sobre a lista (position absolute, fora do fluxo), então
 * nada empurra o último card para cima — sem esta folga ele fica embaixo do
 * bloco sólido ou do degradê. A altura do bloco vem do `onLayout` em vez de
 * ser estimada: ela muda com o safe area e cresce quando o input vira
 * multilinha.
 */
function listBottomSpace(composerHeight: number): number {
  return composerHeight + COMPOSER_FADE_HEIGHT + LIST_BREATHING_ROOM;
}

function detectLocale(): string {
  const tag = Localization.getLocales()[0]?.languageTag;
  return tag ?? "pt-BR";
}

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const day = nutritionalToday(profile);
  const mealsQuery = useMealsForDay(day);
  const createMeal = useCreateMealText();
  const createMealAudio = useCreateMealAudio();
  const createMealPhoto = useCreateMealPhoto();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;
  const summaryQuery = useDailySummary(day);
  useDailySummaryRealtime(userId, day);
  useMealsRealtime(userId, day);
  // Puxar pra atualizar na Home recarrega o app inteiro na web (pega
  // código novo do PWA instalado, ver lib/reload-app.ts) — no nativo não
  // existe esse problema, então mantém só o refetch de dados de sempre.
  function handleRefresh() {
    if (Platform.OS === "web") {
      reloadApp();
      return;
    }
    void mealsQuery.refetch();
    void summaryQuery.refetch();
  }
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HomeTab>("home");
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [composerHeight, setComposerHeight] = useState(0);
  const { data: streakView } = useStreak();
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  // `entering` do Reanimated só dispara na primeira montagem do componente —
  // a Home é a tela-base da stack e não desmonta ao navegar pra outra tela e
  // voltar, então a animação nunca repetia. Também não roda no target web
  // (limitação conhecida das layout animations do Reanimated 4 lá). Por isso
  // animamos manualmente e refazemos toda vez que a tela ganha foco.
  //
  // Mesmo motivo pelo qual o preenchimento dos anéis/barras de macro (dentro
  // de TodaySummaryHeader) não replay ao voltar pra Home: eles animam via
  // `useEffect` disparado quando o valor muda, mas o valor já vem do cache do
  // React Query e não muda — então trocamos a `key` a cada foco pra forçar o
  // remount e o replay da animação de preenchimento deles.
  const summaryOpacity = useSharedValue(0);
  const summaryTranslateY = useSharedValue(12);
  const [summaryFocusKey, setSummaryFocusKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setSummaryFocusKey((k) => k + 1);
      summaryOpacity.value = 0;
      summaryTranslateY.value = 12;
      summaryOpacity.value = withTiming(1, {
        duration: Motion.duration.base,
        easing: Motion.easing.standard,
      });
      summaryTranslateY.value = withTiming(0, {
        duration: Motion.duration.base,
        easing: Motion.easing.standard,
      });
    }, [summaryOpacity, summaryTranslateY]),
  );
  const summaryCardStyle = useAnimatedStyle(() => ({
    opacity: summaryOpacity.value,
    transform: [{ translateY: summaryTranslateY.value }],
  }));

  // ── Resumo colapsável ────────────────────────────────────────────────────
  // O resumo expandido come ~320px de tela. Em vez de sumir para cima quando a
  // lista rola (o padrão de collapsing header), ele achata no lugar: os anéis
  // viram barras horizontais e o bloco cai para ~140px, devolvendo espaço para
  // as refeições sem tirar os números de vista.
  //
  // Ele é o cabeçalho FIXO do FlatList, não um irmão acima dele — ver
  // `listHeaderComponent` mais abaixo, onde está a explicação de por que a
  // diferença importa tanto.
  const collapse = useSharedValue(0);
  const collapseTarget = useSharedValue<0 | 1>(0);
  // Espelho em JS do estado, só para o RefreshControl — puxar-pra-atualizar
  // fica disponível apenas no expandido, que é justamente quando a lista está
  // no topo e o gesto faz sentido.
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const reducedMotion = useReducedMotion();

  const handleListScroll = useAnimatedScrollHandler((event) => {
    const alvo = nextCollapse({
      y: event.contentOffset.y,
      current: collapseTarget.value,
    });
    if (alvo === collapseTarget.value) return;

    collapseTarget.value = alvo;
    collapse.value = reducedMotion ? alvo : withSpring(alvo, Motion.spring.morph);
    runOnJS(setSummaryExpanded)(alvo === 0);
  });

  const items = (mealsQuery.data ?? []) as OptimisticMeal[];

  const handleSend = (text: string) => {
    setBanner(null);
    createMeal.mutate(
      {
        client_meal_id: newClientMealId(),
        text,
        locale: detectLocale(),
        day,
      },
      {
        onError: (err) => {
          if (err instanceof QuotaExceededError) {
            setBanner("quota_exceeded");
          } else if (err.message === "request_timeout") {
            setBanner("offline");
          } else if ((getErrorStatus(err) ?? 0) >= 500) {
            setBanner("server_error");
          } else {
            setBanner("network");
          }
        },
      },
    );
  };

  const handleAudioReady = useCallback(
    async (params: { fileUri: string; durationMs: number; ext: AudioExtension }) => {
      if (!userId) return;
      setBanner(null);
      const client_meal_id = newClientMealId();
      const duration_s = Math.max(1, Math.round(params.durationMs / 1000));
      try {
        const { path } = await uploadMealAudio({
          userId,
          mealId: client_meal_id,
          fileUri: params.fileUri,
          ext: params.ext,
        });
        createMealAudio.mutate(
          {
            client_meal_id,
            audio_path: path,
            duration_s,
            locale: detectLocale(),
            day,
          },
          {
            onError: (err) => {
              // eslint-disable-next-line no-console
              console.warn("[handleAudioReady] mutation error:", err);
              if (err instanceof QuotaExceededError) {
                setBanner("quota_exceeded");
              } else if (err.message === "empty_transcription") {
                setBanner("network"); // re-use network banner copy "tente de novo"
              } else if (err.message === "request_timeout") {
                setBanner("offline");
              } else if ((getErrorStatus(err) ?? 0) >= 500) {
                setBanner("server_error");
              } else {
                setBanner("network");
              }
            },
          },
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[handleAudioReady] upload error:", err);
        setBanner("network");
      }
    },
    [createMealAudio, day, userId],
  );

  const handlePhotoPress = useCallback(async () => {
    if (!userId) return;
    setBanner(null);
    try {
      const uri = await pickImage();
      if (!uri) return;
      const client_meal_id = newClientMealId();
      const { path } = await uploadMealPhoto({
        userId,
        mealId: client_meal_id,
        fileUri: uri,
      });
      createMealPhoto.mutate(
        {
          client_meal_id,
          image_path: path,
          locale: detectLocale(),
          day,
        },
        {
          onError: (err) => {
            if (err instanceof QuotaExceededError) {
              setBanner("quota_exceeded");
            } else if (err.message === "request_timeout") {
              setBanner("offline");
            } else if ((getErrorStatus(err) ?? 0) >= 500) {
              setBanner("server_error");
            } else {
              setBanner("network");
            }
          },
        },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[handlePhotoPress] photo error:", err);
      setBanner("network");
    }
  }, [createMealPhoto, day, userId]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMeal.mutate(
        { id, day },
        {
          onError: () => setBanner("network"),
        },
      );
    },
    [deleteMeal, day],
  );

  // Drive the composer's translateY off the keyboard events directly. iOS
  // sends `keyboardWillShow/Hide` BEFORE the animation begins and includes
  // the duration the system will use — we mirror it with withTiming for a
  // seamless follow. Android only fires `keyboardDid*` so we use a sensible
  // default duration.
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      keyboardHeight.value = withTiming(e.endCoordinates.height, {
        duration,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      keyboardHeight.value = withTiming(0, {
        duration,
        easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeight.value }],
  }));

  const renderItem = useMemo(
    () =>
      function MealListItem({ item, index }: { item: OptimisticMeal; index: number }) {
        if (item.__status === "processing") return <MealCardSkeleton />;
        return (
          <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index, 9) * 40)}>
            <MealCardSwipeable
              meal={item}
              onPress={() =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push({ pathname: "/(app)/meal/[id]" as any, params: { id: item.id } })
              }
              onDelete={() => handleDelete(item.id)}
            />
          </Animated.View>
        );
      },
    // `handleDelete` captures `day`; including it ensures renderItem is
    // recreated at day rollover — FlatList compares by data reference anyway.
    [router, handleDelete],
  );

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

        {/* O `px-6` mora no wrapper, e não no container de 1120, para espelhar
            exatamente a saudação acima e o composer abaixo: os três se alinham
            porque medem 1120 no MÁXIMO, dentro da mesma faixa já recuada. Sem
            este wrapper, a linha era a única a encostar na sidebar (e na borda
            direita) sempre que a janela era estreita demais para o `mx-auto`
            sobrar margem — o que acontece em toda a faixa de 1024 a 1168. */}
        <View className="flex-1 px-6">
          <View className="mx-auto w-full max-w-[1120px] flex-1 flex-row items-start gap-8">
            <View className="sticky top-[124px] w-[320px] shrink-0 gap-5 xl:w-[400px]">
              <Animated.View style={summaryCardStyle}>
                <Card variant="elevated">
                  {/* No desktop o resumo mora numa coluna lateral própria e não
                      disputa espaço com a lista — fica sempre expandido. Por
                      isso `collapse` é omitido em vez de repassado: a lista
                      daqui não tem `onScroll`, então o valor compartilhado nunca
                      voltaria a zero. Quem colapsasse no mobile e alargasse a
                      janela até o desktop via a coluna lateral presa em barras. */}
                  <TodaySummaryHeader
                    key={summaryFocusKey}
                    summary={summaryQuery.data}
                    softMode={profile.soft_mode}
                  />
                </Card>
              </Animated.View>
              <GoalsDisclaimer />
            </View>

            <View className="flex-1">
              {/* `px-4` pelo mesmo motivo do cabeçalho da lista no mobile: os
                  cards carregam `marginHorizontal: 16` próprio, então sem este
                  recuo o título e a contagem ficavam 16px à esquerda deles. */}
              <View className="mb-4 flex-row items-baseline justify-between gap-4 px-4">
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
                <PullToRefresh onRefresh={handleRefresh}>
                  <Animated.FlatList
                    data={items}
                    keyExtractor={(m) => (m as OptimisticMeal).id}
                    renderItem={renderItem as never}
                    // Os degradês nas duas pontas já sinalizam que a lista
                    // continua; a barra por cima deles só suja a moldura.
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 180 }}
                    itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
                    refreshControl={
                      <RefreshControl
                        refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary[400]}
                      />
                    }
                  />
                </PullToRefresh>
              )}
            </View>
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

  // O título é fixo acima da lista, então some quando não há o que nomear:
  // "Refeições — 0 de hoje" cravado sobre um card vazio só repete o que a
  // ilustração do estado vazio já diz melhor.
  const listHeader =
    items.length === 0 ? null : (
      // Sem padding inferior: o respiro até o primeiro card vem da margem do
      // próprio card, então o rótulo fica mais perto da lista que ele nomeia do
      // que do dashboard acima — proximidade é o que agrupa os dois.
      <View className="px-4">
        <View className="flex-row items-baseline justify-between gap-4">
          <Text className="text-xl font-display-bold text-neutral-800">Refeições</Text>
          <Text className="text-[13px] text-neutral-500" style={{ fontVariant: ["tabular-nums"] }}>
            {items.length} de hoje
          </Text>
        </View>
      </View>
    );

  const macroPanel = (
    <View className="gap-2 px-4 pb-4 pt-2">
      <Animated.View style={summaryCardStyle}>
        <Card variant="elevated" className="relative">
          <TodaySummaryHeader
            key={summaryFocusKey}
            summary={summaryQuery.data}
            softMode={profile.soft_mode}
            collapse={collapse}
          />
          <Pressable
            onPress={() => setDisclaimerOpen((v) => !v)}
            accessibilityLabel={
              disclaimerOpen ? "Esconder aviso sobre as metas" : "Sobre estas metas"
            }
            accessibilityRole="button"
            hitSlop={8}
            className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full"
          >
            <Info size={16} color={colors.neutral[400]} />
          </Pressable>
        </Card>
      </Animated.View>
      {disclaimerOpen && (
        // 22 como o card acima: o disclaimer abre colado nele e é conteúdo
        // inline, não uma superfície flutuante como o ErrorBanner.
        <View className="flex-row items-start gap-2 rounded-[26px] bg-neutral-100 p-3">
          <Info size={16} color={colors.neutral[500]} />
          <Text className="flex-1 text-xs font-sans text-neutral-600">{GOALS_DISCLAIMER_TEXT}</Text>
        </View>
      )}
    </View>
  );

  /**
   * Cabeçalho fixo da lista: resumo + rótulo "Refeições".
   *
   * Ele é o `ListHeaderComponent` do FlatList, marcado como sticky — e não um
   * irmão acima da lista, como já foi. A diferença não é cosmética; ela é o
   * que faz o resumo funcionar:
   *
   * 1. Fora da lista, o resumo não pertencia a nenhuma superfície rolável.
   *    Arrastar o dedo em cima dele não fazia nada, porque não havia nada ali
   *    para rolar. Dentro, o gesto é da lista de graça, em qualquer ponto.
   *
   * 2. Fora da lista, encolher o resumo encolhia a caixa acima dela e o
   *    VIEWPORT da lista crescia junto (medido: 412px → 590px). Isso muda o
   *    offset máximo de rolagem, o navegador reancora o `scrollTop` para
   *    caber, e o reajuste voltava ao `onScroll` como se fosse gesto do
   *    usuário — o resumo se desfazia sozinho e ficava piscando. Como
   *    cabeçalho, o viewport é constante: encolher muda só a altura do
   *    conteúdo, e o gatilho por posição (`nextCollapse`) ignora reajustes
   *    longe do topo.
   *
   * Visualmente nada muda: `position: sticky` mantém o bloco colado no topo
   * com os cards passando por baixo, que é como já era.
   */
  const listHeaderComponent = (
    <View className="bg-neutral-50">
      {macroPanel}
      {listHeader}
      {items.length > 0 && <ListTopFade />}
    </View>
  );

  // isPending (não isLoading): true só enquanto NUNCA houve dado pra essa
  // query (primeiro carregamento do dia) — uma vez que os macros/refeições
  // chegam uma vez, refetches em segundo plano (foco, pull-to-refresh) não
  // reacendem esse spinner de tela cheia de novo. Sem isso, o loading
  // inicial do app (GuardedStack) escondia assim que o profile ficava
  // pronto, e a Home aparecia de relance com macros/refeições zerados antes
  // dos dados do dia chegarem.
  if (mealsQuery.isPending || summaryQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <HomeHeader softMode={profile.soft_mode} activeTab={activeTab} onChangeTab={setActiveTab} />
      <EmailConfirmationBanner className="mx-4 mt-2" />
      <NewVersionBanner className="mx-4 mt-2" />
      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
      <SwipeableTabs
        index={TABS.findIndex((t) => t.key === activeTab)}
        onIndexChange={(i) => setActiveTab(TABS[i]!.key)}
      >
        <>
          {/* A lista é a única superfície rolável da aba, e o resumo mora
              dentro dela — então o PullToRefresh embrulha o FlatList direto.
              Puxar pra atualizar continua funcionando desde o resumo, porque
              o resumo agora é o cabeçalho da própria lista. */}
          <PullToRefresh onRefresh={handleRefresh} enabled={summaryExpanded}>
            {/* A lista é renderizada sempre, inclusive vazia: antes o estado
                vazio era um Pressable solto, sem container rolável, e a tela
                ficava morta — nem o bounce do iOS acontecia. O estado vazio
                virou ListEmptyComponent para manter um único container de
                rolagem. */}
            <Animated.FlatList
              data={items}
              keyExtractor={(m) => (m as OptimisticMeal).id}
              renderItem={renderItem as never}
              ListHeaderComponent={listHeaderComponent}
              // Prende o cabeçalho (índice 0) no topo do scroller. É o que
              // mantém o resumo à vista enquanto os cards correm por baixo.
              stickyHeaderIndices={[0]}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              // Os degradês nas duas pontas já sinalizam que a lista
              // continua; a barra por cima deles só suja a moldura.
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                mealsQuery.isLoading ? null : (
                  <Pressable onPress={Keyboard.dismiss}>
                    <Card variant="flat" className="mx-4">
                      <EmptyMealsState />
                    </Card>
                  </Pressable>
                )
              }
              alwaysBounceVertical
              contentContainerStyle={{
                paddingBottom: listBottomSpace(composerHeight),
                flexGrow: 1,
              }}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
              refreshControl={
                <RefreshControl
                  // Só no expandido — que é exatamente quando a lista está
                  // no topo e puxar para atualizar faz sentido.
                  enabled={summaryExpanded}
                  refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary[400]}
                />
              }
            />
          </PullToRefresh>
        </>
        <FeedTabContent />
        <AnalisesPanel />
      </SwipeableTabs>
      {/* Composer sits over the list. We drive its position from
          useAnimatedKeyboard instead of KeyboardAvoidingView because absolute
          children inside KAV don't observe the padding it adds. */}
      <Animated.View
        onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, composerStyle]}
      >
        {/* O degradê fica aqui, irmão do bloco sólido e ancorado logo acima
            dele — e não dentro do MealComposer, onde se sobrepunha ao sólido e
            cruzava o topo dele ainda translúcido. */}
        <ComposerBackdrop />
        {/* Sem padding próprio: o bloco sólido termina exatamente onde o
            MealComposer termina. O `pt-3`/`pb-2` que havia aqui duplicava o
            respiro que o composer já aplica internamente (e o de baixo é
            derivado do safe area), e só rendia faixa opaca sobrando. */}
        <View className="bg-neutral-50">
          <MealComposer
            onSend={handleSend}
            onAudioReady={handleAudioReady}
            onPhotoPress={handlePhotoPress}
            onScanPress={() => router.push("/(app)/scan" as never)}
            disabled={banner === "quota_exceeded"}
            showBackdropFade={false}
            processing={
              createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
            }
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
