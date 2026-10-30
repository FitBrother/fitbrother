import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Import do `.web` explícito, não `@/components/domain/CameraLive`: o
// `CameraLive.tsx` nativo só existe mais adiante no plano, e o TypeScript (ao
// contrário do Metro) não resolve sufixo de plataforma sem o arquivo base.
// Esta rota é de medição e só roda na web — que é onde a resolução é o risco.
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive.web";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import { RESOLUCAO_ALVO } from "@/lib/media/camera-constraints";

import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };
const PREVIEW_WIDTH = 180;

const TRASEIRA = { facingMode: { ideal: "environment" } };

/**
 * Os pedidos comparados.
 *
 * O iPhone respondeu 1920×1080 a um pedido de 1080×1920, em retrato, no Safari
 * e no Vivaldi. Falta saber qual pedido devolve retrato de verdade — e isso só
 * se descobre no aparelho, por isso a tela mede em vez de assumir.
 */
const PEDIDOS: { nome: string; video: MediaTrackConstraints }[] = [
  { nome: "1080×1920", video: { ...TRASEIRA, width: { ideal: 1080 }, height: { ideal: 1920 } } },
  { nome: "1920×1080", video: { ...TRASEIRA, width: { ideal: 1920 }, height: { ideal: 1080 } } },
  { nome: "9:16", video: { ...TRASEIRA, aspectRatio: { ideal: 9 / 16 }, height: { ideal: 1920 } } },
  { nome: "16:9", video: { ...TRASEIRA, aspectRatio: { ideal: 16 / 9 }, width: { ideal: 1920 } } },
];

/** Abre a câmera com um pedido, lê o tamanho real do frame e fecha. */
async function medirPedido(video: MediaTrackConstraints): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
  try {
    const el = document.createElement("video");
    el.playsInline = true;
    el.muted = true;
    el.srcObject = stream;
    await el.play();
    if (!el.videoWidth) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return `${el.videoWidth}×${el.videoHeight}`;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Régua de uma pergunta só: o navegador HONRA constraint `ideal` de resolução?
 *
 * **Não mede "se o aparelho é bom o bastante".** O app funciona em qualquer
 * resolução — `capturarFrame` usa o `videoWidth`/`videoHeight` que vier, e
 * `aceitaDegradar` tenta de novo sem constraint quando a câmera recusa o
 * tamanho. Frame pequeno dá foto mais mole, não falha.
 *
 * O que está em jogo é a premissa da decisão D1 do spec: a câmera própria (e a
 * exceção de `<video>` que ela cobra) se justifica só porque permite PEDIR
 * resolução, coisa que o `CameraView` do expo-camera não permite. Se o
 * navegador ignora o pedido e entrega 640×480 de qualquer jeito, a justificativa
 * cai e o certo é voltar para o `CameraView`.
 *
 * Por isso a tela compara PEDIDO contra ENTREGUE, em vez de julgar o número
 * contra um limiar. Um aparelho real responde sim ou não; não é parâmetro por
 * celular.
 *
 * Temporária — sai assim que a resposta estiver anotada no plano.
 *
 * **Fora do grupo `(app)`, de propósito.** Lá dentro a rota exigiria sessão e
 * onboarding completo (o `(app)` é guardado, e o auth do app passa por um proxy
 * no servidor Fastify), e isto não depende de dado de usuário nenhum. Quem for
 * abrir no celular não devia ter que fazer login primeiro.
 */
export default function DebugCameraScreen() {
  const camera = useRef<CameraLiveHandle>(null);
  const [frame, setFrame] = useState<Tamanho | null>(null);
  const [erro, setErro] = useState<CameraErro | null>(null);
  // A câmera ao vivo sai de cena durante a comparação: no iPhone, abrir um
  // segundo stream da mesma câmera silencia o primeiro.
  const [comparacao, setComparacao] = useState<{ nome: string; entregue: string }[] | null>(null);

  const pedidoCurto = Math.min(RESOLUCAO_ALVO.width, RESOLUCAO_ALVO.height);
  const entregueCurto = frame ? Math.min(frame.width, frame.height) : 0;
  // "Honrou" com folga: alguns sensores devolvem um degrau próximo (1082, 1056)
  // em vez do número exato, e isso é honrar o pedido, não ignorá-lo. O que
  // refuta a premissa é cair para um degrau MUITO abaixo — 640×480 é o default
  // do `video: true`, e é esse o caso que interessa detectar.
  const honrou = entregueCurto >= pedidoCurto * 0.9;
  // Largura que sobra para o card depois do recorte 9:16. É ela que decide o
  // upscale: o lado curto sozinho dizia "sem upscale" para um frame em paisagem.
  const larguraUtil = frame ? Math.min(frame.width, (frame.height * 9) / 16) : 0;

  async function comparar() {
    setFrame(null);
    setComparacao([]);
    for (const { nome, video } of PEDIDOS) {
      const entregue = await medirPedido(video).catch((err: Error) => `falhou: ${err.name}`);
      setComparacao((atual) => [...(atual ?? []), { nome, entregue }]);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 px-4">
      <Text className="py-3 text-xl font-display-bold text-neutral-800">
        O navegador honra o pedido?
      </Text>

      <ScrollView className="flex-1">
        {erro ? (
          <Text className="font-sans-medium text-danger-500">{`Falhou: ${erro}`}</Text>
        ) : comparacao ? null : (
          // Largura fixa, não a da tela: em 9:16 a largura cheia dá ~690pt de
          // altura e empurra o resultado para fora do celular. A resolução
          // medida vem do stream, então o tamanho do preview não a afeta.
          <View style={{ width: PREVIEW_WIDTH, alignSelf: "center" }}>
            <CameraLive
              ref={camera}
              aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
              onCapture={(_uri, tamanho) => setFrame(tamanho)}
              onError={setErro}
            />
          </View>
        )}

        {frame ? (
          <View className="mt-4 rounded-2xl bg-white p-4">
            <Text style={NUM} className="font-sans text-neutral-500">
              {`alvo     ${RESOLUCAO_ALVO.width}×${RESOLUCAO_ALVO.height}`}
            </Text>
            <Text style={NUM} className="mt-1 text-2xl font-display-bold text-neutral-800">
              {`entregue ${frame.width}×${frame.height}`}
            </Text>
            <Text
              className={[
                "mt-3 font-sans-semibold",
                honrou ? "text-success-500" : "text-danger-500",
              ].join(" ")}
            >
              {honrou ? "Honrou o pedido — D1 de pé." : "Ignorou o pedido — D1 cai."}
            </Text>
            <Text className="mt-2 font-sans text-sm text-neutral-600">
              {honrou
                ? "A câmera própria entrega o que o CameraView não entregaria."
                : "Se é isto em todo navegador, a câmera própria e a exceção de tag HTML não se pagam: volte ao CameraView."}
            </Text>
            {/* O número em si é informação secundária: o app funciona nele de
              qualquer jeito, só com foto mais mole. */}
            <Text style={NUM} className="mt-3 font-sans text-xs text-neutral-400">
              {larguraUtil >= 1080
                ? "Export 1080×1920 sem upscale."
                : `Export 1080×1920 com upscale de ${(1080 / larguraUtil).toFixed(2)}× — funciona, só mais mole.`}
            </Text>
          </View>
        ) : null}
        {comparacao ? (
          <View className="rounded-2xl bg-white p-4">
            {comparacao.map(({ nome, entregue }) => (
              <Text key={nome} style={NUM} className="py-1 font-sans text-base text-neutral-800">
                {`${nome} → ${entregue}`}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={comparar}
        accessibilityRole="button"
        accessibilityLabel="Comparar pedidos de resolução"
        className="mt-3 min-h-[56px] items-center justify-center rounded-full bg-white active:opacity-70"
      >
        <Text className="text-base font-sans-bold text-neutral-800">Comparar pedidos</Text>
      </Pressable>

      <Pressable
        onPress={() => camera.current?.capturar()}
        accessibilityRole="button"
        accessibilityLabel="Capturar um frame e comparar com o pedido"
        className="mb-4 mt-2 min-h-[56px] items-center justify-center rounded-full bg-primary-400 active:bg-primary-500"
      >
        <Text className="text-base font-sans-bold text-white">Medir</Text>
      </Pressable>
    </SafeAreaView>
  );
}
