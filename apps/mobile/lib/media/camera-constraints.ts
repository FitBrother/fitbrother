/**
 * O que pedir ao `getUserMedia`, e o que fazer quando ele diz não.
 *
 * Puro de propósito: sem DOM, sem React. É aqui que mora a razão de a web ter
 * câmera própria em vez de usar o `CameraView` do expo-camera — ele nunca passa
 * largura/altura (`useWebCameraStream` → `getIdealConstraints(type, undefined,
 * undefined)` → `MinimumConstraints = { audio: false, video: true }`), e
 * `video: true` sem constraint é 640×480 no Safari e no Chrome Android.
 */

import type { Tamanho } from "./crop";

export type CameraErro = "indisponivel" | "negada" | "sem_camera";

/**
 * O frame que se quer: retrato.
 *
 * O card exporta 1080×1920 (`SHARE_CARD_WIDTH 360 × SHARE_EXPORT_SCALE 3`). Um
 * frame em paisagem deixaria ~608px de largura no recorte 9:16 — upscale de
 * 1,78× no export.
 */
export const RESOLUCAO_ALVO = { width: 1080, height: 1920 } as const;

/**
 * O primeiro pedido: paisagem, para receber retrato.
 *
 * Medido num iPhone em pé, no Safari e no Vivaldi: pedir 1920×1080 entrega
 * 1080×1920, e pedir 1080×1920 entrega 1920×1080. O pedido sai invertido. Quem
 * não inverte (o Android não foi medido) é coberto por `frameDeitado`, que faz
 * o `CameraLive` reabrir com `RESOLUCAO_ALVO`.
 */
export const PEDIDO_INICIAL = {
  width: RESOLUCAO_ALVO.height,
  height: RESOLUCAO_ALVO.width,
} as const;

/** O pedido normal: traseira, no tamanho pedido. */
export function constraintsDeCamera(alvo: Tamanho = PEDIDO_INICIAL): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      // `ideal`, não `exact`: em desktop sem traseira o `exact` rejeita o
      // stream inteiro, e aí nem a webcam de testes funciona.
      facingMode: { ideal: "environment" },
      width: { ideal: alvo.width },
      height: { ideal: alvo.height },
    },
  };
}

/**
 * O pedido de segunda tentativa, sem resolução.
 *
 * Mesma degradação que o `getAnyUserMediaAsync` do expo-camera faz: quando a
 * câmera não consegue satisfazer o tamanho, é melhor um stream pequeno que
 * nenhum.
 */
export const CONSTRAINTS_MINIMAS: MediaStreamConstraints = { audio: false, video: true };

/**
 * Se o frame veio na orientação contrária à da tela em pé.
 *
 * Tela deitada fica de fora: webcam de desktop e celular virado entregam
 * paisagem de propósito, e reabrir só faria a câmera piscar.
 */
export function frameDeitado(frame: Tamanho, tela: Tamanho): boolean {
  return tela.height > tela.width && frame.width > frame.height;
}

/**
 * O `name` da rejeição, lido estruturalmente.
 *
 * **Não** `err instanceof Error`. O `getUserMedia` rejeita com `DOMException`, e
 * `instanceof` falha entre realms: medido no ambiente de teste, a cadeia de
 * protótipos de um `DOMException` é `DOMException → Error → Object` e ainda
 * assim `instanceof Error` devolve `false`, porque o `Error` do realm do jsdom
 * não é o mesmo objeto que este módulo referencia. Iframe, worker e polyfill
 * quebram igual.
 *
 * Com `instanceof`, todo erro de câmera cairia em "indisponivel": permissão
 * negada nunca seria distinguida e a segunda tentativa nunca aconteceria.
 */
function nomeDoErro(err: unknown): string {
  if (typeof err !== "object" || err === null) return "";
  const nome = (err as { name?: unknown }).name;
  return typeof nome === "string" ? nome : "";
}

/** Traduz a rejeição do `getUserMedia` no motivo que a UI mostra. */
export function erroDeCamera(err: unknown): CameraErro {
  switch (nomeDoErro(err)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "negada";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "sem_camera";
    default:
      return "indisponivel";
  }
}

/**
 * Se vale tentar de novo com `CONSTRAINTS_MINIMAS`.
 *
 * Só quando a câmera recusou o TAMANHO. Repetir depois de permissão negada
 * mostraria o diálogo duas vezes para receber o mesmo "não".
 */
export function aceitaDegradar(err: unknown): boolean {
  const nome = nomeDoErro(err);
  return nome === "OverconstrainedError" || nome === "ConstraintNotSatisfiedError";
}
