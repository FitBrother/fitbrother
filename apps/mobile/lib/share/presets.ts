import { colors } from "@/lib/colors";

/**
 * Converte um token hexadecimal em `rgba()` com a opacidade pedida.
 *
 * Existe por causa dos scrims: um degradê de `"transparent"` até uma cor opaca
 * passa por cinza no meio (o `transparent` do CSS é preto com alpha 0, e a
 * interpolação acontece em RGB não-premultiplicado). Partindo da MESMA cor com
 * alpha 0, o degradê só muda de opacidade e o meio fica limpo.
 */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type SharePresetId =
  | "noturno"
  | "claro"
  | "etiqueta"
  | "discreto"
  | "moldura"
  | "menta"
  | "poster";

export type SharePreset = {
  id: SharePresetId;
  /** Nome mostrado no seletor, abaixo do card. */
  label: string;
  /** Duas paradas do degradê de fundo. Iguais = chapa. */
  background: readonly [string, string];
  /** Cor do texto principal. */
  text: string;
  /** Texto secundário: data, unidade, nomes dos macros, endereço. */
  textDim: string;
  /** Número de calorias e detalhes de destaque. */
  accent: string;
  /** Trilho atrás da barra de macros. */
  track: string;
  /**
   * Como a foto entra no quadro.
   * `fill` — preenche o quadro inteiro.
   * `frame` — recortada com margem e raio, como uma polaroide.
   * `none` — o preset ignora a foto e vira um pôster tipográfico.
   */
  photo: "fill" | "frame" | "none";
  /**
   * Quanto do quadro a informação ocupa.
   * `full` — legenda, número grande, barra e legenda dos macros.
   * `chip` — só os números, numa etiqueta compacta; a foto fica limpa.
   * `line` — uma linha de texto e a barra virando fio no rodapé.
   *
   * `chip` e `line` são os modos minimalistas: existem para quem quer postar a
   * FOTO, com o dado entrando como anotação e não como cartaz. Só fazem sentido
   * com foto — sem ela sobraria a anotação sozinha num fundo liso.
   */
  info: "full" | "chip" | "line";
  /** Variante do lockup da marca. */
  logo: "white" | "menta";
};

/**
 * Os presets que o usuário folheia na tela de compartilhar.
 *
 * Não são variações de cor do mesmo card: cada um muda o que domina o quadro —
 * a foto inteira, a foto emoldurada, a marca ou o número.
 *
 * Nenhum tem cabeçalho de autor. O destino normal destes cards é o story, que
 * já desenha por cima quem está postando; repetir avatar e @ ali era dizer duas
 * vezes a mesma coisa, ocupando justamente a faixa que o Instagram cobre.
 */
export const SHARE_PRESETS = [
  {
    id: "noturno",
    label: "Noturno",
    background: [colors.ink, colors.primary[900]],
    text: colors.white,
    textDim: colors.neutral[400],
    accent: colors.primary[400],
    track: colors.neutral[800],
    photo: "fill",
    info: "full",
    logo: "white",
  },
  {
    id: "claro",
    label: "Claro",
    background: [colors.white, colors.primary[50]],
    text: colors.ink,
    textDim: colors.neutral[500],
    // `primary-600`, não `primary-400`: a menta clara da marca tem contraste
    // baixo demais sobre branco para carregar o número principal.
    accent: colors.primary[600],
    track: colors.neutral[200],
    photo: "fill",
    info: "full",
    logo: "menta",
  },
  {
    id: "etiqueta",
    label: "Etiqueta",
    // O fundo quase não aparece: a foto é quem preenche o quadro, sem scrim.
    // Estas cores são as da etiqueta — branca, com texto tinta.
    background: [colors.white, colors.white],
    text: colors.ink,
    textDim: colors.neutral[500],
    accent: colors.primary[600],
    track: colors.neutral[200],
    photo: "fill",
    info: "chip",
    logo: "menta",
  },
  {
    id: "discreto",
    label: "Discreto",
    background: [colors.ink, colors.ink],
    text: colors.white,
    textDim: colors.neutral[300],
    accent: colors.white,
    track: colors.neutral[800],
    photo: "fill",
    info: "line",
    logo: "white",
  },
  {
    id: "moldura",
    label: "Moldura",
    background: [colors.neutral[50], colors.white],
    text: colors.ink,
    textDim: colors.neutral[500],
    accent: colors.primary[600],
    track: colors.neutral[200],
    photo: "frame",
    info: "full",
    logo: "menta",
  },
  {
    id: "menta",
    label: "Menta",
    // Mais distância entre as paradas que o 600→400 antigo, que de tão
    // próximo lia como chapa lisa em vez de degradê.
    background: [colors.primary[400], colors.primary[700]],
    text: colors.white,
    textDim: colors.primary[100],
    accent: colors.white,
    // Trilho bem mais escuro que o fundo: é ele que separa as três cores dos
    // macros do verde por baixo.
    track: colors.primary[900],
    photo: "fill",
    info: "full",
    logo: "white",
  },
  {
    id: "poster",
    label: "Pôster",
    // Chapa, sem degradê: o contraste do pôster vem do tamanho do número.
    background: [colors.ink, colors.ink],
    text: colors.white,
    textDim: colors.neutral[400],
    accent: colors.primary[400],
    track: colors.neutral[800],
    photo: "none",
    info: "full",
    logo: "white",
  },
] as const satisfies readonly SharePreset[];

/**
 * Os presets que fazem sentido para este conteúdo.
 *
 * Um preset que degenera não deve aparecer. Sem foto, "Moldura" desenha
 * exatamente o mesmo card que "Claro" — ela só existe para ter o que emoldurar
 * — e os minimalistas viram uma anotação solta num fundo liso, que é o oposto
 * do que eles são. Um carrossel mostrando a mesma coisa duas vezes é um preset
 * a menos, e parece defeito.
 */
export function presetsFor({
  temFoto,
  temMacros,
}: {
  temFoto: boolean;
  temMacros: boolean;
}): readonly SharePreset[] {
  return SHARE_PRESETS.filter((p) => {
    if (p.photo === "frame" && !temFoto) return false;
    // Os minimalistas são sobre a foto, e anotam macros: sem um dos dois, não
    // têm o que fazer.
    if (p.info !== "full" && !(temFoto && temMacros)) return false;
    return true;
  });
}

export const DEFAULT_PRESET_INDEX = 0;

/** Preset na posição pedida, presa ao intervalo da lista. Nunca devolve vazio. */
export function presetAt(lista: readonly SharePreset[], index: number): SharePreset {
  const preso = Math.min(Math.max(index, 0), lista.length - 1);
  return lista[preso] ?? SHARE_PRESETS[DEFAULT_PRESET_INDEX];
}

/**
 * Corta o texto em `max` caracteres, terminando numa palavra inteira.
 *
 * A captura não pode confiar só no `numberOfLines`: o `react-native-web` o
 * implementa com `-webkit-line-clamp`, que o html2canvas não interpreta — no
 * PNG o texto sairia inteiro e estouraria o quadro. Cortar na origem garante o
 * mesmo resultado nas duas plataformas.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const corte = text.slice(0, max);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`;
}
