import { colors } from "@/lib/colors";
import type { StoryPresetId } from "./story";

export type StoryPreset = {
  id: StoryPresetId;
  /** Nome mostrado acima da fila de presets. */
  label: string;
  /** Cor do texto principal. */
  text: string;
  /** Texto secundário: data, unidade, nomes dos macros. */
  textDim: string;
  /** Número de calorias e detalhes de destaque. */
  accent: string;
  /** Trilho atrás da barra de macros. */
  track: string;
  /**
   * Quanto do quadro a informação ocupa.
   * `full` — legenda, número grande, barra e legenda dos macros.
   * `chip` — só os números, numa placa compacta; a foto fica limpa.
   * `line` — uma linha de texto e a barra virando fio.
   */
  info: "full" | "chip" | "line";
  /** Se a vinheta preta vem ligada. A pessoa pode trocar no editor. */
  vinheta: boolean;
};

/**
 * Os arranjos iniciais do story.
 *
 * Preset não é mais cor: sem os gradientes coloridos, Claro, Menta e Noturno
 * seriam o mesmo card. O que muda agora é quais elementos entram e como ficam
 * dispostos, e daí para frente a pessoa move tudo à mão.
 */
export const STORY_PRESETS = [
  {
    id: "completo",
    label: "Completo",
    text: colors.white,
    textDim: colors.neutral[400],
    accent: colors.primary[400],
    track: colors.neutral[800],
    info: "full",
    vinheta: true,
  },
  {
    id: "etiqueta",
    label: "Etiqueta",
    // As cores são as da placa, que carrega o próprio contraste. É por isso que
    // a vinheta vem desligada.
    text: colors.ink,
    textDim: colors.neutral[500],
    accent: colors.primary[600],
    track: colors.neutral[200],
    info: "chip",
    vinheta: false,
  },
  {
    id: "discreto",
    label: "Discreto",
    text: colors.white,
    textDim: colors.neutral[300],
    accent: colors.white,
    track: colors.neutral[800],
    info: "line",
    vinheta: true,
  },
  {
    id: "poster",
    label: "Pôster",
    text: colors.white,
    textDim: colors.neutral[400],
    accent: colors.primary[400],
    track: colors.neutral[800],
    info: "full",
    vinheta: true,
  },
] as const satisfies readonly StoryPreset[];

/**
 * Os presets que fazem sentido para este conteúdo.
 *
 * Etiqueta e Discreto anotam macros sobre a foto: sem um dos dois, viram uma
 * plaquinha com `0g 0g 0g` ou uma anotação solta num fundo liso. Pôster existe
 * para quando não há foto, e aí vem primeiro.
 */
export function presetsDoStory({
  temFoto,
  temMacros,
}: {
  temFoto: boolean;
  temMacros: boolean;
}): readonly StoryPreset[] {
  const ids: StoryPresetId[] = !temFoto
    ? ["poster", "completo"]
    : temMacros
      ? ["completo", "etiqueta", "discreto"]
      : ["completo"];
  return ids.map(presetPorId);
}

export function presetPorId(id: StoryPresetId): StoryPreset {
  // `!`: o tipo do id garante que ele está na lista.
  return STORY_PRESETS.find((p) => p.id === id)!;
}
