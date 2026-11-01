import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { ChevronLeft, Contrast, Download, Share2, Trash2 } from "lucide-react-native";
import { colors } from "@/lib/colors";
import {
  captureCard,
  podeCompartilharArquivos,
  saveCardToGallery,
  shareCard,
} from "@/lib/share-card";
import { Sentry } from "@/lib/sentry";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import {
  arranjoInicial,
  estiloFoto,
  estiloSticker,
  FOTO_PADRAO,
  LIXEIRA,
  stickersDoPreset,
  tamanhoDoQuadro,
  type Caixa,
  type FotoLivre,
  type Sticker,
  type StickerId,
  type StoryPresetId,
} from "@/lib/share/story";
import { presetPorId, presetsDoStory } from "@/lib/share/story-presets";
import { useToast } from "@/lib/toast/toast-context";
import { BotaoRedondo } from "./CameraStage";
import { CardPreview } from "./CardPreview";
import { PresetRow } from "./PresetRow";
import {
  conteudoDoStory,
  estiloBaseDaFoto,
  QUADRO_STORY,
  StoryCard,
  temMacros,
  type CaixaStickerProps,
  type CamadaFotoProps,
  type StoryCardData,
} from "./StoryCard";
import { useStoryGestos } from "./useStoryGestos";

import type { LayoutChangeEvent, View as RNView, ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { Tamanho } from "@/lib/media/crop";

const ASPECTO = SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT;

/**
 * Os shared values do quadro visível.
 *
 * Por contexto porque `CaixaAnimada` e `FotoAnimada` são passadas como
 * componente ao `StoryCard`: precisam ter identidade estável, ou cada render
 * remontaria todos os stickers.
 */
const ValoresDoStory = createContext<{
  stickers: SharedValue<Sticker[]>;
  foto: SharedValue<FotoLivre>;
} | null>(null);

function CaixaAnimada({ sticker, style, onLayout, children }: CaixaStickerProps) {
  const valores = useContext(ValoresDoStory);
  const id = sticker.id;
  const stickers = valores?.stickers;
  const animado = useAnimatedStyle(() => {
    const atual = stickers?.value.find((s) => s.id === id) ?? sticker;
    return estiloSticker(atual) as ViewStyle;
  });
  return (
    <Animated.View testID={`animado-${id}`} style={[style, animado]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

function FotoAnimada({ uri, natural, foto }: CamadaFotoProps) {
  const valores = useContext(ValoresDoStory);
  const compartilhada = valores?.foto;
  const n = natural ?? QUADRO_STORY;
  const animado = useAnimatedStyle(
    () => estiloFoto(compartilhada?.value ?? foto, n, QUADRO_STORY) as never,
  );
  return (
    <Animated.Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      style={[estiloBaseDaFoto(natural), animado]}
    />
  );
}

/**
 * O editor do story: depois da foto, antes de exportar.
 *
 * O quadro visível anda por shared values e o nó fora da tela só recebe o estado
 * quando o gesto termina. Capturar o visível daria problema: ele vive dentro da
 * escala do preview, e o html2canvas mudaria a geometria do PNG. O nó de captura
 * não tem transform nenhum e mede exatamente 360×640.
 */
export function StoryEditor({
  data,
  foto,
  fotoNatural,
  presetInicial,
  vinhetaInicial,
  onVoltar,
  onExportar,
}: {
  data: StoryCardData;
  foto: string | null;
  fotoNatural: Tamanho | null;
  presetInicial: StoryPresetId;
  vinhetaInicial: boolean;
  onVoltar: () => void;
  /** Chamado a cada Baixar ou Compartilhar, antes de gerar a imagem. */
  onExportar: () => void;
}) {
  const toast = useToast();
  const conteudo = conteudoDoStory(data);
  const presets = presetsDoStory({ temFoto: Boolean(foto), temMacros: temMacros(data) });
  const [presetId, setPresetId] = useState<StoryPresetId>(() =>
    presets.some((p) => p.id === presetInicial) ? presetInicial : (presets[0]?.id ?? "completo"),
  );
  const preset = presetPorId(presetId);

  const [stickers, setStickers] = useState<Sticker[]>(() =>
    arranjoInicial(stickersDoPreset(presetId, conteudo)),
  );
  const [fotoLivre, setFotoLivre] = useState<FotoLivre>(FOTO_PADRAO);
  const [vinheta, setVinheta] = useState(vinhetaInicial);
  const [area, setArea] = useState<Tamanho | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [preparando, setPreparando] = useState(false);

  const stickersSV = useSharedValue(stickers);
  const fotoSV = useSharedValue(fotoLivre);
  const caixasSV = useSharedValue<Partial<Record<StickerId, Caixa>>>({});
  const captura = useRef<RNView>(null);
  const camada = useRef<RNView>(null);
  const valores = useRef({ stickers: stickersSV, foto: fotoSV }).current;

  const quadro = area ? tamanhoDoQuadro(area, ASPECTO) : null;
  const escala = quadro ? quadro.width / SHARE_CARD_WIDTH : 0;

  const aoMedirArea = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  }, []);

  const aoMedirSticker = useCallback(
    (id: StickerId, caixa: Caixa) => {
      caixasSV.value = { ...caixasSV.value, [id]: caixa };
    },
    [caixasSV],
  );

  const aoFimDoGesto = useCallback(
    (removido: StickerId | null, atuais: Sticker[], fotoAtual: FotoLivre) => {
      const proximos =
        removido && removido !== "logo"
          ? atuais.map((s) => (s.id === removido ? { ...s, removido: true } : s))
          : atuais;
      stickersSV.value = proximos;
      setStickers(proximos);
      setFotoLivre(fotoAtual);
    },
    [stickersSV],
  );

  const { gesto, sobreLixeira } = useStoryGestos({
    escala,
    temFoto: Boolean(foto),
    stickers: stickersSV,
    foto: fotoSV,
    caixas: caixasSV,
    onArrastar: setArrastando,
    onFim: aoFimDoGesto,
    camada,
  });

  const estiloLixeira = useAnimatedStyle(() => ({
    transform: [{ scale: sobreLixeira.value ? 1.25 : 1 }],
  }));

  /** Refaz o arranjo: é assim que um sticker removido volta. A foto fica. */
  function aplicarPreset(id: StoryPresetId) {
    const arranjo = arranjoInicial(stickersDoPreset(id, conteudo));
    setPresetId(id);
    setStickers(arranjo);
    stickersSV.value = arranjo;
    setVinheta(presetPorId(id).vinheta);
  }

  /**
   * Captura o que está em cena, na hora em que a pessoa pede.
   *
   * **Não há pré-captura.** Rasterizar 1080×1920 é o trabalho mais caro desta
   * tela, e pagá-lo adiantado travava o gesto (medido: 78% do tempo bloqueado).
   * O custo cai no toque, com o botão dizendo que está preparando. O preço é o
   * share poder cair fora da janela de ativação; `shareCard` trata isso caindo
   * para o download.
   */
  async function comCaptura(acao: (uri: string) => Promise<void>) {
    setPreparando(true);
    try {
      onExportar();
      await acao(await captureCard(captura));
    } finally {
      setPreparando(false);
    }
  }

  async function aoCompartilhar() {
    try {
      await comCaptura(shareCard);
    } catch (err) {
      // Cancelar a folha de compartilhamento rejeita com AbortError — não é
      // falha, a pessoa só desistiu.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[share-card] compartilhar falhou:", err);
      Sentry.captureException(err);
      toast({ variant: "error", message: "Não foi possível compartilhar a imagem." });
    }
  }

  async function aoSalvar() {
    try {
      await comCaptura(saveCardToGallery);
      toast({
        variant: "success",
        message: Platform.OS === "web" ? "Imagem baixada!" : "Salvo na galeria!",
      });
    } catch (err) {
      const semPermissao = err instanceof Error && err.message === "gallery_permission_denied";
      if (!semPermissao) {
        console.error("[share-card] salvar falhou:", err);
        Sentry.captureException(err);
      }
      toast({
        variant: "error",
        message: semPermissao
          ? "Permita o acesso às fotos pra salvar."
          : "Não foi possível salvar a imagem.",
      });
    }
  }

  const compartilha = podeCompartilharArquivos();

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View
        testID="area-editor"
        className="flex-1 items-center justify-center"
        onLayout={aoMedirArea}
      >
        {quadro ? (
          <View style={{ width: quadro.width, height: quadro.height }}>
            <CardPreview escala={escala}>
              <ValoresDoStory.Provider value={valores}>
                <StoryCard
                  data={data}
                  preset={preset}
                  stickers={stickers}
                  vinheta={vinheta}
                  foto={foto}
                  fotoNatural={fotoNatural}
                  fotoLivre={fotoLivre}
                  CaixaSticker={CaixaAnimada}
                  CamadaFoto={FotoAnimada}
                  aoMedir={aoMedirSticker}
                />
              </ValoresDoStory.Provider>
            </CardPreview>

            {/* Por cima de tudo, sem nada dentro: quem decide o alvo é o
                hit-test, e os stickers nem recebem toque. `touchAction="none"`
                porque aqui o arrasto em qualquer direção é do editor. */}
            <GestureDetector gesture={gesto} touchAction="none">
              <View
                ref={camada}
                collapsable={false}
                accessible
                accessibilityLabel="Área de edição. Arraste os elementos e use dois dedos para ajustar a foto."
                style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
              />
            </GestureDetector>

            {arrastando ? (
              <Animated.View
                testID="lixeira"
                style={[
                  {
                    position: "absolute",
                    left: LIXEIRA.x * escala - 28,
                    top: LIXEIRA.y * escala - 28,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.ink,
                    pointerEvents: "none",
                  },
                  estiloLixeira,
                ]}
              >
                <Trash2 size={24} color={colors.white} />
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        <View
          style={{ pointerEvents: "box-none" }}
          className="absolute left-2 right-2 top-2 flex-row items-center justify-between"
        >
          <BotaoRedondo rotulo="Voltar" onPress={onVoltar}>
            <ChevronLeft size={24} color={colors.white} />
          </BotaoRedondo>
          {foto ? (
            <BotaoRedondo
              rotulo={vinheta ? "Desligar vinheta" : "Ligar vinheta"}
              selecionado={vinheta}
              onPress={() => setVinheta((v) => !v)}
            >
              <Contrast size={22} color={vinheta ? colors.primary[400] : colors.white} />
            </BotaoRedondo>
          ) : null}
        </View>

        {/* Some durante o arrasto: é onde a lixeira aparece. */}
        {arrastando ? null : (
          <View style={{ pointerEvents: "box-none" }} className="absolute bottom-3 left-0 right-0">
            <PresetRow
              presets={presets}
              index={Math.max(
                presets.findIndex((p) => p.id === presetId),
                0,
              )}
              onSelecionar={(i) => {
                const p = presets[i];
                if (p) aplicarPreset(p.id);
              }}
              onCentro={() => aplicarPreset(presetId)}
              rotuloCentro={`Refazer ${preset.label}`}
            />
          </View>
        )}
      </View>

      <View className="h-[76px] flex-row items-center gap-3 px-4">
        <Pressable
          onPress={aoSalvar}
          disabled={preparando}
          accessibilityRole="button"
          accessibilityLabel={Platform.OS === "web" ? "Baixar imagem" : "Salvar na galeria"}
          className={[
            "min-h-[52px] items-center justify-center rounded-full bg-white/15 active:bg-white/25 disabled:opacity-50",
            compartilha ? "min-w-[52px]" : "flex-1 flex-row gap-2",
          ].join(" ")}
        >
          <Download size={22} color={colors.white} />
          {compartilha ? null : (
            <Text className="text-base font-sans-bold text-white">
              {preparando ? "Gerando imagem…" : "Baixar"}
            </Text>
          )}
        </Pressable>
        {compartilha ? (
          <Pressable
            onPress={aoCompartilhar}
            disabled={preparando}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar imagem"
            className="min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary-400 active:bg-primary-500 disabled:opacity-50"
          >
            {preparando ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Share2 size={20} color={colors.ink} />
            )}
            <Text className="text-base font-sans-bold text-ink">
              {preparando ? "Gerando imagem…" : "Compartilhar"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Palco de captura: o card em tamanho cheio, fora da tela. */}
      <View
        ref={captura}
        testID="captura-story"
        collapsable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: "absolute",
          left: -9999,
          top: 0,
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          pointerEvents: "none",
        }}
      >
        <StoryCard
          data={data}
          preset={preset}
          stickers={stickers}
          vinheta={vinheta}
          foto={foto}
          fotoNatural={fotoNatural}
          fotoLivre={fotoLivre}
        />
      </View>
    </SafeAreaView>
  );
}
