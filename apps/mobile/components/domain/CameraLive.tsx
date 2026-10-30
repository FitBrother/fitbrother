import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import type { Ref } from "react";
import type { CameraErro } from "@/lib/media/camera-constraints";
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
 * Preview ao vivo da câmera, no nativo.
 *
 * Aqui o `CameraView` do expo-camera serve: no nativo o módulo controla a
 * resolução de verdade (`takePictureAsync` entrega o sensor, não um frame de
 * vídeo), e já está provado no `BarcodeScanner`. O caminho web precisa de
 * implementação própria por outro motivo — ver `CameraLive.web.tsx`.
 *
 * `skipProcessing: true` e `shutterSound: false`: a foto vira o fundo de um
 * card de story, não um arquivo da galeria. O processamento extra só adiciona
 * latência ao toque, e o som de obturador é estranho num fluxo que a pessoa
 * entende como "ajustar imagem".
 */
export function CameraLive({ aspect, ref, onReady, onCapture, onError }: CameraLiveProps) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [pronta, setPronta] = useState(false);
  const pediu = useRef(false);

  // Em efeito, e não no corpo do render: `onError` é setState do pai, e
  // chamá-lo enquanto este componente renderiza atualiza um componente no meio
  // do render de outro. O guard de `pediu` é o que mantém isto em UMA vez — o
  // pai re-renderiza a cada troca de preset, e sem ele o diálogo de permissão
  // voltaria a cada arrasto.
  useEffect(() => {
    if (!permissao || permissao.granted || pediu.current) return;
    pediu.current = true;

    if (!permissao.canAskAgain) {
      onError("negada");
      return;
    }
    pedirPermissao().then((r) => {
      if (!r.granted) onError("negada");
    });
    // `onError` fica fora das deps de propósito: o pai costuma passar uma
    // função nova a cada render, e reexecutar aqui pediria permissão de novo.
    // Quem garante a uma-vez-só é o `pediu`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissao, pedirPermissao]);

  const capturar = useCallback(async () => {
    if (!camera.current || !pronta) return;
    const foto = await camera.current.takePictureAsync({
      skipProcessing: true,
      shutterSound: false,
    });
    if (!foto?.uri || !foto.width || !foto.height) throw new Error("frame_sem_dados");
    onCapture(foto.uri, { width: foto.width, height: foto.height });
  }, [pronta, onCapture]);

  useImperativeHandle(ref, () => ({ capturar }), [capturar]);

  return (
    <View style={{ width: "100%", aspectRatio: aspect }} className="overflow-hidden bg-neutral-900">
      {permissao?.granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={() => {
            setPronta(true);
            onReady?.();
          }}
          onMountError={() => onError("indisponivel")}
        />
      ) : null}
    </View>
  );
}
