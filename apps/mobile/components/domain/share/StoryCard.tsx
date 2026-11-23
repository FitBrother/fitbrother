import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { macroEnergySplit } from "@/lib/social/post-format";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  STORY_SAFE_BOTTOM,
  STORY_SAFE_TOP,
} from "@/lib/share/geometry";
import {
  estiloFoto,
  estiloSticker,
  FOTO_PADRAO,
  type Caixa,
  type ConteudoStory,
  type FotoLivre,
  type Sticker,
  type StickerId,
} from "@/lib/share/story";
import { truncate, withAlpha, type StoryPreset } from "@/lib/share/story-presets";
import { ShareLogo } from "./ShareLogo";

import type { ComponentType, ReactNode } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import type { Tamanho } from "@/lib/media/crop";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/** Margem lateral. Tudo que é texto se alinha nesta coluna. */
const PAD = 26;

const PREENCHE = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;

export const QUADRO_STORY: Tamanho = { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT };

/**
 * Os macros na ordem fixa proteína → carboidrato → gordura, a mesma do resto do
 * app. Duplicada aqui em vez de importada do `MacroSplitBar` porque o card
 * desenha a barra com cores e tamanhos próprios do preset — o que é comum é a
 * ordem e a regra de divisão (`macroEnergySplit`), não o visual.
 */
const MACROS = [
  { key: "protein", label: "proteína", curto: "P", fill: colors.protein[500] },
  { key: "carbs", label: "carbo", curto: "C", fill: colors.carbs[500] },
  { key: "fat", label: "gordura", curto: "G", fill: colors.fat[500] },
] as const;

export type StoryCardData =
  | {
      kind: "meal";
      /** As palavras da pessoa (legenda) ou os itens da refeição. */
      headline: string | null;
      imageUrl: string | null;
      /**
       * Se `meals.image_path` está preenchido, mesmo que a foto não tenha
       * carregado. É o que protege a original de ser sobrescrita.
       */
      temFotoSalva: boolean;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      dateLabel: string;
    }
  | {
      kind: "insight";
      title: string;
      headline: string;
      bullets: string[];
      score: number | null;
      dateLabel: string;
    };

type Refeicao = Extract<StoryCardData, { kind: "meal" }>;
type Analise = Extract<StoryCardData, { kind: "insight" }>;

/** A foto que este conteúdo tem para oferecer, se tiver. */
export function fotoDoCard(data: StoryCardData): string | null {
  return data.kind === "meal" ? data.imageUrl : null;
}

/** Se há energia declarada — sem ela, não há proporção de macros para mostrar. */
export function temMacros(data: StoryCardData): boolean {
  if (data.kind !== "meal") return false;
  return (
    macroEnergySplit({
      protein: data.protein_g,
      carbs: data.carbs_g,
      fat: data.fat_g,
    }) !== null
  );
}

export function conteudoDoStory(data: StoryCardData): ConteudoStory {
  return {
    kind: data.kind,
    temLegenda: data.kind === "meal" ? Boolean(data.headline) : true,
    temMacros: temMacros(data),
    temNota: data.kind === "insight" && data.score !== null,
  };
}

// ─── Peças ───────────────────────────────────────────────────────────────────

/**
 * A barra de proporção dos macros — a assinatura visual do app.
 *
 * As fatias são de CALORIAS, não de gramas: 58g de carbo (232 kcal) ao lado de
 * 19g de gordura (171 kcal) são 3× em gramas mas só 1,36× em energia, e é a
 * energia que a proporção quer contar.
 */
function MacroBar({ data, preset, height = 10, raio = true }: BarProps) {
  const split = macroEnergySplit({
    protein: data.protein_g,
    carbs: data.carbs_g,
    fat: data.fat_g,
  });
  if (!split) return null;

  return (
    <View
      style={{
        height,
        borderRadius: raio ? height / 2 : 0,
        backgroundColor: preset.track,
      }}
      className="flex-row overflow-hidden"
    >
      {MACROS.map(({ key, fill }) => (
        <View key={key} style={{ width: `${split[key] * 100}%`, backgroundColor: fill }} />
      ))}
    </View>
  );
}

type BarProps = {
  data: Refeicao;
  preset: StoryPreset;
  height?: number;
  raio?: boolean;
};

/** Bolinha + gramas + nome, uma coluna por macro. */
function MacroLegend({ data, preset, curto = false }: LegendProps) {
  const gramas = { protein: data.protein_g, carbs: data.carbs_g, fat: data.fat_g };
  return (
    <View className="flex-row" style={curto ? { gap: 14 } : undefined}>
      {MACROS.map(({ key, label, curto: sigla, fill }) => (
        <View
          key={key}
          className="flex-row items-center"
          style={{ gap: 6, flex: curto ? undefined : 1 }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fill }} />
          {/* Uma string só, montada antes: `{n}g` vira DOIS nós de texto no
              DOM, e o html2canvas desenha cada nó como uma palavra separada —
              no PNG exportado saía "41 g" com espaço, enquanto "32g" (nó único
              por acaso do layout) saía certo. */}
          <Text style={[NUM, { color: preset.text, fontSize: 14 }]} className="font-sans-semibold">
            {`${Math.round(gramas[key])}g`}
          </Text>
          <Text style={{ color: preset.textDim, fontSize: 12 }} className="font-sans">
            {curto ? sigla : label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type LegendProps = {
  data: Refeicao;
  preset: StoryPreset;
  /** Siglas P/C/G em vez dos nomes, para caber numa linha compartilhada. */
  curto?: boolean;
};

/** Número grande com a unidade na mesma linha de base. */
function Hero({ value, unit, preset, size }: HeroProps) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 6 }}>
      <Text
        style={[NUM, { color: preset.accent, fontSize: size, lineHeight: size * 1.02 }]}
        className="font-display-bold"
      >
        {value}
      </Text>
      {unit ? (
        <Text
          style={{ color: preset.textDim, fontSize: Math.round(size * 0.3) }}
          className="font-sans-medium"
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

type HeroProps = { value: string; unit?: string; preset: StoryPreset; size: number };

/**
 * Marca d'água: o lockup e o endereço.
 *
 * Sempre a variante com sombra, porque o logo pode ir parar sobre qualquer
 * parte da foto, com a vinheta desligada. O lockup passa pelo `ShareLogo`, que
 * na web troca a `Image` do react-native-web por uma `<img>` — sem isso o
 * html2canvas o rasteriza no tamanho CSS e ele sai borrado no PNG.
 *
 * O endereço vai junto de propósito: sem cabeçalho de autor, esta é a única
 * coisa no card que traz gente nova, e o logo é o sticker que não sai.
 */
function Marca() {
  return (
    <View style={{ gap: 5 }}>
      <ShareLogo height={18} variant="sombra" />
      <Text
        style={{
          color: colors.white,
          fontSize: 12,
          textShadowColor: withAlpha(colors.ink, 0.7),
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
        className="font-sans-medium"
      >
        fitbrother.app
      </Text>
    </View>
  );
}

/**
 * A placa do preset Etiqueta: a foto inteira limpa, os números numa anotação.
 *
 * A placa é opaca justamente para poder ser pequena: é ela que garante
 * contraste, então não precisa escurecer a foto toda para o texto aparecer.
 */
function Placa({ data, preset }: { data: Refeicao; preset: StoryPreset }) {
  return (
    <View style={[shadows.card, { backgroundColor: colors.white, borderRadius: 20, padding: 16 }]}>
      <View className="flex-row items-baseline justify-between">
        <Hero value={String(Math.round(data.kcal))} unit="kcal" preset={preset} size={30} />
        <Text style={[NUM, { color: preset.textDim, fontSize: 12 }]} className="font-sans-medium">
          {data.dateLabel}
        </Text>
      </View>
      <View style={{ marginTop: 12 }}>
        <MacroBar data={data} preset={preset} height={8} />
      </View>
      <View style={{ marginTop: 12 }}>
        <MacroLegend data={data} preset={preset} curto />
      </View>
    </View>
  );
}

/** Macros do Completo e do Pôster: barra cheia e legenda com os nomes. */
function MacrosCheios({ data, preset }: { data: Refeicao; preset: StoryPreset }) {
  return (
    <>
      <MacroBar data={data} preset={preset} height={preset.id === "poster" ? 14 : 10} />
      <View style={{ marginTop: 12 }}>
        <MacroLegend data={data} preset={preset} />
      </View>
    </>
  );
}

/**
 * Macros do Discreto: a legenda e a barra virando fio.
 *
 * O fio sai do padding do card com margem negativa para alcançar as bordas do
 * quadro, o mesmo movimento do card de refeição da Home, onde a proporção deixa
 * de ser um elemento pousado e vira a borda. Sem raio: é uma régua, não uma
 * barra.
 */
function MacrosEmLinha({ data, preset }: { data: Refeicao; preset: StoryPreset }) {
  return (
    <>
      <MacroLegend data={data} preset={preset} curto />
      <View style={{ marginTop: 18, marginHorizontal: -PAD }}>
        <MacroBar data={data} preset={preset} height={5} raio={false} />
      </View>
    </>
  );
}

function Topicos({ data, preset }: { data: Analise; preset: StoryPreset }) {
  return (
    <View style={{ gap: 10 }}>
      {data.bullets.slice(0, 3).map((b, i) => (
        <View key={i} className="flex-row" style={{ gap: 10 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginTop: 7,
              backgroundColor: preset.accent,
            }}
          />
          <Text
            style={{ color: preset.textDim, fontSize: 14, lineHeight: 20, flex: 1 }}
            className="font-sans"
          >
            {truncate(b, 88)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** O conteúdo de cada sticker, no tamanho que ele tem no preset. */
function ConteudoSticker({
  id,
  data,
  preset,
  temFoto,
}: {
  id: StickerId;
  data: StoryCardData;
  preset: StoryPreset;
  temFoto: boolean;
}) {
  const poster = preset.id === "poster";

  if (id === "logo") return <Marca />;
  if (id === "data") {
    return (
      <Text
        style={[NUM, { color: preset.textDim, fontSize: 12 }]}
        className="font-sans-medium uppercase"
      >
        {data.dateLabel}
      </Text>
    );
  }

  if (data.kind === "insight") {
    if (id === "nota") {
      return (
        <Hero value={String(data.score)} unit="/ 100" preset={preset} size={poster ? 104 : 64} />
      );
    }
    if (id === "titulo") {
      return (
        <Text
          style={{ color: preset.text, fontSize: 27, lineHeight: 33 }}
          className="font-display-bold"
        >
          {truncate(data.title, 58)}
        </Text>
      );
    }
    if (id === "resumo") {
      return (
        <Text
          style={{ color: preset.text, fontSize: 17, lineHeight: 23 }}
          className="font-sans-medium"
        >
          {truncate(data.headline, 108)}
        </Text>
      );
    }
    return id === "topicos" ? <Topicos data={data} preset={preset} /> : null;
  }

  if (id === "itens") {
    // A legenda é apoio quando há foto (a foto já conta o que é), e manchete
    // quando não há.
    return (
      <Text
        style={{
          color: preset.text,
          fontSize: temFoto ? 18 : poster ? 16 : 26,
          lineHeight: temFoto ? 24 : poster ? 22 : 33,
        }}
        className={temFoto || poster ? "font-sans-medium" : "font-display-bold"}
      >
        {truncate(data.headline ?? "", temFoto ? 74 : poster ? 58 : 104)}
      </Text>
    );
  }
  if (id === "calorias") {
    // Sem foto o pôster manda: o número vira o quadro inteiro. Com foto ele cede
    // a cena para ela e volta ao tamanho de manchete.
    const size = poster ? 104 : preset.info === "line" ? 34 : 54;
    return <Hero value={String(Math.round(data.kcal))} unit="kcal" preset={preset} size={size} />;
  }
  if (id === "macros") {
    return preset.info === "line" ? (
      <MacrosEmLinha data={data} preset={preset} />
    ) : (
      <MacrosCheios data={data} preset={preset} />
    );
  }
  return id === "placa" ? <Placa data={data} preset={preset} /> : null;
}

/** As margens do fluxo. Ficam na caixa para acompanhar o sticker removido. */
function margensDe(id: StickerId, preset: StoryPreset, temFoto: boolean): ViewStyle {
  switch (id) {
    case "data":
      return { marginBottom: 8, alignSelf: "flex-start" };
    case "itens":
      return { marginBottom: temFoto ? 14 : 10, alignSelf: "flex-start" };
    case "calorias":
      return { alignSelf: "flex-start" };
    case "macros":
      return { marginTop: preset.info === "line" ? 10 : 18 };
    case "nota":
      return { marginBottom: 12, alignSelf: "flex-start" };
    case "resumo":
      return { marginTop: 10 };
    case "topicos":
      return { marginTop: 18 };
    case "logo":
      return {
        marginTop: preset.info === "chip" ? 14 : preset.info === "line" ? 16 : 22,
        alignSelf: "flex-start",
      };
    default:
      return {};
  }
}

// ─── Camadas ─────────────────────────────────────────────────────────────────

export type CaixaStickerProps = {
  sticker: Sticker;
  style?: ViewStyle;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
};

export type CamadaFotoProps = { uri: string; natural: Tamanho | null; foto: FotoLivre };

function CaixaEstatica({ sticker, style, onLayout, children }: CaixaStickerProps) {
  return (
    <View
      testID={`sticker-${sticker.id}`}
      style={[style, estiloSticker(sticker) as ViewStyle]}
      onLayout={onLayout}
    >
      {children}
    </View>
  );
}

/** A foto no tamanho natural, centrada: quem encaixa no quadro é o transform. */
export function estiloBaseDaFoto(natural: Tamanho | null) {
  const n = natural ?? QUADRO_STORY;
  return {
    position: "absolute" as const,
    left: (SHARE_CARD_WIDTH - n.width) / 2,
    top: (SHARE_CARD_HEIGHT - n.height) / 2,
    width: n.width,
    height: n.height,
  };
}

function FotoEstatica({ uri, natural, foto }: CamadaFotoProps) {
  return (
    <Image
      testID="foto-do-card"
      source={{ uri }}
      accessibilityIgnoresInvertColors
      style={[
        estiloBaseDaFoto(natural),
        estiloFoto(foto, natural ?? QUADRO_STORY, QUADRO_STORY) as never,
      ]}
    />
  );
}

/**
 * O véu entre a foto e o texto.
 *
 * Uma rampa só, sempre de `ink`. A última parada vai até 1: parando antes, o
 * trecho abaixo dela fica na cor final chapada, e no quadro isso aparecia como
 * uma tarja escura ocupando a faixa segura de baixo.
 */
function Vinheta() {
  return (
    <LinearGradient
      testID="vinheta"
      colors={[withAlpha(colors.ink, 0), withAlpha(colors.ink, 0.28), withAlpha(colors.ink, 0.8)]}
      locations={[0.4, 0.72, 1]}
      style={PREENCHE}
    />
  );
}

/**
 * O quadro do story, 9:16.
 *
 * **Sem raio nos cantos, de propósito.** O raio ficava dentro da captura, então
 * o PNG saía com os quatro cantos transparentes — postado num story com fundo
 * claro, o card aparecia com as pontas mordidas. Quem arredonda é o quadro na
 * tela, por fora do nó capturado.
 *
 * **Sem cabeçalho de autor.** O story já mostra quem postou, na mesma faixa de
 * cima onde o cabeçalho ficava.
 *
 * Os stickers são filhos diretos da coluna, na ordem do fluxo, e é o `zIndex`
 * deles que decide quem fica por cima: no Android o `zIndex` só vale entre
 * irmãos. A coluna preenche o card, então o `onLayout` já mede em dp do card.
 *
 * O texto nasce dentro da faixa segura (`STORY_SAFE_*`); a foto atravessa ela e
 * vai de ponta a ponta do quadro.
 */
export function StoryCard({
  data,
  preset,
  stickers,
  vinheta,
  foto = null,
  fotoNatural = null,
  fotoLivre = FOTO_PADRAO,
  fotoExterna = false,
  CaixaSticker = CaixaEstatica,
  CamadaFoto = FotoEstatica,
  aoMedir,
  testID,
}: StoryCardProps) {
  // Com `fotoExterna` o quadro TEM foto, ela só não é desenhada aqui.
  const temFoto = fotoExterna || Boolean(foto);

  return (
    <View
      testID={testID}
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        backgroundColor: fotoExterna ? "transparent" : colors.ink,
      }}
      className="overflow-hidden"
    >
      {foto && !fotoExterna ? (
        <CamadaFoto uri={foto} natural={fotoNatural} foto={fotoLivre} />
      ) : null}
      {vinheta && temFoto ? <Vinheta /> : null}

      <View
        style={[
          PREENCHE,
          {
            paddingTop: STORY_SAFE_TOP,
            paddingBottom: STORY_SAFE_BOTTOM,
            paddingHorizontal: PAD,
            // O pôster centraliza: sem foto, o número É a composição, e ancorado
            // embaixo deixava um vão de meio quadro em cima dele.
            justifyContent: preset.id === "poster" ? "center" : "flex-end",
          },
        ]}
      >
        {stickers.map((s) => (
          <CaixaSticker
            key={s.id}
            sticker={s}
            style={margensDe(s.id, preset, temFoto)}
            onLayout={
              aoMedir
                ? (e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    aoMedir(s.id, { x, y, width, height } satisfies Caixa);
                  }
                : undefined
            }
          >
            <ConteudoSticker id={s.id} data={data} preset={preset} temFoto={temFoto} />
          </CaixaSticker>
        ))}
      </View>
    </View>
  );
}

type StoryCardProps = {
  data: StoryCardData;
  preset: StoryPreset;
  stickers: Sticker[];
  /** A vinheta preta. Só aparece quando há foto para escurecer. */
  vinheta: boolean;
  foto?: string | null;
  /** Medidas naturais da foto. Sem elas, ela cobre o quadro. */
  fotoNatural?: Tamanho | null;
  fotoLivre?: FotoLivre;
  /**
   * A foto vem de fora do card: a câmera ao vivo que fica ATRÁS dele.
   *
   * Desenha os stickers e a vinheta, mas não a foto, e deixa o fundo
   * transparente para a camada de trás aparecer.
   */
  fotoExterna?: boolean;
  /** O editor troca estas duas pelas versões animadas. */
  CaixaSticker?: ComponentType<CaixaStickerProps>;
  CamadaFoto?: ComponentType<CamadaFotoProps>;
  aoMedir?: (id: StickerId, caixa: Caixa) => void;
  testID?: string;
};
