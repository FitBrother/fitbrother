import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import {
  aceitaDegradar,
  CONSTRAINTS_MINIMAS,
  constraintsDeCamera,
  erroDeCamera,
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

      let s: MediaStream;
      try {
        s = await pedir(constraintsDeCamera());
      } catch (err) {
        if (!aceitaDegradar(err)) {
          onError(erroDeCamera(err));
          return;
        }
        try {
          s = await pedir(CONSTRAINTS_MINIMAS);
        } catch (err2) {
          onError(erroDeCamera(err2));
          return;
        }
      }

      // Desmontou no meio do await: o stream já foi aberto e ninguém mais vai
      // fechá-lo pelo cleanup, então fecha aqui.
      if (!vivo) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }

      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        // `play()` explícito: `autoPlay` sozinho não basta no Safari quando o
        // elemento recebe o srcObject depois de montar.
        video.current.play().catch(() => {});
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
