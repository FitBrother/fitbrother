import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Import do `.web` explícito, não `@/components/domain/CameraLive`: o
// `CameraLive.tsx` nativo só existe mais adiante no plano, e o TypeScript (ao
// contrário do Metro) não resolve sufixo de plataforma sem o arquivo base.
// Esta rota é de medição e só roda na web — que é onde a resolução é o risco.
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive.web";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/** Lado curto mínimo para o export de 1080×1920 não virar upscale. */
const LADO_CURTO_ALVO = 1080;

/**
 * Medição de resolução de câmera. Temporária — sai assim que o número estiver
 * anotado no plano.
 *
 * Não tem preset, não tem carrossel e não sobe nada. A única pergunta é qual
 * frame o aparelho entrega quando pedimos retrato 1080×1920.
 *
 * **Fora do grupo `(app)`, de propósito.** Lá dentro a rota exigiria sessão e
 * onboarding completo (o `(app)` é guardado, e o auth do app passa por um proxy
 * no servidor Fastify), e medir a câmera do aparelho não depende de dado de
 * usuário nenhum. Quem for abrir isto no celular não devia ter que fazer login
 * primeiro.
 */
export default function DebugCameraScreen() {
  const camera = useRef<CameraLiveHandle>(null);
  const [frame, setFrame] = useState<Tamanho | null>(null);
  const [erro, setErro] = useState<CameraErro | null>(null);

  const curto = frame ? Math.min(frame.width, frame.height) : 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 px-4">
      <Text className="py-3 text-xl font-display-bold text-neutral-800">Medir câmera</Text>

      {erro ? (
        <Text className="font-sans-medium text-danger-500">{`Falhou: ${erro}`}</Text>
      ) : (
        <CameraLive
          ref={camera}
          aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
          onCapture={(_uri, tamanho) => setFrame(tamanho)}
          onError={setErro}
        />
      )}

      {frame ? (
        <View className="mt-4 rounded-2xl bg-white p-4">
          <Text style={NUM} className="text-2xl font-display-bold text-neutral-800">
            {`${frame.width}×${frame.height}`}
          </Text>
          <Text style={NUM} className="mt-1 font-sans text-neutral-600">
            {`lado curto ${curto} · alvo ${LADO_CURTO_ALVO}`}
          </Text>
          <Text
            className={[
              "mt-2 font-sans-semibold",
              curto >= LADO_CURTO_ALVO ? "text-success-500" : "text-warning-500",
            ].join(" ")}
          >
            {curto >= LADO_CURTO_ALVO
              ? "Sem upscale no export."
              : `Upscale de ${(LADO_CURTO_ALVO / curto).toFixed(2)}× no export.`}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => camera.current?.capturar()}
        accessibilityRole="button"
        accessibilityLabel="Medir o frame da câmera"
        className="mb-4 mt-auto min-h-[56px] items-center justify-center rounded-full bg-primary-400 active:bg-primary-500"
      >
        <Text className="text-base font-sans-bold text-white">Medir</Text>
      </Pressable>
    </SafeAreaView>
  );
}
