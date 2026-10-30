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
  escala,
  onCapture,
  onIndisponivel,
}: {
  data: ShareCardData;
  escala: number;
  onCapture: (uri: string, tamanho: Tamanho, presetId: SharePresetId) => void;
  onIndisponivel: (motivo: CameraErro) => void;
}) {
  const camera = useRef<CameraLiveHandle>(null);
  const presets = presetsAoVivo();
  const [index, setIndex] = useState(0);
  const [pronta, setPronta] = useState(false);
  const preset = presetAt(presets, index);

  // O preset em cena viaja com a captura: a tela volta ao carrossel completo
  // já naquele estilo, em vez de jogar a pessoa de volta para o primeiro.
  const entregar = useCallback(
    (uri: string, tamanho: Tamanho) => onCapture(uri, tamanho, preset.id),
    [onCapture, preset.id],
  );

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <CardPreview escala={escala}>
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
                <View key={p.id} className="flex-1">
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
          onPress={() => camera.current?.capturar()}
          disabled={!pronta}
          accessibilityRole="button"
          accessibilityLabel="Tirar foto"
          style={shadows.card}
          className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-full bg-primary-400 active:bg-primary-500 disabled:opacity-50"
        >
          <Camera size={20} color={colors.white} />
          <Text className="text-base font-sans-bold text-white">Tirar foto</Text>
        </Pressable>
      </View>
    </View>
  );
}
