import { useEffect, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Loader2, Send } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useAutoGrowInput } from "@/lib/hooks/useAutoGrowInput";
import { composerBottomPad } from "./MealComposer";

/** Acima desta altura o input virou multilinha e precisa de respiro vertical. */
const MULTILINE_THRESHOLD = 40;

/**
 * Barra de comentário — a mesma linguagem do MealComposer.
 *
 * Antes era um `Input` retangular com borda mais um `Button` "Enviar" de
 * rótulo: dois componentes de formulário no rodapé de uma tela que, no resto
 * do app, tem uma barra flutuante ali. Aqui repete a geometria do composer de
 * refeição — pílula branca de 52px com curva 26, botão redondo de 52 ao lado,
 * mesmo `composerBottomPad` — porque é o mesmo gesto (escrever e enviar) no
 * mesmo lugar da tela.
 *
 * O que NÃO repete é o áudio: comentário é texto. Por isso um componente
 * próprio em vez de uma prop no MealComposer — as máquinas de estado de
 * gravação não têm o que fazer aqui.
 */
export function CommentComposer({
  onSend,
  sending,
}: {
  onSend: (body: string) => void;
  sending?: boolean;
}) {
  const [text, setText] = useState("");
  const insets = useSafeAreaInsets();
  const {
    ref,
    contentHeight,
    setContentHeight,
    measureAfterInput,
    reset: resetInputHeight,
    webHeight,
  } = useAutoGrowInput({ maxHeight: 120 });
  const rotation = useSharedValue(0);

  const hasText = text.trim().length > 0;
  const isMultiline = contentHeight > MULTILINE_THRESHOLD;

  useEffect(() => {
    if (sending) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    }
  }, [sending, rotation]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  function send() {
    const body = text.trim();
    if (!body || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    resetInputHeight();
    onSend(body);
  }

  return (
    <View style={{ paddingBottom: composerBottomPad(insets.bottom) }} className="px-4 pt-3">
      <View className="flex-row items-end gap-2">
        <View
          style={shadows.floating}
          className={[
            "min-h-[52px] flex-1 justify-center rounded-[26px] bg-white px-4",
            isMultiline ? "py-2" : "",
          ].join(" ")}
        >
          <TextInput
            ref={ref}
            value={text}
            onChangeText={(value) => {
              setText(value);
              measureAfterInput();
            }}
            onContentSizeChange={(e) => {
              // No web quem mede é o useAutoGrowInput; no nativo o SO cresce o
              // input sozinho e isto só alimenta o `isMultiline` acima.
              if (Platform.OS !== "web") setContentHeight(e.nativeEvent.contentSize.height);
            }}
            onKeyPress={
              Platform.OS === "web"
                ? (e) => {
                    const nativeEvent = e.nativeEvent as unknown as {
                      key: string;
                      shiftKey?: boolean;
                    };
                    if (nativeEvent.key === "Enter" && !nativeEvent.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }
                : undefined
            }
            placeholder="Escreva um comentário"
            placeholderTextColor={colors.neutral[400]}
            multiline
            maxLength={500}
            editable={!sending}
            textAlignVertical="center"
            style={{
              paddingTop: 0,
              paddingBottom: 0,
              includeFontPadding: false,
              ...(Platform.OS === "web"
                ? { resize: "none", outlineWidth: 0, height: webHeight }
                : null),
            }}
            className="max-h-32 text-base font-sans text-neutral-800"
          />
        </View>

        {/* O botão fica sempre visível, mas desabilitado enquanto não há texto.
            No MealComposer ele alterna com o microfone; aqui não há segunda
            ação para ocupar o lugar, e um botão que some e volta a cada
            caractere faz a barra piscar. */}
        <Pressable
          onPress={send}
          disabled={!hasText || sending}
          accessibilityLabel="Enviar comentário"
          accessibilityRole="button"
          style={shadows.floating}
          className={[
            "h-[52px] w-[52px] items-center justify-center rounded-full",
            !hasText || sending ? "bg-neutral-200" : "bg-primary-400 active:bg-primary-500",
          ].join(" ")}
        >
          {sending ? (
            <Animated.View style={spinStyle}>
              <Loader2 size={20} color={colors.white} />
            </Animated.View>
          ) : (
            <Send size={20} color={hasText ? colors.white : colors.neutral[400]} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
