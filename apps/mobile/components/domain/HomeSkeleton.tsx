import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";
import { Card } from "@/components/Card";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { AVATAR_SIZE } from "@/components/domain/HomeHeader";
import { SUMMARY } from "@/lib/summary-geometry";

/**
 * Placeholder de tela cheia pro carregamento inicial (gates de auth/perfil +
 * primeiro carregamento do dia, antes de `mealsQuery`/`summaryQuery` terem
 * dado). Espelha a Home inteira — header (ofensiva/abas/avatar), o anel de
 * calorias + as três barras de macro de `TodaySummaryHeader` (ver `SUMMARY`
 * em `lib/summary-geometry.ts` pros raios), `MealCardSkeleton` no lugar da
 * lista, e o composer no rodapé — porque header e footer são casca fixa da
 * Home, não conteúdo que carrega depois: mostrá-los só quando os dados do dia
 * chegassem fazia parecer um segundo loading logo após o primeiro. Uma vez
 * que essa tela sai de cena, o resto do carregamento (trocar de aba) é por
 * aba — cada uma com seu próprio skeleton (`FeedPostSkeleton`,
 * `InsightCardSkeleton`, ...), não essa casca.
 */
export function HomeSkeleton() {
  const kcalSize = SUMMARY.kcal.radius * 2;
  const macroSize = SUMMARY.macro.radius * 2;

  return (
    <View className="flex-1 bg-neutral-50">
      {/* Header: ofensiva, barra de abas, avatar — mesmo layout de
          HomeHeader.tsx (linha de altura AVATAR_SIZE). */}
      <View className="flex-row items-center gap-2 px-4 pt-2">
        <SkeletonBlock width={64} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
        {/* `width={0}` de propósito: é o `flex: 1` que dá a largura de
            verdade (o resto da linha, depois do avatar/ofensiva) — um valor
            fixo aqui só serve de base antes do flexbox assumir, e "100%"
            somado a `flex: 1` fazia a linha estourar a largura da tela. */}
        <SkeletonBlock width={0} height={AVATAR_SIZE} radius={9999} style={{ flex: 1 }} />
        <SkeletonCircle size={AVATAR_SIZE} />
      </View>

      <View className="gap-2 px-4 pb-4 pt-4">
        <Card variant="elevated">
          <View className="items-center gap-2 py-2">
            <SkeletonCircle size={kcalSize} />
            <SkeletonBlock width={80} height={12} radius={4} style={{ marginTop: 8 }} />
          </View>
          <View className="mt-6 flex-row justify-around">
            {[0, 1, 2].map((i) => (
              <View key={i} className="items-center gap-2">
                <SkeletonCircle size={macroSize} />
                <SkeletonBlock width={56} height={11} radius={4} />
              </View>
            ))}
          </View>
        </Card>
      </View>
      <MealCardSkeleton />
      <MealCardSkeleton />
      <MealCardSkeleton />

      {/* Footer: composer (busca/adicionar ou áudio) — mesma altura de
          controle (52px) e o mesmo par pill+botão redondo de MealComposer. */}
      <View className="mt-auto flex-row items-end gap-2 px-4 pb-3 pt-3">
        <SkeletonBlock width={0} height={52} radius={26} style={{ flex: 1 }} />
        <SkeletonCircle size={52} />
      </View>
    </View>
  );
}
