import type { Tamanho } from "./crop";

/**
 * Congela o frame atual do vídeo num blob URL.
 *
 * `toBlob` e não `toDataURL`: o `toDataURL` é síncrono e codifica na thread
 * principal — é exatamente o custo que travou o carrossel de presets na feature
 * anterior (medido: 21 travadas somando 3803ms com a pré-captura, 6 somando
 * 843ms sem). O `captureImage` do expo-camera usa `toDataURL`, e sai PNG por
 * padrão; este caminho não.
 *
 * O `tamanho` devolvido é o do FRAME (`videoWidth`/`videoHeight`), não o do
 * elemento na tela. É ele que vira o `fotoNatural` do card, e o `Enquadramento`
 * normalizado depende dessa medida para o recorte bater nos três tamanhos
 * (preview, palco de captura e imagem final).
 */
export async function capturarFrame(
  video: HTMLVideoElement,
): Promise<{ uri: string; tamanho: Tamanho }> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  // Sem isso o canvas sai 0×0 e o blob é uma imagem vazia — que falha depois,
  // longe daqui, como "foto que não aparece".
  if (!width || !height) throw new Error("frame_sem_dados");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // `alpha: false`: frame de câmera é opaco, e o contexto sem alpha compõe mais
  // rápido.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas_sem_contexto");

  ctx.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
  if (!blob) throw new Error("frame_to_blob_failed");

  return { uri: URL.createObjectURL(blob), tamanho: { width, height } };
}
