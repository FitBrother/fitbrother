import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { ImageDown, X } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

/**
 * Quanto tempo o convite fica na tela.
 *
 * Longo o bastante para ser lido depois que a refeição terminou de processar,
 * curto o bastante para não virar mobília acima do composer — se ficasse, a
 * pessoa aprenderia a ignorá-lo, que é como um convite morre.
 */
const VISIVEL_MS = 8000;

/**
 * Convite a gerar a imagem, logo depois de registrar a refeição.
 *
 * Este é o instante em que a pessoa acabou de ver os macros do que comeu e
 * está com a tela na mão — e era o único momento do app que não oferecia nada.
 * Compartilhar só existia entrando no detalhe da refeição, o que exige querer
 * compartilhar ANTES de ter algo para mostrar.
 *
 * Fica acima do composer porque é onde o olho já está (foi ali que ela acabou
 * de digitar ou falar), e some sozinho: um convite que precisa ser recusado é
 * uma cobrança.
 */
export function ShareMealPrompt({ onPress, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIVEL_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    // O `className` fica no View de dentro, não no Animated.View: o NativeWind
    // não processa className em componentes do Reanimated — as classes cairiam
    // fora e a faixa sairia sem layout nenhum.
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)}>
      <View
        style={shadows.card}
        className="mx-4 mb-2 flex-row items-center gap-2 rounded-[26px] bg-white p-2 pl-4"
      >
        {/* Só o convite, sem "Registrada": o card da refeição acabou de
            aparecer logo acima com os macros: anunciar de novo gastava a
            linha e empurrava o botão para uma segunda. */}
        <Text className="flex-1 font-sans-medium text-sm text-neutral-700">Bora mostrar?</Text>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Gerar imagem desta refeição"
          className="min-h-[40px] flex-row items-center gap-1.5 rounded-full bg-primary-400 px-4 active:bg-primary-500"
        >
          <ImageDown size={16} color={colors.white} />
          <Text className="font-sans-semibold text-sm text-white">Gerar imagem</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dispensar"
          hitSlop={8}
          className="min-h-[40px] min-w-[40px] items-center justify-center active:opacity-70"
        >
          <X size={18} color={colors.neutral[400]} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

type Props = {
  onPress: () => void;
  onDismiss: () => void;
};

/** Só vale a pena convidar se houver número para mostrar. */
export function valeCompartilhar(meal: { review_required: boolean; total_kcal: number }): boolean {
  return !meal.review_required && meal.total_kcal > 0;
}
