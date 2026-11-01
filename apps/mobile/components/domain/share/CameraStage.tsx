import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ImageIcon, ImageOff, SwitchCamera, X } from "lucide-react-native";
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive";
import { colors } from "@/lib/colors";
import { tamanhoDoQuadro } from "@/lib/share/story";

import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { CameraErro, Lado } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

export type Disparo = { disparar: () => void; habilitado: boolean; ocupado: boolean };

/**
 * A câmera em tela cheia, no molde da de stories do Instagram.
 *
 * É superfície de câmera, não dark mode: o fundo `ink` vale para qualquer tema.
 * Serve ao story e ao Novo post, que mudam só a proporção do quadro e o que vai
 * por cima dele. Os controles se ancoram na ÁREA, não no quadro: no 9:16 os dois
 * quase coincidem, e no 4:5 o disparo fica no pé da tela, longe da foto.
 *
 * **Não há arrastar nem pinçar aqui.** Com câmera ao vivo o enquadramento se faz
 * movendo o celular.
 */
export function CameraStage({
  aspect,
  rotulo,
  onCapture,
  onGaleria,
  onSemFoto,
  onFechar,
  onErroCaptura,
  sobreposicao,
  topoDireita,
  fila,
}: {
  aspect: number;
  /** Nome da etapa, no centro da barra de baixo. */
  rotulo: string;
  onCapture: (uri: string, tamanho: Tamanho) => void;
  onGaleria: () => void;
  onSemFoto: () => void;
  onFechar: () => void;
  onErroCaptura: (err: unknown) => void;
  /** O que vai sobre o vídeo. Recebe o tamanho do quadro na tela. */
  sobreposicao?: (quadro: Tamanho) => ReactNode;
  topoDireita?: ReactNode;
  /** Troca o disparo padrão. É onde entra a fila de presets. */
  fila?: (d: Disparo) => ReactNode;
}) {
  const camera = useRef<CameraLiveHandle>(null);
  const [area, setArea] = useState<Tamanho | null>(null);
  const [pronta, setPronta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [lado, setLado] = useState<Lado>("back");
  const [semCamera, setSemCamera] = useState(false);

  const aoMedir = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  }, []);

  const aoFaltarCamera = useCallback((motivo: CameraErro) => {
    setSemCamera(true);
    console.warn("[share-card] câmera indisponível:", motivo);
  }, []);

  /**
   * O obturador.
   *
   * `capturando` faz duas coisas que o botão sozinho não faria. Impede a
   * segunda captura de um toque duplo — no nativo `takePictureAsync` leva
   * centenas de ms. E dá dono à promessa: sem o catch, um frame sem dados
   * rejeitava sem nada na tela.
   */
  const disparar = useCallback(async () => {
    if (capturando || !camera.current) return;
    setCapturando(true);
    try {
      await camera.current.capturar();
    } catch (err) {
      onErroCaptura(err);
    } finally {
      setCapturando(false);
    }
  }, [capturando, onErroCaptura]);

  const habilitado = pronta && !capturando && !semCamera;
  const disparo: Disparo = {
    disparar: () => {
      if (habilitado) void disparar();
    },
    habilitado,
    ocupado: capturando,
  };
  const quadro = area ? tamanhoDoQuadro(area, aspect) : null;

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View testID="area-camera" className="flex-1 items-center justify-center" onLayout={aoMedir}>
        {quadro ? (
          <View
            testID="quadro-camera"
            style={{ width: quadro.width, height: quadro.height, borderRadius: 18 }}
            className="overflow-hidden bg-ink-soft"
          >
            <CameraLive
              ref={camera}
              aspect={aspect}
              facing={lado}
              onReady={() => setPronta(true)}
              onCapture={onCapture}
              onError={aoFaltarCamera}
            />
            {sobreposicao ? (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: "none",
                }}
              >
                {sobreposicao(quadro)}
              </View>
            ) : null}
            {semCamera ? (
              <View className="absolute inset-0 items-center justify-center px-10">
                <Text className="text-center font-sans-medium text-sm text-white">
                  Sem câmera aqui. Use a galeria ou siga sem foto.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View
          style={{ pointerEvents: "box-none" }}
          className="absolute left-2 right-2 top-2 flex-row items-center justify-between"
        >
          <BotaoRedondo rotulo="Fechar" onPress={onFechar}>
            <X size={24} color={colors.white} />
          </BotaoRedondo>
          {topoDireita}
        </View>

        <View style={{ pointerEvents: "box-none" }} className="absolute left-2 top-16">
          <Pressable
            onPress={onSemFoto}
            accessibilityRole="button"
            accessibilityLabel="Continuar sem foto"
            className="min-h-[44px] flex-row items-center gap-2 rounded-full bg-ink/40 px-3 py-2 active:bg-ink/60"
          >
            <ImageOff size={18} color={colors.white} />
            <Text className="font-sans-semibold text-xs text-white">Sem foto</Text>
          </Pressable>
        </View>

        <View style={{ pointerEvents: "box-none" }} className="absolute bottom-3 left-0 right-0">
          {fila ? fila(disparo) : <DisparoSimples {...disparo} />}
        </View>
      </View>

      <View className="h-[76px] flex-row items-center justify-between px-4">
        <BotaoRedondo rotulo="Escolher foto da galeria" onPress={onGaleria}>
          <ImageIcon size={24} color={colors.white} />
        </BotaoRedondo>
        <Text className="font-sans-semibold text-sm text-white">{rotulo}</Text>
        <BotaoRedondo
          rotulo="Virar câmera"
          onPress={() => setLado((l) => (l === "back" ? "front" : "back"))}
        >
          <SwitchCamera size={24} color={colors.white} />
        </BotaoRedondo>
      </View>
    </SafeAreaView>
  );
}

/** Botão só de ícone da superfície da câmera. */
export function BotaoRedondo({
  rotulo,
  onPress,
  selecionado,
  children,
}: {
  rotulo: string;
  onPress: () => void;
  selecionado?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={selecionado === undefined ? undefined : { selected: selecionado }}
      className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-ink/40 active:bg-ink/60"
    >
      {children}
    </Pressable>
  );
}

function DisparoSimples({ disparar, habilitado, ocupado }: Disparo) {
  return (
    <View className="items-center">
      <Pressable
        onPress={disparar}
        disabled={!habilitado}
        accessibilityRole="button"
        accessibilityLabel="Tirar foto"
        accessibilityState={{ disabled: !habilitado, busy: ocupado }}
        style={{ width: 76, height: 76, borderWidth: 4 }}
        className="rounded-full border-primary-400 bg-white/20 active:bg-white/40 disabled:opacity-50"
      />
    </View>
  );
}
