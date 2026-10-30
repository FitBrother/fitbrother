import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import {
  aceitaDegradar,
  CONSTRAINTS_MINIMAS,
  constraintsDeCamera,
  erroDeCamera,
  frameDeitado,
  PEDIDO_INICIAL,
  RESOLUCAO_ALVO,
  type CameraErro,
} from "@/lib/media/camera-constraints";
import { capturarFrame } from "@/lib/media/frame-capture.web";

import type { Ref } from "react";
import type { Tamanho } from "@/lib/media/crop";

export type CameraLiveHandle = {
  /** Congela o frame atual e chama `onCapture`. */
  capturar: () => Promise<void>;
};

export type CameraLiveProps = {
  /** Proporção do quadro visível. O card de story é 360/640. */
  aspect: number;
  ref?: Ref<CameraLiveHandle>;
  onReady?: () => void;
  onCapture: (uri: string, tamanho: Tamanho) => void;
  onError: (motivo: CameraErro) => void;
};

/** Quanto esperar pelo primeiro frame antes de seguir sem ele. */
const ESPERA_FRAME_MS = 500;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pede o stream e, se a câmera recusar o tamanho, aceita o que ela tiver. */
async function abrirStream(
  pedir: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  try {
    return await pedir(constraints);
  } catch (err) {
    if (!aceitaDegradar(err)) throw err;
    return pedir(CONSTRAINTS_MINIMAS);
  }
}

/**
 * Preview ao vivo da câmera, na web.
 *
 * **Não usa o `CameraView` do expo-camera** — ver `lib/media/camera-constraints.ts`
 * para a medida que justifica isso, e `lib/no-html-tags.test.ts` para a exceção
 * de `<video>` que isto cobra.
 *
 * O vídeo preenche o quadro com `object-fit: cover`, então o que a pessoa vê é
 * o recorte central do frame. O frame guardado é o INTEIRO (ver
 * `capturarFrame`): o recorte continua sendo decisão do `Enquadramento`, por
 * uso, e não algo gravado na captura.
 */
export function CameraLive({ aspect, ref, onReady, onCapture, onError }: CameraLiveProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;

    async function abrir() {
      const pedir = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      // Contexto não seguro (http sem TLS) e webview restrita caem aqui: o
      // objeto simplesmente não existe.
      if (!pedir) {
        onError("indisponivel");
        return;
      }

      // Duas tentativas, não um laço aberto: se o pedido invertido também vier
      // deitado, foto mais mole é melhor que câmera piscando sem parar.
      for (const alvo of [PEDIDO_INICIAL, RESOLUCAO_ALVO]) {
        // Fecha antes de abrir: no iPhone, dois streams da mesma câmera
        // silenciam um ao outro.
        stream.current?.getTracks().forEach((t) => t.stop());

        let s: MediaStream;
        try {
          s = await abrirStream(pedir, constraintsDeCamera(alvo));
        } catch (err) {
          onError(erroDeCamera(err));
          return;
        }

        // Desmontou no meio do await: o stream já foi aberto e ninguém mais vai
        // fechá-lo pelo cleanup, então fecha aqui.
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }

        stream.current = s;
        const el = video.current;
        if (!el) break;
        el.srcObject = s;
        // `play()` explícito: `autoPlay` sozinho não basta no Safari quando o
        // elemento recebe o srcObject depois de montar. O tamanho do frame é
        // lido depois dele, na mesma ordem em que o iPhone foi medido.
        await Promise.race([el.play().catch(() => {}), esperar(ESPERA_FRAME_MS)]);
        if (!el.videoWidth) await esperar(ESPERA_FRAME_MS);
        if (!vivo) return;

        const frame = { width: el.videoWidth, height: el.videoHeight };
        if (!frameDeitado(frame, { width: window.innerWidth, height: window.innerHeight })) break;
      }

      setPronto(true);
      onReady?.();
    }

    abrir();

    return () => {
      vivo = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
    // Monta uma vez: reabrir a câmera a cada render do pai faria a imagem
    // piscar e pediria permissão de novo em alguns navegadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturar = useCallback(async () => {
    if (!video.current || !pronto) return;
    const { uri, tamanho } = await capturarFrame(video.current);
    onCapture(uri, tamanho);
  }, [pronto, onCapture]);

  useImperativeHandle(ref, () => ({ capturar }), [capturar]);

  return (
    <View style={{ width: "100%", aspectRatio: aspect }} className="overflow-hidden bg-neutral-900">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </View>
  );
}
