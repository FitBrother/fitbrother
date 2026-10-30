import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive";
import { ShareCard, type ShareCardData } from "@/components/domain/ShareCard";
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import { presetAt, presetsAoVivo, type SharePresetId } from "@/lib/share/presets";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { CardPreview } from "./CardPreview";

import type { LayoutChangeEvent } from "react-native";
import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

/**
 * Câmera ao vivo com a moldura do preset por cima.
 *
 * A `CameraLive` fica **fora** do `SwipeableTabs`, numa camada atrás: é UMA
 * câmera, e o pager carrega só o cromo (`ShareCard` com `fotoExterna`). Montar
 * uma câmera por cena pediria permissão cinco vezes e travaria o aparelho.
 *
 * **Não há arrastar nem pinçar aqui.** Com câmera ao vivo o enquadramento se faz
 * movendo o celular, então o arrasto fica inteiro para o carrossel — e o
 * conflito de gesto que obrigou o editor a substituir o carrossel não existe.
 */
export function ShareCameraStage({
  data,
  temMacros,
  onCapture,
  onIndisponivel,
  onErroCaptura,
}: {
  data: ShareCardData;
  temMacros: boolean;
  onCapture: (uri: string, tamanho: Tamanho, presetId: SharePresetId) => void;
  onIndisponivel: (motivo: CameraErro) => void;
  onErroCaptura: (err: unknown) => void;
}) {
  const camera = useRef<CameraLiveHandle>(null);
  const presets = presetsAoVivo({ temMacros });
  const [index, setIndex] = useState(0);
  const [pronta, setPronta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const preset = presetAt(presets, index);

  // Mede o próprio espaço do card em vez de receber a escala da tela: a tela
  // calcula a dela com a área inteira, e este palco devolve parte dessa área
  // ao label e ao obturador. Usar a escala de lá deixava o card ~135dp maior
  // que o vão, sangrando por cima do cabeçalho em qualquer celular.
  const [slot, setSlot] = useState(0);
  const aoMedir = useCallback((e: LayoutChangeEvent) => {
    setSlot(e.nativeEvent.layout.height);
  }, []);
  const escala = slot > 0 ? Math.min(1, (slot - 24) / SHARE_CARD_HEIGHT) : 0;

  // O preset em cena viaja com a captura: a tela volta ao carrossel completo
  // já naquele estilo, em vez de jogar a pessoa de volta para o primeiro.
  const entregar = useCallback(
    (uri: string, tamanho: Tamanho) => onCapture(uri, tamanho, preset.id),
    [onCapture, preset.id],
  );

  /**
   * O obturador.
   *
   * `capturando` faz duas coisas que o botão sozinho não faria. Impede a
   * segunda captura de um toque duplo — no nativo `takePictureAsync` leva
   * centenas de ms, e duas capturas viram dois uploads correndo no mesmo path,
   * podendo salvar um frame diferente do que foi compartilhado. E dá dono à
   * promessa: sem o catch, um frame sem dados rejeitava sem nada na tela.
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

  return (
    <View className="flex-1">
      <View testID="slot-card" className="flex-1 items-center justify-center" onLayout={aoMedir}>
        <CardPreview escala={escala} testID="card-preview">
          <View style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }}>
            {/* Camada única, atrás e fora do pager: o translateX do carrossel
                não a alcança, então a imagem não desliza junto com o cromo. */}
            <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
              <CameraLive
                ref={camera}
                aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
                onReady={() => setPronta(true)}
                onCapture={entregar}
                onError={onIndisponivel}
              />
            </View>
            <SwipeableTabs index={index} onIndexChange={setIndex}>
              {presets.map((p) => (
                <View key={p.id} testID="cena-preset" className="flex-1">
                  <ShareCard data={data} preset={p} fotoExterna />
                </View>
              ))}
            </SwipeableTabs>
          </View>
        </CardPreview>
      </View>

      <View className="items-center pb-1 pt-3">
        <Text className="font-sans-medium text-sm text-neutral-600">{preset.label}</Text>
        <View className="mt-2 flex-row gap-1.5">
          {presets.map((p, i) => (
            <View
              key={p.id}
              className={[
                "h-1.5 rounded-full",
                i === index ? "w-5 bg-primary-400" : "w-1.5 bg-neutral-300",
              ].join(" ")}
            />
          ))}
        </View>
        <Text className="mt-2 font-sans text-xs text-neutral-400">
          Arraste para trocar de estilo · mova o celular para enquadrar
        </Text>
      </View>

      <View className="px-4 pb-4 pt-3">
        <Pressable
          onPress={disparar}
          disabled={!pronta || capturando}
          accessibilityRole="button"
          accessibilityLabel="Tirar foto"
          accessibilityState={{ disabled: !pronta || capturando, busy: capturando }}
          style={shadows.card}
          className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-full bg-primary-400 active:bg-primary-500 disabled:opacity-50"
        >
          <Camera size={20} color={colors.white} />
          <Text className="text-base font-sans-bold text-white">
            {capturando ? "Capturando…" : "Tirar foto"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
