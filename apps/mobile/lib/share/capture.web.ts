import html2canvas from "html2canvas";
import type { RefObject } from "react";
import type { View } from "react-native";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, SHARE_EXPORT_SCALE } from "./geometry";

/**
 * Captura o card como PNG e devolve uma data URI.
 *
 * **Por que a web não usa `react-native-view-shot`:** a lib até tem uma
 * implementação web (`src/RNViewShot.web.js`, que é html2canvas), mas o wrapper
 * `captureRef` de `src/index.js` chama `findNodeHandle(view)` sem checar a
 * plataforma antes de delegar — e `findNodeHandle` lança
 * "not supported on web" no `react-native-web`. A implementação web da lib é
 * inalcançável: toda captura falhava antes de chegar nela, e os botões de
 * salvar/compartilhar só produziam toast de erro na versão web.
 *
 * Então chamamos o html2canvas direto, que é exatamente o que a lib faria.
 * Ele já vem como dependência dela; está declarado no nosso `package.json`
 * também para não depender do hoist da árvore de node_modules.
 *
 * Sob `react-native-web`, o `ref.current` de uma `View` é o próprio nó do DOM —
 * daí o cast.
 */
export async function captureCard(ref: RefObject<View | null>): Promise<string> {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) throw new Error("share_card_ref_missing");

  const canvas = await html2canvas(node, {
    scale: SHARE_EXPORT_SCALE,
    // `null` deixa o próprio card pintar o fundo. O quadro é opaco de ponta a
    // ponta (sem raio nos cantos), então não sobra transparência no PNG.
    backgroundColor: null,
    useCORS: true,
    logging: false,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  });

  // `toBlob`, e não `toDataURL`: os dois codificam os mesmos 2 megapixels, mas
  // `toDataURL` é síncrono e trava a thread principal o tempo todo da
  // codificação, enquanto `toBlob` devolve por callback e o navegador pode
  // codificar fora dela. Num profile com CPU estrangulada em 6× (celular
  // lento), `toDataURL` sozinho respondia por 574ms de thread bloqueada a cada
  // captura — o maior item isolado do perfil.
  //
  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error("canvas_to_blob_failed"));
      // Revoga a captura anterior: folheando os presets, cada uma deixaria os
      // bytes de um PNG de 1080×1920 presos na memória da aba.
      if (ultima) URL.revokeObjectURL(ultima.uri);
      const uri = URL.createObjectURL(b);
      ultima = { uri, blob: b };
      resolve(uri);
    }, "image/png");
  });
}

let ultima: { uri: string; blob: Blob } | null = null;

/**
 * O Blob por trás do uri da última captura, se for ele.
 *
 * Serve para o compartilhamento montar o `File` SEM await: `navigator.share()`
 * exige ser chamado dentro da janela de ativação do clique, e buscar o blob de
 * volta pelo uri introduziria um await bem no meio dela.
 */
export function blobCapturado(uri: string): Blob | null {
  return ultima && ultima.uri === uri ? ultima.blob : null;
}
