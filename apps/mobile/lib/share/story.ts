import { ZOOM_MAXIMO, type Tamanho } from "@/lib/media/crop";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "./geometry";

/**
 * O modelo do editor de story — puro, sem React e sem DOM.
 *
 * **Sticker guarda a diferença, não a posição.** O card continua sendo um layout
 * em fluxo, e cada elemento só sabe o quanto saiu do lugar natural. Com isso o
 * layout de cada preset segue no flexbox (legenda de duas ou três linhas empurra
 * o resto sozinha) e nada precisa ser medido para desenhar. A medida (`Caixa`)
 * só entra para saber onde o dedo caiu e para prender o logo no quadro.
 *
 * Remover mantém o sticker no fluxo, invisível: sem isso, tirar a legenda faria
 * os outros pularem de lugar. O html2canvas não desenha `opacity: 0` (medido).
 *
 * As unidades são dp do card de 360×640, o mesmo sistema do nó de captura. O
 * preview encolhe por fora, então o estado vale para qualquer tela.
 *
 * Quem roda dentro de gesto tem `"worklet"`: no nativo o callback do gesto só
 * chama função marcada.
 */

export type StickerId =
  | "logo"
  | "data"
  | "itens"
  | "calorias"
  | "macros"
  | "placa"
  | "nota"
  | "titulo"
  | "resumo"
  | "topicos";

export type Sticker = {
  id: StickerId;
  /** Deslocamento em relação à posição natural, em dp do card. */
  dx: number;
  dy: number;
  /** Relativa ao tamanho natural. */
  scale: number;
  /** Em radianos. */
  rotation: number;
  z: number;
  removido: boolean;
};

/** A foto em relação ao quadro. `scale` 1 é exatamente o `cover`. */
export type FotoLivre = { x: number; y: number; scale: number; rotation: number };

/** Onde o sticker fica no card antes de qualquer transform. */
export type Caixa = { x: number; y: number; width: number; height: number };

export type Ponto = { x: number; y: number };

export type StoryPresetId = "completo" | "etiqueta" | "discreto" | "poster";

/** O que o conteúdo tem para mostrar. Decide quais stickers existem. */
export type ConteudoStory = {
  kind: "meal" | "insight";
  temLegenda: boolean;
  temMacros: boolean;
  temNota: boolean;
};

/** Um passo de gesto: deslocamento, fator de escala e giro desde o último evento. */
export type PassoDeGesto = { dx: number; dy: number; k: number; rot: number };

export const FOTO_PADRAO: FotoLivre = { x: 0, y: 0, scale: 1, rotation: 0 };

/** Abaixo disso a foto vira um selo, e não dá mais para pinçar com dois dedos. */
export const FOTO_ESCALA_MIN = 0.25;

export const STICKER_ESCALA_MIN = 0.4;
export const STICKER_ESCALA_MAX = 4;

/** O logo pode encolher, mas não até virar um risco ilegível. */
export const LOGO_ESCALA_MIN = 0.8;

/** Sempre a camada de cima: nenhum sticker pode cobrir o logo. */
export const Z_LOGO = 1000;

/** Meia área de toque mínima, em dp do card: 44×44, a regra do resto do app. */
const MEIA_AREA_MINIMA = 22;

function limitar(v: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(v, min), max);
}

/** Os stickers de um preset, na ordem do fluxo. O logo fecha a coluna. */
export function stickersDoPreset(preset: StoryPresetId, c: ConteudoStory): StickerId[] {
  if (c.kind === "insight") {
    return [
      "data",
      ...(c.temNota ? (["nota"] as const) : []),
      "titulo",
      "resumo",
      // No pôster o placar toma o quadro e os tópicos não cabem.
      ...(preset === "poster" ? [] : (["topicos"] as const)),
      "logo",
    ];
  }
  if (preset === "etiqueta") return ["placa", "logo"];
  const macros = c.temMacros ? (["macros"] as const) : [];
  if (preset === "discreto") return ["calorias", ...macros, "logo"];
  return ["data", ...(c.temLegenda ? (["itens"] as const) : []), "calorias", ...macros, "logo"];
}

export function arranjoInicial(ids: StickerId[]): Sticker[] {
  return ids.map((id, i) => ({
    id,
    dx: 0,
    dy: 0,
    scale: 1,
    rotation: 0,
    z: id === "logo" ? Z_LOGO : i + 1,
    removido: false,
  }));
}

export function moverSticker(s: Sticker, d: PassoDeGesto): Sticker {
  "worklet";
  return {
    ...s,
    dx: s.dx + d.dx,
    dy: s.dy + d.dy,
    scale: limitar(s.scale * d.k, STICKER_ESCALA_MIN, STICKER_ESCALA_MAX),
    rotation: s.rotation + d.rot,
  };
}

/** Mantém o centro dentro do quadro, para o sticker não sumir de vez. */
export function prenderSticker(s: Sticker, caixa: Caixa): Sticker {
  "worklet";
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  return {
    ...s,
    dx: limitar(s.dx, -cx, SHARE_CARD_WIDTH - cx),
    dy: limitar(s.dy, -cy, SHARE_CARD_HEIGHT - cy),
  };
}

/**
 * Garante que o logo aparece inteiro.
 *
 * O limite é o retângulo GIRADO: prender só o centro deixaria uma ponta para
 * fora do quadro, e encolher sem mínimo deixaria o logo sumir sem ser removido.
 */
export function prenderLogo(s: Sticker, caixa: Caixa): Sticker {
  "worklet";
  const cos = Math.abs(Math.cos(s.rotation));
  const sen = Math.abs(Math.sin(s.rotation));
  const larguraGirada = caixa.width * cos + caixa.height * sen;
  const alturaGirada = caixa.width * sen + caixa.height * cos;

  const teto = Math.min(SHARE_CARD_WIDTH / larguraGirada, SHARE_CARD_HEIGHT / alturaGirada);
  const scale = Math.min(Math.max(s.scale, LOGO_ESCALA_MIN), teto);
  const meiaL = (larguraGirada * scale) / 2;
  const meiaA = (alturaGirada * scale) / 2;

  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  return {
    ...s,
    scale,
    dx: limitar(cx + s.dx, meiaL, SHARE_CARD_WIDTH - meiaL) - cx,
    dy: limitar(cy + s.dy, meiaA, SHARE_CARD_HEIGHT - meiaA) - cy,
  };
}

export function moverFoto(f: FotoLivre, d: PassoDeGesto): FotoLivre {
  "worklet";
  return {
    x: limitar(f.x + d.dx, -SHARE_CARD_WIDTH / 2, SHARE_CARD_WIDTH / 2),
    y: limitar(f.y + d.dy, -SHARE_CARD_HEIGHT / 2, SHARE_CARD_HEIGHT / 2),
    scale: limitar(f.scale * d.k, FOTO_ESCALA_MIN, ZOOM_MAXIMO),
    rotation: f.rotation + d.rot,
  };
}

/** O sticker sob o ponto, de cima para baixo. `null` significa a foto. */
export function alvoDoToque(
  p: Ponto,
  stickers: Sticker[],
  caixas: Partial<Record<StickerId, Caixa>>,
): StickerId | null {
  "worklet";
  let alvo: StickerId | null = null;
  let zAlvo = -Infinity;

  for (const s of stickers) {
    const caixa = caixas[s.id];
    if (s.removido || !caixa || s.z <= zAlvo) continue;

    // Leva o ponto para o espaço do sticker, onde ele volta a ser um retângulo.
    const px = p.x - (caixa.x + caixa.width / 2 + s.dx);
    const py = p.y - (caixa.y + caixa.height / 2 + s.dy);
    const cos = Math.cos(-s.rotation);
    const sen = Math.sin(-s.rotation);
    const x = px * cos - py * sen;
    const y = px * sen + py * cos;

    const meiaL = Math.max((caixa.width * s.scale) / 2, MEIA_AREA_MINIMA);
    const meiaA = Math.max((caixa.height * s.scale) / 2, MEIA_AREA_MINIMA);
    if (Math.abs(x) <= meiaL && Math.abs(y) <= meiaA) {
      alvo = s.id;
      zAlvo = s.z;
    }
  }
  return alvo;
}

/** Sobe o sticker tocado para cima dos outros, sempre abaixo do logo. */
export function trazerParaFrente(stickers: Sticker[], id: StickerId): Sticker[] {
  "worklet";
  if (id === "logo") return stickers;
  let topo = 0;
  for (const s of stickers) if (s.id !== "logo" && s.id !== id) topo = Math.max(topo, s.z);
  const z = Math.min(topo + 1, Z_LOGO - 1);
  return stickers.map((s) => (s.id === id ? { ...s, z } : s));
}

/**
 * Os estilos abaixo são a fórmula única do quadro: o editor os aplica por
 * shared value, e o nó de captura por estado. Assim o PNG sai igual ao editor.
 */
export function estiloSticker(s: Sticker) {
  "worklet";
  return {
    zIndex: s.z,
    opacity: s.removido ? 0 : 1,
    transform: [
      { translateX: s.dx },
      { translateY: s.dy },
      { rotate: `${s.rotation}rad` },
      { scale: s.scale },
    ],
  };
}

export function estiloFoto(f: FotoLivre, natural: Tamanho, quadro: Tamanho) {
  "worklet";
  // A mesma conta de `escalaCover`, escrita aqui porque aquela não é worklet.
  const cover =
    natural.width > 0 && natural.height > 0
      ? Math.max(quadro.width / natural.width, quadro.height / natural.height)
      : 1;
  return {
    transform: [
      { translateX: f.x },
      { translateY: f.y },
      { rotate: `${f.rotation}rad` },
      { scale: cover * f.scale },
    ],
  };
}

/** Maior quadro com a proporção pedida que cabe na área. */
export function tamanhoDoQuadro(area: Tamanho, aspect: number): Tamanho {
  const width = Math.floor(Math.min(area.width, area.height * aspect));
  return { width, height: Math.floor(width / aspect) };
}

/** Fator de zoom de um evento de roda do mouse. */
export function zoomDaRoda(deltaY: number): number {
  return Math.exp(-deltaY * 0.002);
}

/**
 * Se a foto deste export vai para a refeição.
 *
 * Só a primeira, e só em refeição sem foto: o path do storage é fixo, então
 * subir sobre uma foto salva apagaria a original para sempre. `temFotoSalva`
 * vem de `meals.image_path`, não da foto ter carregado — uma falha de leitura
 * não pode virar sobrescrita.
 */
export function deveSalvarFoto(a: {
  type: string;
  fotoLocal: string | null;
  temFotoSalva: boolean;
  jaSalvou: boolean;
}): boolean {
  return a.type === "meal" && Boolean(a.fotoLocal) && !a.temFotoSalva && !a.jaSalvou;
}
